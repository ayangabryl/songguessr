import {
  isPlayerId,
  NAME_MAX_LENGTH,
  parseSittingName,
} from '../../shared/sitting'

const PLAYER_ID_KEY = 'songguessr-player-id'
const DISPLAY_NAME_KEY = 'songguessr-display-name'
const RECENT_SITTERS_KEY = 'songguessr-recent-sitters'
const LAST_CODE_KEY = 'songguessr-sitting-code'

export interface RecentSitter {
  name: string
  code: string
  at: number
}

export function loadPlayerId(): string {
  try {
    const existing = sessionStorage.getItem(PLAYER_ID_KEY)
    if (existing && isPlayerId(existing)) return existing
    const created = crypto.randomUUID()
    sessionStorage.setItem(PLAYER_ID_KEY, created)
    return created
  } catch {
    return crypto.randomUUID()
  }
}

export function loadDisplayName(): string {
  try {
    const stored = localStorage.getItem(DISPLAY_NAME_KEY) ?? ''
    const parsed = parseSittingName(stored)
    return parsed.ok ? parsed.name : ''
  } catch {
    return ''
  }
}

export function saveDisplayName(name: string) {
  const parsed = parseSittingName(name)
  if (!parsed.ok) return
  try {
    localStorage.setItem(DISPLAY_NAME_KEY, parsed.name)
  } catch {
    /* private mode */
  }
}

export function loadLastSittingCode(): string | null {
  try {
    return sessionStorage.getItem(LAST_CODE_KEY)
  } catch {
    return null
  }
}

export function saveLastSittingCode(code: string | null) {
  try {
    if (code) sessionStorage.setItem(LAST_CODE_KEY, code)
    else sessionStorage.removeItem(LAST_CODE_KEY)
  } catch {
    /* private mode */
  }
}

export function loadRecentSitters(): RecentSitter[] {
  try {
    const raw = localStorage.getItem(RECENT_SITTERS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((row) => {
        if (!row || typeof row !== 'object') return null
        const item = row as { name?: unknown; code?: unknown; at?: unknown }
        if (typeof item.name !== 'string' || typeof item.code !== 'string') return null
        return {
          name: item.name.slice(0, NAME_MAX_LENGTH),
          code: item.code,
          at: typeof item.at === 'number' ? item.at : 0,
        }
      })
      .filter((row): row is RecentSitter => row !== null)
      .slice(0, 12)
  } catch {
    return []
  }
}

export function rememberSitters(names: string[], code: string, selfName: string) {
  const now = Date.now()
  const incoming = names
    .filter((name) => name && name !== selfName)
    .map((name) => ({ name, code, at: now }))
  if (incoming.length === 0) return
  const existing = loadRecentSitters().filter(
    (row) => !incoming.some((item) => item.name.toLowerCase() === row.name.toLowerCase()),
  )
  try {
    localStorage.setItem(RECENT_SITTERS_KEY, JSON.stringify([...incoming, ...existing].slice(0, 12)))
  } catch {
    /* private mode */
  }
}

export function filterRecentSitters(sitters: RecentSitter[], query: string): RecentSitter[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return sitters
  return sitters.filter((row) => row.name.toLowerCase().includes(needle) || row.code.toLowerCase().includes(needle))
}
