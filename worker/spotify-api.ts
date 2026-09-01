import type { SpotifyTrackRef } from './opm-artists'

const MARKET = 'PH'

export async function getSpotifyClientCredentialsToken(
  clientId: string,
  clientSecret: string,
): Promise<string> {
  const body = new URLSearchParams({ grant_type: 'client_credentials' })
  const auth = btoa(`${clientId}:${clientSecret}`)

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })

  if (!response.ok) {
    throw new Error(`Spotify auth failed: ${response.status} ${await response.text()}`)
  }

  const data = (await response.json()) as { access_token: string }
  return data.access_token
}

export async function searchSpotifyTracks(
  token: string,
  query: string,
  limit = 20,
): Promise<SpotifyTrackRef[]> {
  const url = new URL('https://api.spotify.com/v1/search')
  url.searchParams.set('q', query)
  url.searchParams.set('type', 'track')
  url.searchParams.set('market', MARKET)
  url.searchParams.set('limit', String(Math.min(limit, 50)))

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!response.ok) {
    throw new Error(`Spotify search failed: ${response.status} ${await response.text()}`)
  }

  const data = (await response.json()) as { tracks?: { items?: SpotifyTrackRef[] } }
  return data.tracks?.items ?? []
}

export async function spotifyApiGet(
  token: string,
  path: string,
  params: Record<string, string | number | undefined> = {},
): Promise<unknown> {
  const url = new URL(`https://api.spotify.com/v1/${path}`)
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value))
    }
  }

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!response.ok) {
    const body = await response.text()
    const error = new Error(`Spotify GET ${path} failed: ${response.status} ${body.slice(0, 200)}`)
    ;(error as Error & { status?: number }).status = response.status
    throw error
  }

  return response.json()
}

export async function fetchSpotifyTrack(
  token: string,
  trackId: string,
): Promise<SpotifyTrackRef | null> {
  const url = new URL(`https://api.spotify.com/v1/tracks/${trackId}`)
  url.searchParams.set('market', MARKET)

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (response.status === 404) return null
  if (!response.ok) {
    throw new Error(`Spotify track fetch failed: ${response.status} ${await response.text()}`)
  }

  return (await response.json()) as SpotifyTrackRef
}
