import {parseAppearance} from '../shared/noot-profile'
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
import { nextEntries, roundDifficulty, readyForNext, everyoneReady, parseMatchCommand, publicMatch, advancePlayer, expireRound, finishRound, ROUND_MS, type MatchState } from '../shared/match'
import { pickRandomTrack, findTrackById } from './catalog'
import { checkMatchGuess } from './guess'
import { songIdentityKey } from './track-dedupe'
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
    await this.ctx.blockConcurrencyWhile(async()=>this.handleMessage(ws,message))
  }
  private async handleMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const attachment = ws.deserializeAttachment() as SocketAttachment | null
    if (!attachment?.playerId) {
      ws.close(1008, 'no player')
      return
    }
    const text = typeof message === 'string' ? message : ''
    let pet:Record<string,unknown>={};try{pet=JSON.parse(text)}catch{/* Invalid message. */}
    if(pet?.type==='pet-profile') {
      const current=this.withConnections(this.loadState())
      if(!current.players.some(p=>p.id===attachment.playerId))return
      if(typeof pet.name==='string') {
        const renamed=applySittingEvent(current,{type:'join',id:attachment.playerId,name:pet.name,at:Date.now()})
        if(renamed.ok) {
          this.saveState(renamed.state)
          const name=renamed.state.players.find(p=>p.id===attachment.playerId)!.name
          const match=await this.ctx.storage.get<MatchState>('match')
          if(match)await this.ctx.storage.put('match',{...match,entries:match.entries.map(p=>p.id===attachment.playerId?{...p,name}:p)})
        }
      }
      await this.ctx.storage.put(`pet:${attachment.playerId}`,parseAppearance(pet.appearance))
      await this.broadcast(this.loadState());return
    }
    if(pet?.type==='pet-greet') {
      const members=this.withConnections(this.loadState()).players
      if(typeof pet.target!=='string'||pet.target===attachment.playerId||!members.some(p=>p.id===pet.target&&p.connected))return
      const last=await this.ctx.storage.get<number>(`greet-at:${attachment.playerId}`)??0
      if(Date.now()-last<3000)return
      await this.ctx.storage.put(`greet-at:${attachment.playerId}`,Date.now())
      await this.ctx.storage.put(`greeting:${pet.target}`,{from:attachment.playerId,at:Date.now()})
      await this.broadcast(this.loadState());return
    }
    const command = parseMatchCommand(text)
    if(command) {
      try { await this.handleMatch(attachment.playerId,command) }
      catch { ws.send(JSON.stringify({type:'match-error',message:'Could not load the next song. Try again; your scores are safe.'})) }
      return
    }
    const parsed = parseClientSittingMessage(text)
    if (!parsed) return

    const state = this.withConnections(this.loadState())
    switch (parsed.type) {
      case 'activity': {
        if(await this.ctx.storage.get('match'))return
        if (!state.players.some(player=>player.id===attachment.playerId)) return
        const activity = {action:parsed.action,stage:parsed.stage,at:Date.now()}
        await this.ctx.storage.put(`activity:${attachment.playerId}`,activity)
        await this.broadcast(state)
        return
      }
      case 'score': {
        // Match points are awarded only by validated match guesses.
        if(await this.ctx.storage.get('match'))return
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
        await this.broadcast(result.state)
        return
      }
      case 'leave': {
        const result = applySittingEvent(state, { type: 'leave', id: attachment.playerId })
        if (!result.ok) {
          this.sendError(ws, result.error)
          return
        }
        this.saveState(result.state)
        const match=await this.ctx.storage.get<MatchState>('match')
        if(match?.phase==='playing') await this.ctx.storage.put('match',finishRound({...match,entries:match.entries.map(p=>p.id===attachment.playerId && p.status==='playing'?{...p,status:'out',lastAction:'timeout'}:p)}))
        await this.broadcast(result.state)
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
    await this.ctx.blockConcurrencyWhile(()=>this.closePlayer(ws))
  }

  private async closePlayer(ws: WebSocket): Promise<void> {
    const attachment = ws.deserializeAttachment() as SocketAttachment | null
    if (!attachment?.playerId) return
    const stillOpen = this.ctx.getWebSockets(attachment.playerId).some((socket) => socket !== ws)
    if (stillOpen) return
    const result = applySittingEvent(this.withConnections(this.loadState()), { type: 'disconnect', id: attachment.playerId })
    if (!result.ok) return
    this.saveState(result.state)
    await this.broadcast(result.state)
    const match=await this.ctx.storage.get<MatchState>('match')
    const connected=this.withConnections(result.state).players.filter(p=>p.connected).map(p=>p.id)
    if(match && match.phase!=='playing' && everyoneReady(match,connected)) {
      const ready=match.entries.find(p=>connected.includes(p.id)&&p.ready)
      if(ready) {
        try {await this.handleMatch(ready.id,{type:'match-next',roundId:match.roundId})}
        catch {for(const socket of this.ctx.getWebSockets())socket.send(JSON.stringify({type:'match-error',message:'Could not load the next song. Your scores are safe; tap ready to retry.'}))}
      }
    }
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

  private async acceptPlayer(request: Request): Promise<Response> {
    return this.ctx.blockConcurrencyWhile(async()=>this.joinPlayer(request))
  }
  private async joinPlayer(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const pathCode = url.pathname.match(/\/sitting\/([^/]+)\/ws$/)?.[1]
    const code = normalizeSittingCode(url.searchParams.get('code') ?? pathCode ?? this.loadMeta()?.code ?? '')
    if (!code) return errorResponse('bad-code', 400)
    if (!this.loadMeta()?.opened) return errorResponse('not-found', 404)

    const playerId = url.searchParams.get('playerId') ?? ''
    if (!isPlayerId(playerId)) return errorResponse('unknown-player', 400)

    const token=url.searchParams.get('token')??''
    if(!/^[a-zA-Z0-9_-]{32,80}$/.test(token))return errorResponse('unknown-player',403)
    const seatToken=await this.ctx.storage.get<string>(`seat:${playerId}`)
    if(seatToken && seatToken!==token)return errorResponse('unknown-player',403)
    const parsedName = parseSittingName(url.searchParams.get('name') ?? '')
    if (!parsedName.ok) return errorResponse(parsedName.error, statusFor(parsedName.error))

    const openingPoints = 0
    const result = applySittingEvent(this.withConnections(this.loadState()), {
      type: 'join',
      id: playerId,
      name: parsedName.name,
      at: Date.now(),
      openingPoints,
    })
    if (!result.ok) return errorResponse(result.error, statusFor(result.error))

    await this.ctx.storage.put(`seat:${playerId}`,token)
    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)
    for (const existing of this.ctx.getWebSockets(playerId)) {
      existing.close(1000, 'replaced')
    }
    this.ctx.acceptWebSocket(server, [playerId])
    server.serializeAttachment({ playerId } satisfies SocketAttachment)
    this.saveState({ ...result.state, code })
    await this.broadcast(result.state)
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

  private async broadcast(state: SittingState): Promise<void> {
    const activity = await this.ctx.storage.list<NonNullable<import('../shared/sitting').SittingPlayer['activity']>>({prefix:'activity:'})
    const pets=await this.ctx.storage.list<import('../shared/noot-profile').NootAppearance>({prefix:'pet:'})
    const greetings=await this.ctx.storage.list<{from:string;at:number}>({prefix:'greeting:'})
    const match = await this.ctx.storage.get<MatchState>('match')
    const connected = this.withConnections(state)
    const liveHost = connected.players.find(p=>p.id===state.hostId && p.connected)?.id ?? connected.players.find(p=>p.connected)?.id ?? state.hostId
    const payload = JSON.stringify({
      type: 'state',
      code: state.code,
      hostId: liveHost,
      match: match ? publicMatch(match) : null,
      serverNow: Date.now(),
      players: rankPlayers(this.withConnections(state).players).map(player=>({...player,appearance:pets.get(`pet:${player.id}`),greeting:greetings.get(`greeting:${player.id}`),activity:activity.get(`activity:${player.id}`)})),
    })
    for (const socket of this.ctx.getWebSockets()) {
      try {
        socket.send(payload)
      } catch {
        /* socket already closing */
      }
    }
  }

  async alarm(): Promise<void> {
    await this.ctx.blockConcurrencyWhile(async()=>{
      const match=await this.ctx.storage.get<MatchState>('match')
      if(!match)return
      await this.ctx.storage.put('match',expireRound(match,Date.now()))
      await this.broadcast(this.loadState())
    })
  }

  private async handleMatch(playerId:string,command:NonNullable<ReturnType<typeof parseMatchCommand>>) {
    const state=this.withConnections(this.loadState())
    if(!state.players.some(p=>p.id===playerId && p.connected))return
    const host=state.players.find(p=>p.id===state.hostId && p.connected)?.id ?? state.players.find(p=>p.connected)?.id
    let match=await this.ctx.storage.get<MatchState>('match')
    if(command.type==='match-start'||command.type==='match-next') {
      if(command.type==='match-start' && playerId!==host)return
      if(command.type==='match-start' && match)return
      if(command.type==='match-next' && (!match || match.roundId!==command.roundId || match.phase==='playing'))return
      if(command.type==='match-next') {
        if(!match!.entries.some(p=>p.id===playerId))return
        match=readyForNext(match!,playerId,command.roundId)
        await this.ctx.storage.put('match',match)
        await this.broadcast(state)
        if(!everyoneReady(match,state.players.filter(p=>p.connected).map(p=>p.id)))return
      }
      const continuing=command.type==='match-next' && match!.phase==='reveal'
      const mode=command.type==='match-start'?command.difficulty:(match!.difficultyMode??match!.difficulty)
      const length=command.type==='match-start'?(command.length??10):(match!.length??10)
      const carryScores=command.type==='match-start'?(command.carryScores??false):(match!.carryScores??false)
      const difficulty=roundDifficulty(mode,continuing?match!.number+1:1)
      const active=state.players.filter(p=>p.connected)
      if(active.length<(continuing?1:2))return
      // Bound catalog latency below the Durable Object's concurrency-lock timeout.
      // A stalled catalog request must leave the current round retryable.
      let catalogTimer: ReturnType<typeof setTimeout> | undefined
      const track = await Promise.race([
        pickRandomTrack(this.env,difficulty,crypto.randomUUID(),undefined,new Set(continuing?match!.used:[])),
        new Promise<never>((_, reject) => {
          catalogTimer = setTimeout(() => reject(new Error('Catalog timed out')), 12_000)
        }),
      ]).finally(() => clearTimeout(catalogTimer))
      if(!track)throw new Error('No songs available')
      const now=Date.now(), startsAt=now+3000
      const previous=continuing||carryScores?(match?.entries??[]):[]
      match={id:continuing?match!.id:crypto.randomUUID(),roundId:crypto.randomUUID(),number:continuing?match!.number+1:1,phase:'playing',difficulty,difficultyMode:mode,length,carryScores,startsAt,deadline:startsAt+ROUND_MS,
        entries:nextEntries(previous,active,continuing,carryScores),
        song:{id:track.id,title:track.title,artist:track.artist,albumArt:track.albumArt,audio:track.introClipUrl||track.audioUrl||track.previewUrl,offset:track.introClipUrl?0:track.audioUrl?(track.startAtMs??0)/1000:0},used:[...(continuing?match!.used:[]),track.id]}
      match=finishRound(match)
      await this.ctx.storage.put('match',match)
      await this.ctx.storage.setAlarm(match.deadline)
    } else if(match) {
      const receivedAt = Date.now()
      let correct = false
      if (command.type === 'match-guess') {
        if (command.trackId) {
          if (command.trackId === match.song.id) correct = true
          else {
            const selected = await findTrackById(this.env, command.trackId)
            correct = Boolean(selected && songIdentityKey(selected) === songIdentityKey(match.song))
          }
        } else correct = checkMatchGuess(command.guess, match.song.title, match.song.artist)
      }
      match=advancePlayer(match,playerId,command.roundId,command.stage,correct,command.type==='match-skip',receivedAt)
      await this.ctx.storage.put('match',match)
    }
    await this.broadcast(state)
  }

  private sendError(ws: WebSocket, error: SittingError): void {
    try {
      ws.send(JSON.stringify({ type: 'error', error, message: sittingErrorMessage(error) }))
    } catch {
      /* ignore */
    }
  }
}
