export const SITTING_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ'
export const SITTING_CODE_LENGTH = 4
export const MAX_SITTING_PLAYERS = 8
export const NAME_MIN_LENGTH = 2
export const NAME_MAX_LENGTH = 24
export const MAX_SCORE_DELTA = 6
export const MAX_OPENING_POINTS = 500

export type SittingError =
  | 'empty-name'
  | 'name-too-short'
  | 'name-too-long'
  | 'bad-code'
  | 'room-full'
  | 'unknown-player'
  | 'bad-delta'
  | 'not-found'
  | 'offline'
  | 'timeout'
  | 'server'

export interface SittingPlayer {
  id: string
  name: string
  points: number
  connected: boolean
  joinedAt: number
}

export interface SittingState {
  code: string
  hostId: string | null
  players: SittingPlayer[]
}

export interface RankedPlayer extends SittingPlayer {
  rank: number
}

export type SittingEvent =
  | { type: 'join'; id: string; name: string; at: number; openingPoints?: number }
  | { type: 'leave'; id: string }
  | { type: 'disconnect'; id: string }
  | { type: 'score'; id: string; delta: number }

export type SittingResult =
  | { ok: true; state: SittingState }
  | { ok: false; error: SittingError }

export function emptySitting(code: string): SittingState {
  return { code, hostId: null, players: [] }
}

export function makeSittingCode(bytes: Uint8Array): string {
  const alphabet = SITTING_CODE_ALPHABET
  let code = ''
  for (let i = 0; i < SITTING_CODE_LENGTH; i += 1) {
    const byte = bytes[i] ?? 0
    code += alphabet[byte % alphabet.length]
  }
  return code
}

export function normalizeSittingCode(raw: string): string | null {
  const code = raw.trim().toUpperCase().replace(/[\s-]/g, '')
  if (code.length !== SITTING_CODE_LENGTH) return null
  for (const char of code) {
    if (!SITTING_CODE_ALPHABET.includes(char)) return null
  }
  return code
}

export function parseSittingName(raw: string): { ok: true; name: string } | { ok: false; error: SittingError } {
  const name = raw.trim().replace(/\s+/g, ' ').replace(/[\u0000-\u001F\u007F]/g, '')
  if (!name) return { ok: false, error: 'empty-name' }
  if (name.length < NAME_MIN_LENGTH) return { ok: false, error: 'name-too-short' }
  if (name.length > NAME_MAX_LENGTH) return { ok: false, error: 'name-too-long' }
  return { ok: true, name }
}

export function isPlayerId(value: string): boolean {
  return /^[A-Za-z0-9_-]{8,64}$/.test(value)
}

export function uniqueDisplayName(name: string, players: SittingPlayer[], selfId?: string): string {
  const taken = new Set(
    players.filter((player) => player.id !== selfId).map((player) => player.name.toLowerCase()),
  )
  if (!taken.has(name.toLowerCase())) return name
  for (let n = 2; n < 100; n += 1) {
    const suffix = ` ${n}`
    const base = name.slice(0, Math.max(NAME_MIN_LENGTH, NAME_MAX_LENGTH - suffix.length))
    const candidate = `${base}${suffix}`
    if (!taken.has(candidate.toLowerCase())) return candidate
  }
  return `${name.slice(0, NAME_MAX_LENGTH - 4)} 99`
}

export function clampOpeningPoints(value: number | undefined): number {
  if (value == null || !Number.isFinite(value)) return 0
  return Math.min(MAX_OPENING_POINTS, Math.max(0, Math.floor(value)))
}

export function rankPlayers(players: SittingPlayer[]): RankedPlayer[] {
  const sorted = [...players].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (a.joinedAt !== b.joinedAt) return a.joinedAt - b.joinedAt
    return a.name.localeCompare(b.name)
  })
  return sorted.map((player, index) => ({ ...player, rank: index + 1 }))
}

/** Places you moved up. Positive is an overtake; 0 if you were not on both boards. */
export function rankDelta(
  previous: Pick<RankedPlayer, 'id' | 'rank'>[],
  next: Pick<RankedPlayer, 'id' | 'rank'>[],
  youId: string,
): number {
  const prevRank = previous.find((player) => player.id === youId)?.rank
  const nextRank = next.find((player) => player.id === youId)?.rank
  if (prevRank == null || nextRank == null) return 0
  return prevRank - nextRank
}

export function filterPlayers<T extends SittingPlayer>(players: T[], query: string): T[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return players
  return players.filter((player) => player.name.toLowerCase().includes(needle))
}

export function sittingErrorMessage(error: SittingError): string {
  switch (error) {
    case 'empty-name':
    case 'name-too-short':
    case 'name-too-long':
      return 'Need a name of 2 to 24 letters.'
    case 'bad-code':
      return 'Codes are four letters.'
    case 'room-full':
      return 'This table is full (8).'
    case 'unknown-player':
      return 'You are not at this table.'
    case 'bad-delta':
      return "That score didn't count."
    case 'not-found':
      return 'That code is not a table.'
    case 'offline':
      return "You're offline. The board will catch up."
    case 'timeout':
      return 'That took too long. Try again.'
    case 'server':
      return "Couldn't open a table. Try again."
    default: {
      const exhaustive: never = error
      return exhaustive
    }
  }
}

function nextHost(players: SittingPlayer[]): string | null {
  if (players.length === 0) return null
  const sorted = [...players].sort((a, b) => a.joinedAt - b.joinedAt)
  return sorted[0]?.id ?? null
}

export function applySittingEvent(state: SittingState, event: SittingEvent): SittingResult {
  switch (event.type) {
    case 'join': {
      const parsed = parseSittingName(event.name)
      if (!parsed.ok) return parsed
      const existing = state.players.find((player) => player.id === event.id)
      if (existing) {
        const name = uniqueDisplayName(parsed.name, state.players, event.id)
        return {
          ok: true,
          state: {
            ...state,
            players: state.players.map((player) =>
              player.id === event.id ? { ...player, name, connected: true } : player,
            ),
          },
        }
      }
      const connectedCount = state.players.filter((player) => player.connected).length
      if (connectedCount >= MAX_SITTING_PLAYERS) return { ok: false, error: 'room-full' }
      const player: SittingPlayer = {
        id: event.id,
        name: uniqueDisplayName(parsed.name, state.players),
        points: clampOpeningPoints(event.openingPoints),
        connected: true,
        joinedAt: event.at,
      }
      const players = [...state.players, player]
      return {
        ok: true,
        state: {
          ...state,
          hostId: state.hostId ?? event.id,
          players,
        },
      }
    }
    case 'leave': {
      if (!state.players.some((player) => player.id === event.id)) {
        return { ok: false, error: 'unknown-player' }
      }
      const players = state.players.filter((player) => player.id !== event.id)
      return {
        ok: true,
        state: {
          ...state,
          hostId: state.hostId === event.id ? nextHost(players) : state.hostId,
          players,
        },
      }
    }
    case 'disconnect': {
      if (!state.players.some((player) => player.id === event.id)) {
        return { ok: true, state }
      }
      return {
        ok: true,
        state: {
          ...state,
          players: state.players.map((player) =>
            player.id === event.id ? { ...player, connected: false } : player,
          ),
        },
      }
    }
    case 'score': {
      if (!Number.isInteger(event.delta) || event.delta < 0 || event.delta > MAX_SCORE_DELTA) {
        return { ok: false, error: 'bad-delta' }
      }
      if (!state.players.some((player) => player.id === event.id)) {
        return { ok: false, error: 'unknown-player' }
      }
      return {
        ok: true,
        state: {
          ...state,
          players: state.players.map((player) =>
            player.id === event.id ? { ...player, points: player.points + event.delta } : player,
          ),
        },
      }
    }
    default: {
      const exhaustive: never = event
      return exhaustive
    }
  }
}

export type ClientSittingMessage =
  | { type: 'score'; delta: number }
  | { type: 'leave' }

export function parseClientSittingMessage(raw: string): ClientSittingMessage | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw) as unknown
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object') return null
  const message = parsed as { type?: unknown; delta?: unknown }
  switch (message.type) {
    case 'score': {
      if (typeof message.delta !== 'number') return null
      return { type: 'score', delta: message.delta }
    }
    case 'leave':
      return { type: 'leave' }
    default:
      return null
  }
}
