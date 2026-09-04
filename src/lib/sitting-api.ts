import {
  normalizeSittingCode,
  sittingErrorMessage,
  type SittingError,
} from '../../shared/sitting'

export interface SittingPeek {
  code: string
  playerCount: number
  full: boolean
}

export interface SittingWireError {
  error: SittingError
  message: string
}

const FETCH_MS = 8_000

async function readError(response: Response): Promise<SittingWireError> {
  try {
    const body = (await response.json()) as { error?: SittingError; message?: string }
    if (body.error) {
      return { error: body.error, message: body.message ?? sittingErrorMessage(body.error) }
    }
  } catch {
    /* not json */
  }
  return { error: 'server', message: sittingErrorMessage('server') }
}

export async function createSitting(): Promise<{ code: string }> {
  const response = await fetch('/api/sitting', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
    signal: AbortSignal.timeout(FETCH_MS),
  })
  if (!response.ok) {
    const error = await readError(response)
    throw error
  }
  const body = (await response.json()) as { code?: string }
  const code = typeof body.code === 'string' ? normalizeSittingCode(body.code) : null
  if (!code) throw { error: 'server', message: sittingErrorMessage('server') } satisfies SittingWireError
  return { code }
}

export async function peekSitting(code: string, playerId?: string): Promise<SittingPeek> {
  const normalized = normalizeSittingCode(code)
  if (!normalized) {
    throw { error: 'bad-code', message: sittingErrorMessage('bad-code') } satisfies SittingWireError
  }
  const params = playerId ? `?playerId=${encodeURIComponent(playerId)}` : ''
  const response = await fetch(`/api/sitting/${normalized}${params}`, {
    signal: AbortSignal.timeout(FETCH_MS),
  })
  if (!response.ok) {
    throw await readError(response)
  }
  const body = (await response.json()) as SittingPeek
  return body
}

export function sittingSocketUrl(code: string, playerId: string, name: string, points: number): string {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
  const params = new URLSearchParams({
    playerId,
    name,
    points: String(Math.max(0, Math.floor(points))),
  })
  return `${protocol}//${location.host}/api/sitting/${code}/ws?${params}`
}

export function isSittingWireError(value: unknown): value is SittingWireError {
  return Boolean(value && typeof value === 'object' && 'error' in value && 'message' in value)
}
