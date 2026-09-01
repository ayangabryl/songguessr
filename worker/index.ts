import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveR2Audio } from './audio'
import { getAvailabilityCounts, getCatalog, pickRandomTrack, searchCatalog } from './catalog'
import { songIdentityKey } from './track-dedupe.ts'
import { type CatalogFilters, type EraFilter, type GenreFilter, parseEraFilters, parseGenreFilters } from './filters'
import { checkGuess } from './guess'
import {
  exchangeSpotifyCode,
  fetchSpotifyProfile,
  refreshSpotifyToken,
} from './spotify-auth'
import type { Difficulty, Env } from './types'

export const DEFAULT_STAGES = [0.01, 0.1, 0.5, 2, 8, 15] as const

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'expert', 'impossible']

function parseDifficulty(value: string | undefined): Difficulty {
  if (value && DIFFICULTIES.includes(value as Difficulty)) {
    return value as Difficulty
  }
  return 'easy'
}

function parseCatalogFilters(c: { req: { query: (key: string) => string | undefined } }): CatalogFilters {
  return {
    eras: parseEraFilters(c.req.query('eras')),
    genres: parseGenreFilters(c.req.query('genres')),
  }
}

function parseCatalogFiltersFromBody(body: {
  eras?: string[]
  genres?: string[]
}): CatalogFilters {
  return {
    eras: (body.eras ?? []).filter((era): era is EraFilter =>
      (['modern', '2010s', '2000s', 'classics'] as const).includes(era as EraFilter),
    ),
    genres: (body.genres ?? []).filter((genre): genre is GenreFilter =>
      (['pop', 'hip-hop', 'r&b', 'rock', 'dance', 'other'] as const).includes(genre as GenreFilter),
    ),
  }
}

const app = new Hono<{ Bindings: Env }>()

app.use('/api/*', cors())

app.get('/api/audio/*', async (c) => {
  const key = c.req.path.replace(/^\/api\/audio\//, '')
  if (!key || key.includes('..')) {
    return c.text('Bad Request', 400)
  }
  return serveR2Audio(c.env.AUDIO_BUCKET, decodeURIComponent(key), c.req.raw)
})

app.get('/api/spotify/config', (c) => {
  const clientId = c.env.SPOTIFY_CLIENT_ID
  if (!clientId) {
    return c.json({ error: 'Spotify is not configured' }, 503)
  }
  return c.json({ clientId })
})

app.post('/api/spotify/token', async (c) => {
  const clientId = c.env.SPOTIFY_CLIENT_ID
  const clientSecret = c.env.SPOTIFY_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return c.json({ message: 'Spotify is not configured on this server.' }, 503)
  }

  const body = await c.req.json<{
    code?: string
    codeVerifier?: string
    redirectUri?: string
  }>()

  if (!body.code || !body.codeVerifier || !body.redirectUri) {
    return c.json({ message: 'Missing Spotify login parameters.' }, 400)
  }

  try {
    const tokens = await exchangeSpotifyCode(
      body.code,
      body.redirectUri,
      body.codeVerifier,
      clientId,
      clientSecret,
    )
    const profile = await fetchSpotifyProfile(tokens.access_token)
    if (!tokens.refresh_token) {
      return c.json({ message: 'Spotify did not return a refresh token.' }, 502)
    }

    return c.json({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + tokens.expires_in * 1000,
      isPremium: profile.product === 'premium',
      displayName: profile.display_name,
    })
  } catch (error) {
    return c.json(
      { message: error instanceof Error ? error.message : 'Spotify login failed' },
      502,
    )
  }
})

app.post('/api/spotify/refresh', async (c) => {
  const clientId = c.env.SPOTIFY_CLIENT_ID
  const clientSecret = c.env.SPOTIFY_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return c.json({ message: 'Spotify is not configured on this server.' }, 503)
  }

  const body = await c.req.json<{ refreshToken?: string }>()
  if (!body.refreshToken) {
    return c.json({ message: 'Missing refresh token.' }, 400)
  }

  try {
    const tokens = await refreshSpotifyToken(body.refreshToken, clientId, clientSecret)
    const profile = await fetchSpotifyProfile(tokens.access_token)

    return c.json({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? body.refreshToken,
      expiresAt: Date.now() + tokens.expires_in * 1000,
      isPremium: profile.product === 'premium',
      displayName: profile.display_name,
    })
  } catch (error) {
    return c.json(
      { message: error instanceof Error ? error.message : 'Spotify refresh failed' },
      502,
    )
  }
})

app.get('/api/health', (c) => {
  const catalog = getCatalog()
  return c.json({
    ok: true,
    tracks: catalog.tracks.length,
    updatedAt: catalog.updatedAt,
  })
})

app.get('/api/catalog/availability', (c) => {
  const filters = parseCatalogFilters(c)
  const counts = getAvailabilityCounts(filters)
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0)

  return c.json({ counts, total })
})

function parseExcludeList(value: string | undefined): Set<string> {
  if (!value?.trim()) return new Set()
  return new Set(
    value
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0),
  )
}

app.get('/api/random', (c) => {
  const difficulty = parseDifficulty(c.req.query('difficulty'))
  const filters = parseCatalogFilters(c)
  const excludeIds = parseExcludeList(c.req.query('exclude'))
  const excludeSongKeys = parseExcludeList(c.req.query('excludeSongs'))
  const seed = c.req.query('seed') ?? crypto.randomUUID()
  const poolSize = getAvailabilityCounts(filters)[difficulty]
  const track = pickRandomTrack(difficulty, seed, filters, excludeIds, excludeSongKeys)

  if (!track) {
    return c.json(
      {
        error: 'Catalogue error',
        message:
          'No songs match these filters for this difficulty. Try another difficulty or clear the era and genre filters.',
      },
      404,
    )
  }

  c.header('Cache-Control', 'no-store')

  return c.json({
    seed,
    difficulty,
    trackId: track.id,
    songKey: songIdentityKey(track),
    previewUrl: track.previewUrl,
    hookPreviewUrl: track.hookPreviewUrl,
    hookStartSeconds: track.hookStartSeconds ?? 12,
    audioUrl: track.audioUrl,
    introClipUrl: track.introClipUrl,
    hookClipUrl: track.hookClipUrl,
    startAtMs: track.startAtMs,
    hookStartMs: track.hookStartMs,
    albumArt: track.albumArt,
    stages: DEFAULT_STAGES,
    poolSize,
  })
})

app.get('/api/search', (c) => {
  const query = c.req.query('q') ?? ''
  const results = searchCatalog(query).map((track) => ({
    id: track.id,
    title: track.title,
    artist: track.artist,
    albumArt: track.albumArt,
  }))

  return c.json({ results })
})

app.post('/api/guess', async (c) => {
  const body = await c.req.json<{
    guess?: string
    guessedTrackId?: string
    difficulty?: string
    seed?: string
    reveal?: boolean
    eras?: string[]
    genres?: string[]
  }>()

  const difficulty = parseDifficulty(body.difficulty)
  const reveal = body.reveal === true
  const filters = parseCatalogFiltersFromBody(body)
  const track = pickRandomTrack(difficulty, body.seed ?? '', filters)

  if (!track) {
    return c.json({ error: 'Track not found' }, 404)
  }

  let correct = false

  if (body.guessedTrackId) {
    correct = body.guessedTrackId === track.id
  } else {
    const guess = body.guess?.trim() ?? ''
    correct = checkGuess(guess, track.title, track.artist).correct
  }

  const shouldReveal = reveal || correct

  return c.json({
    correct,
    answer: shouldReveal
      ? {
          id: track.id,
          title: track.title,
          artist: track.artist,
          albumArt: track.albumArt,
        }
      : null,
  })
})

export default app
