import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveR2Audio } from './audio'
import {
  CatalogUnavailableError,
  findTrackById,
  getAvailabilityCounts,
  pickRandomTrack,
  searchCatalog,
} from './catalog'
import { getCatalogStats, listCatalogCountries } from './catalog-d1'
import { listCatalogs } from './catalogs-d1'
import { GAME_REGIONS, isCountryCode } from '../shared/catalog-meta'
import { countryDisplayName } from '../shared/iso-countries'
import { songIdentityKey } from './track-dedupe.ts'
import {
  type CatalogFilters,
  type EraFilter,
  type GenreFilter,
  parseCountryFilters,
  parseEraFilters,
  parseGenreFilters,
  trackMatchesFilters,
} from './filters'
import { checkGuess } from './guess'
import { handleScheduled } from './scheduled'
import { createAdminApp, handleAdminRequest } from './admin'
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
    countries: parseCountryFilters(c.req.query('countries'), c.req.query('regions')),
  }
}

function parseCatalogFiltersFromBody(body: {
  eras?: string[]
  genres?: string[]
  countries?: string[]
  regions?: string[]
}): CatalogFilters {
  const countryValues = [...(body.countries ?? []), ...(body.regions ?? [])]
    .map((item) => item.trim().toUpperCase())
    .filter(isCountryCode)
  return {
    eras: (body.eras ?? []).filter((era): era is EraFilter =>
      (['modern', '2010s', '2000s', 'classics'] as const).includes(era as EraFilter),
    ),
    genres: (body.genres ?? []).filter((genre): genre is GenreFilter =>
      (['pop', 'hip-hop', 'r&b', 'rock', 'dance', 'other'] as const).includes(genre as GenreFilter),
    ),
    countries: [...new Set(countryValues)],
  }
}

const app = new Hono<{ Bindings: Env }>()
const adminApp = createAdminApp()
const APEX_HOSTNAME = 'songguessr.lol'

function redirectWwwToApex(request: Request): Response | null {
  const url = new URL(request.url)
  if (url.hostname !== `www.${APEX_HOSTNAME}`) return null
  url.hostname = APEX_HOSTNAME
  return Response.redirect(url.toString(), 301)
}

function catalogUnavailable(c: { json: (body: unknown, status?: number) => Response }, error: CatalogUnavailableError) {
  return c.json(
    {
      error: 'Catalog unavailable',
      message: error.message,
    },
    503,
  )
}

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

app.get('/api/health', async (c) => {
  try {
    const stats = await getCatalogStats(c.env)
    if (stats.count === 0) {
      return catalogUnavailable(c, new CatalogUnavailableError())
    }
    return c.json({
      ok: true,
      tracks: stats.count,
      updatedAt: stats.updatedAt,
      source: 'd1',
      spotifySyncedAt: stats.spotifySyncedAt,
    })
  } catch (error) {
    if (error instanceof CatalogUnavailableError) {
      return catalogUnavailable(c, error)
    }
    throw error
  }
})

app.get('/api/catalog/catalogs', async (c) => {
  try {
    const catalogs = await listCatalogs(c.env)
    return c.json({
      catalogs: catalogs.map((catalog) => ({
        id: catalog.id,
        name: catalog.name,
        emoji: catalog.emoji,
        country: catalog.country,
        trackCount: catalog.trackCount ?? 0,
      })),
    })
  } catch (error) {
    if (error instanceof CatalogUnavailableError) {
      return catalogUnavailable(c, error)
    }
    throw error
  }
})

app.get('/api/catalog/regions', async (c) => {
  try {
    const counts = await listCatalogCountries(c.env)
    const countByCountry = new Map(counts.map((row) => [row.country, row.count]))
    return c.json({
      regions: GAME_REGIONS.map((region) => ({
        ...region,
        label: countryDisplayName(region.country),
        count: countByCountry.get(region.country) ?? 0,
      })),
    })
  } catch (error) {
    if (error instanceof CatalogUnavailableError) {
      return catalogUnavailable(c, error)
    }
    throw error
  }
})

app.get('/api/catalog/availability', async (c) => {
  try {
    const filters = parseCatalogFilters(c)
    const counts = await getAvailabilityCounts(c.env, filters)
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0)

    return c.json({ counts, total })
  } catch (error) {
    if (error instanceof CatalogUnavailableError) {
      return catalogUnavailable(c, error)
    }
    throw error
  }
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

app.get('/api/random', async (c) => {
  try {
    const difficulty = parseDifficulty(c.req.query('difficulty'))
    const filters = parseCatalogFilters(c)
    const excludeIds = parseExcludeList(c.req.query('exclude'))
    const excludeSongKeys = parseExcludeList(c.req.query('excludeSongs'))
    const seed = c.req.query('seed') ?? crypto.randomUUID()
    const counts = await getAvailabilityCounts(c.env, filters)
    const poolSize = counts[difficulty]
    const track = await pickRandomTrack(
      c.env,
      difficulty,
      seed,
      filters,
      excludeIds,
      excludeSongKeys,
    )

    if (!track) {
      return c.json(
        {
          error: 'Catalogue error',
          message:
            'No songs match these filters for this difficulty. Try another difficulty or clear the region, era, and genre filters.',
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
  } catch (error) {
    if (error instanceof CatalogUnavailableError) {
      return catalogUnavailable(c, error)
    }
    throw error
  }
})

app.get('/api/search', async (c) => {
  try {
    const query = c.req.query('q') ?? ''
    const results = (await searchCatalog(c.env, query)).map((track) => ({
      id: track.id,
      title: track.title,
      artist: track.artist,
      albumArt: track.albumArt,
    }))

    return c.json({ results })
  } catch (error) {
    if (error instanceof CatalogUnavailableError) {
      return catalogUnavailable(c, error)
    }
    throw error
  }
})

async function resolveRoundTrack(
  env: Env,
  trackId: string | undefined,
  seed: string | undefined,
  difficulty: Difficulty,
  filters: CatalogFilters,
): Promise<Awaited<ReturnType<typeof findTrackById>>> {
  if (trackId) {
    const track = await findTrackById(env, trackId)
    if (
      track &&
      track.difficulty === difficulty &&
      trackMatchesFilters(track, filters)
    ) {
      return track
    }
  }

  return (await pickRandomTrack(env, difficulty, seed ?? '', filters)) ?? undefined
}

app.post('/api/guess', async (c) => {
  try {
    const body = await c.req.json<{
      trackId?: string
      guess?: string
      guessedTrackId?: string
      difficulty?: string
      seed?: string
      reveal?: boolean
      eras?: string[]
      genres?: string[]
      countries?: string[]
      regions?: string[]
    }>()

    const difficulty = parseDifficulty(body.difficulty)
    const reveal = body.reveal === true
    const filters = parseCatalogFiltersFromBody(body)
    const track = await resolveRoundTrack(c.env, body.trackId, body.seed, difficulty, filters)

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
  } catch (error) {
    if (error instanceof CatalogUnavailableError) {
      return catalogUnavailable(c, error)
    }
    throw error
  }
})

export default {
  fetch: async (request: Request, env: Env, ctx: ExecutionContext) => {
    const wwwRedirect = redirectWwwToApex(request)
    if (wwwRedirect) return wwwRedirect
    const adminResponse = await handleAdminRequest(request, env, adminApp, ctx)
    if (adminResponse) return adminResponse

    const response = await app.fetch(request, env, ctx)
    const pathname = new URL(request.url).pathname
    if (response.status !== 404 || pathname.startsWith('/api/') || !env.ASSETS) {
      return response
    }
    return env.ASSETS.fetch(request)
  },
  scheduled: handleScheduled,
}
