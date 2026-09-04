import { DurableObject } from 'cloudflare:workers'
import {
  applySittingEvent,
  emptySitting,
  isPlayerId,
  normalizeSittingCode,
  parseClientSittingMessage,
  parseSittingName,
  rankPlayers,
  sittingErrorMessage,
  MAX_SITTING_PLAYERS,
  type SittingError,
  type SittingState,
} from '../shared/sitting'
import type { Env } from './types'

interface SocketAttachment {
  playerId: string
}

function errorResponse(error: SittingError, status: number): Response {
  return Response.json({ error, message: sittingErrorMessage(error) }, { status })
}

function statusFor(error: SittingError): number {
  switch (error) {
    case 'empty-name':
    case 'name-too-short':
    case 'name-too-long':
    case 'bad-code':
    case 'bad-delta':
      return 400
    case 'not-found':
    case 'unknown-player':
      return 404
    case 'room-full':
      return 409
    case 'offline':
    case 'timeout':
    case 'server':
      return 503
    default: {
      const exhaustive: never = error
      return exhaustive
    }
  }
}

export class SittingRoom extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'))
    this.ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS sitting (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          code TEXT NOT NULL,
          host_id TEXT,
          opened INTEGER NOT NULL DEFAULT 0
        )
      `)
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS players (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          points INTEGER NOT NULL DEFAULT 0,
          joined_at INTEGER NOT NULL
        )
      `)
    })
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname

    if (request.method === 'POST' && path.endsWith('/open')) {
      return this.open(request)
    }
    if (request.method === 'GET' && path.endsWith('/info')) {
      return this.info(request)
    }
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.acceptPlayer(request)
    }
    return new Response('Not found', { status: 404 })
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const attachment = ws.deserializeAttachment() as SocketAttachment | null
    if (!attachment?.playerId) {
      ws.close(1008, 'no player')
      return
    }
    const text = typeof message === 'string' ? message : ''
    const parsed = parseClientSittingMessage(text)
    if (!parsed) return

    const state = this.withConnections(this.loadState())
    switch (parsed.type) {
      case 'score': {
        const result = applySittingEvent(state, {
          type: 'score',
          id: attachment.playerId,
          delta: parsed.delta,
        })
        if (!result.ok) {
          this.sendError(ws, result.error)
          return
        }
        this.saveState(result.state)
        this.broadcast(result.state)
        return
      }
      case 'leave': {
        const result = applySittingEvent(state, { type: 'leave', id: attachment.playerId })
        if (!result.ok) {
          this.sendError(ws, result.error)
          return
        }
        this.saveState(result.state)
        this.broadcast(result.state)
        ws.close(1000, 'left')
        return
      }
      default: {
        const exhaustive: never = parsed
        return exhaustive
      }
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const attachment = ws.deserializeAttachment() as SocketAttachment | null
    if (!attachment?.playerId) return
    const stillOpen = this.ctx.getWebSockets(attachment.playerId).some((socket) => socket !== ws)
    if (stillOpen) return
    const result = applySittingEvent(this.withConnections(this.loadState()), { type: 'disconnect', id: attachment.playerId })
    if (!result.ok) return
    this.saveState(result.state)
    this.broadcast(result.state)
  }

  private async open(request: Request): Promise<Response> {
    let body: { code?: unknown } = {}
    try {
      body = (await request.json()) as { code?: unknown }
    } catch {
      return errorResponse('bad-code', 400)
    }
    const code = typeof body.code === 'string' ? normalizeSittingCode(body.code) : null
    if (!code) return errorResponse('bad-code', 400)
    const meta = this.loadMeta()
    if (meta?.opened) {
      const state = this.loadState()
      if (state.players.length > 0) return errorResponse('room-full', 409)
    }
    this.saveState(emptySitting(code), true)
    return Response.json({ code })
  }

  private info(request: Request): Response {
    const meta = this.loadMeta()
    if (!meta?.opened) return errorResponse('not-found', 404)
    const state = this.withConnections(this.loadState())
    const connected = state.players.filter((player) => player.connected).length
    const playerId = new URL(request.url).searchParams.get('playerId') ?? ''
    const alreadyIn = Boolean(playerId) && state.players.some((player) => player.id === playerId)
    return Response.json({
      code: state.code,
      playerCount: state.players.length,
      full: connected >= MAX_SITTING_PLAYERS && !alreadyIn,
    })
  }

  private acceptPlayer(request: Request): Response {
    const url = new URL(request.url)
    const pathCode = url.pathname.match(/\/sitting\/([^/]+)\/ws$/)?.[1]
    const code = normalizeSittingCode(url.searchParams.get('code') ?? pathCode ?? this.loadMeta()?.code ?? '')
    if (!code) return errorResponse('bad-code', 400)
    if (!this.loadMeta()?.opened) return errorResponse('not-found', 404)

    const playerId = url.searchParams.get('playerId') ?? ''
    if (!isPlayerId(playerId)) return errorResponse('unknown-player', 400)

    const parsedName = parseSittingName(url.searchParams.get('name') ?? '')
    if (!parsedName.ok) return errorResponse(parsedName.error, statusFor(parsedName.error))

    const openingPoints = Number(url.searchParams.get('points') ?? '0')
    const result = applySittingEvent(this.withConnections(this.loadState()), {
      type: 'join',
      id: playerId,
      name: parsedName.name,
      at: Date.now(),
      openingPoints,
    })
    if (!result.ok) return errorResponse(result.error, statusFor(result.error))

    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)
    for (const existing of this.ctx.getWebSockets(playerId)) {
      existing.close(1000, 'replaced')
    }
    this.ctx.acceptWebSocket(server, [playerId])
    server.serializeAttachment({ playerId } satisfies SocketAttachment)
    this.saveState({ ...result.state, code })
    this.broadcast(result.state)
    return new Response(null, { status: 101, webSocket: client })
  }

  private loadMeta(): { code: string; hostId: string | null; opened: boolean } | null {
    try {
      const row = this.ctx.storage.sql
        .exec('SELECT code, host_id, opened FROM sitting WHERE id = 1')
        .one() as { code: string; host_id: string | null; opened: number }
      return { code: row.code, hostId: row.host_id, opened: row.opened === 1 }
    } catch {
      return null
    }
  }

  private loadState(): SittingState {
    const meta = this.loadMeta()
    if (!meta) return emptySitting('XXXX')
    const rows = this.ctx.storage.sql
      .exec('SELECT id, name, points, joined_at FROM players ORDER BY joined_at ASC')
      .toArray() as { id: string; name: string; points: number; joined_at: number }[]
    return {
      code: meta.code,
      hostId: meta.hostId,
      players: rows.map((row) => ({
        id: row.id,
        name: row.name,
        points: row.points,
        connected: false,
        joinedAt: row.joined_at,
      })),
    }
  }

  private saveState(state: SittingState, opened = true): void {
    this.ctx.storage.sql.exec(
      `INSERT INTO sitting (id, code, host_id, opened) VALUES (1, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET code = excluded.code, host_id = excluded.host_id, opened = excluded.opened`,
      state.code,
      state.hostId,
      opened ? 1 : 0,
    )
    this.ctx.storage.sql.exec('DELETE FROM players')
    for (const player of state.players) {
      this.ctx.storage.sql.exec(
        'INSERT INTO players (id, name, points, joined_at) VALUES (?, ?, ?, ?)',
        player.id,
        player.name,
        player.points,
        player.joinedAt,
      )
    }
  }

  private withConnections(state: SittingState): SittingState {
    const live = new Set(
      this.ctx
        .getWebSockets()
        .map((socket) => (socket.deserializeAttachment() as SocketAttachment | null)?.playerId)
        .filter((id): id is string => Boolean(id)),
    )
    return {
      ...state,
      players: state.players.map((player) => ({ ...player, connected: live.has(player.id) })),
    }
  }

  private broadcast(state: SittingState): void {
    const payload = JSON.stringify({
      type: 'state',
      code: state.code,
      hostId: state.hostId,
      players: rankPlayers(this.withConnections(state).players),
    })
    for (const socket of this.ctx.getWebSockets()) {
      try {
        socket.send(payload)
      } catch {
        /* socket already closing */
      }
    }
  }

  private sendError(ws: WebSocket, error: SittingError): void {
    try {
      ws.send(JSON.stringify({ type: 'error', error, message: sittingErrorMessage(error) }))
    } catch {
      /* ignore */
    }
  }
}
