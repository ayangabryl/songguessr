import { readMigratedItem, removeMigratedItem } from './storage'

let sessionCache: SpotifySession | null | undefined

const STORAGE_KEY = 'songguessr-spotify-session'
const VERIFIER_KEY = 'songguessr-spotify-pkce'
const STATE_KEY = 'songguessr-spotify-state'
const LEGACY_STORAGE_KEY = 'songgussr-spotify-session'
const LEGACY_VERIFIER_KEY = 'songgussr-spotify-pkce'
const LEGACY_STATE_KEY = 'songgussr-spotify-state'

export const SPOTIFY_SCOPES = ['streaming', 'user-read-email', 'user-read-private'].join(' ')

export interface SpotifySession {
  accessToken: string
  refreshToken: string
  expiresAt: number
  isPremium: boolean
  displayName?: string
}

export function getRedirectUri(): string {
  return `${window.location.origin}/`
}

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '')
}

export function createCodeVerifier(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '')
}

export async function createCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return base64UrlEncode(digest)
}

export function saveCodeVerifier(verifier: string) {
  sessionStorage.setItem(VERIFIER_KEY, verifier)
}

export function loadCodeVerifier(): string | null {
  return readMigratedItem(sessionStorage, VERIFIER_KEY, [LEGACY_VERIFIER_KEY])
}

export function clearCodeVerifier() {
  removeMigratedItem(sessionStorage, VERIFIER_KEY, [LEGACY_VERIFIER_KEY])
}

export function loadSpotifySession(): SpotifySession | null {
  if (sessionCache !== undefined) return sessionCache

  try {
    const raw = readMigratedItem(localStorage, STORAGE_KEY, [LEGACY_STORAGE_KEY])
    if (!raw) {
      sessionCache = null
      return null
    }
    const parsed = JSON.parse(raw) as SpotifySession
    if (!parsed.accessToken || !parsed.refreshToken) {
      sessionCache = null
      return null
    }
    sessionCache = parsed
    return parsed
  } catch {
    sessionCache = null
    return null
  }
}

export function saveSpotifySession(session: SpotifySession) {
  sessionCache = session
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

export function clearSpotifySession() {
  sessionCache = null
  removeMigratedItem(localStorage, STORAGE_KEY, [LEGACY_STORAGE_KEY])
}

export async function fetchSpotifyConfig(): Promise<{ clientId: string }> {
  const response = await fetch('/api/spotify/config')
  if (!response.ok) throw new Error('Spotify is not configured on this server.')
  return response.json() as Promise<{ clientId: string }>
}

export async function buildAuthorizeUrl(clientId: string): Promise<string> {
  const verifier = createCodeVerifier()
  saveCodeVerifier(verifier)
  const challenge = await createCodeChallenge(verifier)
  const state = crypto.randomUUID()
  sessionStorage.setItem(STATE_KEY, state)

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: getRedirectUri(),
    code_challenge_method: 'S256',
    code_challenge: challenge,
    scope: SPOTIFY_SCOPES,
    state,
  })

  return `https://accounts.spotify.com/authorize?${params.toString()}`
}

export async function exchangeAuthCode(code: string): Promise<SpotifySession> {
  const verifier = loadCodeVerifier()
  if (!verifier) throw new Error('Missing login session. Try connecting again.')

  const response = await fetch('/api/spotify/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      codeVerifier: verifier,
      redirectUri: getRedirectUri(),
    }),
  })

  const data = (await response.json()) as SpotifySession & { message?: string; error?: string }
  if (!response.ok) {
    throw new Error(data.message ?? data.error ?? 'Spotify login failed')
  }

  clearCodeVerifier()
  saveSpotifySession(data)
  return data
}

export async function refreshSpotifySession(session: SpotifySession): Promise<SpotifySession> {
  const response = await fetch('/api/spotify/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: session.refreshToken }),
  })

  const data = (await response.json()) as SpotifySession & { message?: string; error?: string }
  if (!response.ok) {
    throw new Error(data.message ?? data.error ?? 'Spotify session expired')
  }

  saveSpotifySession(data)
  return data
}

export async function getValidAccessToken(): Promise<string | null> {
  let session = loadSpotifySession()
  if (!session) return null

  if (Date.now() >= session.expiresAt - 60_000) {
    try {
      session = await refreshSpotifySession(session)
    } catch {
      clearSpotifySession()
      return null
    }
  }

  return session.accessToken
}

export async function handleSpotifyOAuthCallback(): Promise<SpotifySession | null> {
  const url = new URL(window.location.href)
  const code = url.searchParams.get('code')
  const error = url.searchParams.get('error')
  if (!code && !error) return null

  const savedState = readMigratedItem(sessionStorage, STATE_KEY, [LEGACY_STATE_KEY])
  const returnedState = url.searchParams.get('state')
  removeMigratedItem(sessionStorage, STATE_KEY, [LEGACY_STATE_KEY])

  if (error) {
    url.searchParams.delete('error')
    window.history.replaceState({}, '', url.pathname)
    throw new Error(`Spotify login cancelled: ${error}`)
  }

  if (savedState && returnedState && savedState !== returnedState) {
    url.searchParams.delete('code')
    url.searchParams.delete('state')
    window.history.replaceState({}, '', url.pathname)
    throw new Error('Spotify login state mismatch. Try connecting again.')
  }

  const session = await exchangeAuthCode(code!)
  url.searchParams.delete('code')
  url.searchParams.delete('state')
  window.history.replaceState({}, '', url.pathname)
  return session
}
