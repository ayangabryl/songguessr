import { Hono } from 'hono'
import {
  addTrackToCatalog,
  CATALOG_R2_KEY,
  getCachedCatalog,
  loadCheckpointFromR2,
  MAX_CATALOG_TRACKS,
  removeTrackFromCatalog,
} from './catalog-r2'
import { CatalogUnavailableError, getCatalog, searchCatalog } from './catalog'
import { isOpmSpotifyTrack, UNIQUE_OPM_ARTISTS } from './opm-artists'
import { fetchSpotifyTrack, getSpotifyClientCredentialsToken, searchSpotifyTracks } from './spotify-api'
import { runCatalogBuild } from './catalog-builder'
import { importPlaylistToCatalog } from './playlist-import'
import { buildTrackFromSpotify } from './track-builder'
import type { Env, Track } from './types'

const ADMIN_HOSTS = new Set([
  'admin.songguessr.ayangabryl.workers.dev',
  'admin.songguessr.localhost',
])

const SESSION_COOKIE = 'songguessr_admin'
const LEGACY_SESSION_COOKIE = 'songgussr_admin'
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000
const CRON_SCHEDULE = '0 */6 * * *'

export function isAdminHost(hostname: string): boolean {
  return ADMIN_HOSTS.has(hostname) || hostname.startsWith('admin.')
}

export function isAdminRequest(url: URL): boolean {
  return isAdminHost(url.hostname) || url.pathname.startsWith('/admin')
}

function getAdminPassword(env: Env): string {
  return env.ADMIN_PASSWORD?.trim() || 'wizard123'
}

function normalizeAdminPath(pathname: string, hostname: string): string {
  if (!isAdminHost(hostname)) return pathname

  if (pathname === '/' || pathname === '') return '/admin'
  if (pathname.startsWith('/admin')) return pathname
  if (pathname.startsWith('/api/')) return `/admin${pathname}`
  if (pathname.startsWith('/assets/')) return `/admin${pathname}`
  return `/admin${pathname}`
}

export function rewriteAdminRequest(request: Request): Request {
  const url = new URL(request.url)
  const normalizedPath = normalizeAdminPath(url.pathname, url.hostname)
  if (normalizedPath === url.pathname) return request

  const nextUrl = new URL(request.url)
  nextUrl.pathname = normalizedPath
  return new Request(nextUrl, request)
}

async function signSession(secret: string, expiresAt: number): Promise<string> {
  const payload = String(expiresAt)
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  const sig = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  return `${payload}.${sig}`
}

async function verifySession(secret: string, token: string): Promise<boolean> {
  const [payload, signature] = token.split('.')
  if (!payload || !signature) return false

  const expiresAt = Number(payload)
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false

  const expected = await signSession(secret, expiresAt)
  const [, expectedSig] = expected.split('.')
  return signature === expectedSig
}

function readSessionCookie(request: Request): string | null {
  const cookieHeader = request.headers.get('Cookie')
  if (!cookieHeader) return null

  let legacyValue: string | null = null
  for (const part of cookieHeader.split(';')) {
    const [name, ...rest] = part.trim().split('=')
    const value = decodeURIComponent(rest.join('='))
    if (name === SESSION_COOKIE) return value
    if (name === LEGACY_SESSION_COOKIE) legacyValue = value
  }
  return legacyValue
}

async function hasValidAdminSession(request: Request, env: Env): Promise<boolean> {
  const token = readSessionCookie(request)
  if (!token) return false
  return verifySession(getAdminPassword(env), token)
}

function sessionCookieOptions(hostname: string): string {
  const path = isAdminHost(hostname) ? '/' : '/admin'
  return `Path=${path}; HttpOnly; Secure; SameSite=Strict; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`
}

function clearSessionCookie(hostname: string): string {
  const path = isAdminHost(hostname) ? '/' : '/admin'
  return `${SESSION_COOKIE}=; Path=${path}; HttpOnly; Secure; SameSite=Strict; Max-Age=0`
}

function clearLegacySessionCookie(hostname: string): string {
  const path = isAdminHost(hostname) ? '/' : '/admin'
  return `${LEGACY_SESSION_COOKIE}=; Path=${path}; HttpOnly; Secure; SameSite=Strict; Max-Age=0`
}

function estimateNextCronRun(): string {
  const now = new Date()
  const next = new Date(now)
  next.setUTCMinutes(0, 0, 0)

  let hour = next.getUTCHours()
  const remainder = hour % 6
  if (remainder !== 0 || now.getUTCMinutes() > 0 || now.getUTCSeconds() > 0) {
    hour += 6 - remainder
  }

  if (hour >= 24) {
    next.setUTCDate(next.getUTCDate() + 1)
    next.setUTCHours(0)
  } else {
    next.setUTCHours(hour)
  }

  return next.toISOString()
}

function paginateTracks(tracks: Track[], page: number, pageSize: number, query: string) {
  const normalized = query.trim().toLowerCase()
  const filtered = normalized
    ? tracks.filter((track) => {
        const haystack = `${track.title} ${track.artist} ${track.id}`.toLowerCase()
        return haystack.includes(normalized)
      })
    : tracks

  const sorted = [...filtered].sort((left, right) => left.title.localeCompare(right.title))
  const total = sorted.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(Math.max(page, 1), totalPages)
  const start = (safePage - 1) * pageSize

  return {
    tracks: sorted.slice(start, start + pageSize).map((track) => ({
      id: track.id,
      title: track.title,
      artist: track.artist,
      difficulty: track.difficulty,
      releaseYear: track.releaseYear,
      albumArt: track.albumArt,
      hasPreview: Boolean(track.previewUrl),
    })),
    page: safePage,
    pageSize,
    total,
    totalPages,
  }
}

export function createAdminApp(): Hono<{ Bindings: Env }> {
  const admin = new Hono<{ Bindings: Env }>()

  admin.post('/admin/api/login', async (c) => {
    const body = await c.req.json<{ password?: string }>().catch(() => ({ password: undefined }))
    const password = body.password?.trim() ?? ''

    if (password !== getAdminPassword(c.env)) {
      return c.json({ error: 'Invalid password' }, 401)
    }

    const expiresAt = Date.now() + SESSION_TTL_MS
    const token = await signSession(getAdminPassword(c.env), expiresAt)

    const response = c.json({ ok: true })
    response.headers.append('Set-Cookie', `${SESSION_COOKIE}=${token}; ${sessionCookieOptions(new URL(c.req.url).hostname)}`)
    return response
  })

  admin.post('/admin/api/cron/trigger', async (c) => {
    const cookieOk = await hasValidAdminSession(c.req.raw, c.env)
    const body = await c.req.json<{ password?: string }>().catch(() => ({ password: undefined }))
    const passwordOk = body.password?.trim() === getAdminPassword(c.env)

    if (!cookieOk && !passwordOk) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    try {
      const resultPromise = runCatalogBuild(c.env)
      try {
        c.executionCtx.waitUntil(
          resultPromise.then(
            (result) => {
              console.log('[admin] cron trigger finished', result)
            },
            (error) => {
              console.error('[admin] cron trigger failed', error)
            },
          ),
        )
      } catch {
        // Some admin hosts have no ExecutionContext; awaiting the build is enough.
      }
      const result = await resultPromise
      return c.json({
        ok: true,
        message: result.skipped
          ? `Catalog build skipped${result.reason ? `: ${result.reason}` : ''}`
          : 'Catalog build cron completed',
        tracksAdded: result.tracksAdded,
        rateLimited: result.rateLimited,
        errors: result.errors,
        ...result,
        tracks: result.totalTracks,
      })
    } catch (error) {
      return c.json(
        {
          ok: false,
          message: 'Catalog build cron failed',
          tracksAdded: 0,
          rateLimited: false,
          errors: [error instanceof Error ? error.message : 'Catalog build failed'],
          error: error instanceof Error ? error.message : 'Catalog build failed',
        },
        500,
      )
    }
  })

  admin.post('/admin/api/logout', (c) => {
    const hostname = new URL(c.req.url).hostname
    const response = c.json({ ok: true })
    response.headers.append('Set-Cookie', clearSessionCookie(hostname))
    response.headers.append('Set-Cookie', clearLegacySessionCookie(hostname))
    return response
  })

  admin.use('/admin/api/*', async (c, next) => {
    if (c.req.path === '/admin/api/login' || c.req.path === '/admin/api/cron/trigger') {
      await next()
      return
    }

    const token = readSessionCookie(c.req.raw)
    if (!token || !(await verifySession(getAdminPassword(c.env), token))) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    await next()
  })

  admin.get('/admin/api/status', async (c) => {
    const checkpoint = await loadCheckpointFromR2(c.env.AUDIO_BUCKET)
    const catalogObject = await c.env.AUDIO_BUCKET.head(CATALOG_R2_KEY)

    let catalogOk = false
    let trackCount = 0
    let updatedAt: string | null = null
    let catalogError: string | null = null

    try {
      const catalog = await getCatalog(c.env)
      catalogOk = true
      trackCount = catalog.tracks.length
      updatedAt = catalog.updatedAt
    } catch (error) {
      catalogError = error instanceof Error ? error.message : 'Catalog unavailable'
    }

    return c.json({
      ok: catalogOk,
      health: catalogOk ? 'healthy' : 'degraded',
      tracks: trackCount,
      catalogCap: MAX_CATALOG_TRACKS,
      updatedAt,
      r2UpdatedAt: catalogObject?.uploaded?.toISOString() ?? null,
      artistsDone: checkpoint.completedArtists.size,
      artistsTotal: UNIQUE_OPM_ARTISTS.length,
      playlistSyncedAt: checkpoint.playlistSyncedAt ?? null,
      genreSyncedAt: checkpoint.genreSyncedAt ?? null,
      genreSource: checkpoint.genreSource ?? null,
      genrePlaylistCursor: checkpoint.genrePlaylistCursor ?? 0,
      cronSchedule: CRON_SCHEDULE,
      cronDescription: 'Every 6 hours (UTC): artist backlog first, then genre playlists',
      nextCronEstimate: estimateNextCronRun(),
      catalogError,
    })
  })

  admin.get('/admin/api/catalog', async (c) => {
    try {
      const catalog = await getCatalog(c.env)
      const page = Number(c.req.query('page') ?? '1')
      const pageSize = Number(c.req.query('pageSize') ?? '50')
      const query = c.req.query('q') ?? c.req.query('search') ?? ''

      return c.json(paginateTracks(catalog.tracks, page, pageSize, query))
    } catch (error) {
      if (error instanceof CatalogUnavailableError) {
        return c.json({ error: error.message }, 503)
      }
      throw error
    }
  })

  admin.get('/admin/api/catalog/search', async (c) => {
    try {
      const query = c.req.query('q') ?? ''
      const results = await searchCatalog(c.env, query, 100)
      return c.json({
        results: results.map((track) => ({
          id: track.id,
          title: track.title,
          artist: track.artist,
          albumArt: track.albumArt,
          difficulty: track.difficulty,
        })),
      })
    } catch (error) {
      if (error instanceof CatalogUnavailableError) {
        return c.json({ error: error.message }, 503)
      }
      throw error
    }
  })

  admin.get('/admin/api/spotify/search', async (c) => {
    const clientId = c.env.SPOTIFY_CLIENT_ID
    const clientSecret = c.env.SPOTIFY_CLIENT_SECRET
    if (!clientId || !clientSecret) {
      return c.json({ error: 'Spotify is not configured' }, 503)
    }

    const query = c.req.query('q')?.trim() ?? ''
    if (!query) {
      return c.json({ results: [] })
    }

    const token = await getSpotifyClientCredentialsToken(clientId, clientSecret)
    const tracks = await searchSpotifyTracks(token, query)

    const existing = await getCachedCatalog(c.env.AUDIO_BUCKET)
    const existingIds = new Set(existing?.tracks.map((track) => track.id) ?? [])

    return c.json({
      results: tracks.map((track) => ({
        id: track.id,
        title: track.name ?? 'Unknown',
        artist: (track.artists ?? []).map((artist) => artist.name).join(', '),
        albumArt: track.album?.images?.[0]?.url ?? '',
        previewUrl: track.preview_url ?? null,
        isOpm: isOpmSpotifyTrack(track),
        inCatalog: track.id ? existingIds.has(track.id) : false,
      })),
    })
  })

  admin.post('/admin/api/catalog/add', async (c) => {
    const clientId = c.env.SPOTIFY_CLIENT_ID
    const clientSecret = c.env.SPOTIFY_CLIENT_SECRET
    if (!clientId || !clientSecret) {
      return c.json({ error: 'Spotify is not configured' }, 503)
    }

    const body = await c.req.json<{ trackId?: string }>()
    const trackId = body.trackId?.trim()
    if (!trackId) {
      return c.json({ error: 'trackId is required' }, 400)
    }

    const token = await getSpotifyClientCredentialsToken(clientId, clientSecret)
    const spotifyTrack = await fetchSpotifyTrack(token, trackId)
    if (!spotifyTrack) {
      return c.json({ error: 'Track not found on Spotify' }, 404)
    }

    const built = await buildTrackFromSpotify(spotifyTrack)
    if (!built.track) {
      return c.json({ error: built.reason ?? 'Could not add track' }, 400)
    }

    const result = await addTrackToCatalog(c.env.AUDIO_BUCKET, built.track)
    if (!result.ok) {
      return c.json({ error: result.reason ?? 'Could not add track' }, 409)
    }

    return c.json({
      ok: true,
      track: {
        id: built.track.id,
        title: built.track.title,
        artist: built.track.artist,
      },
      totalTracks: result.totalTracks,
    })
  })

  admin.post('/admin/api/catalog/playlist', async (c) => {
    const body = await c.req.json<{ playlistUrl?: string }>().catch(() => ({ playlistUrl: undefined }))
    const playlistUrl = body.playlistUrl?.trim() ?? ''
    if (!playlistUrl) {
      return c.json({ error: 'playlistUrl is required' }, 400)
    }

    try {
      const result = await importPlaylistToCatalog(c.env, playlistUrl)
      return c.json(result)
    } catch (error) {
      const status = (error as { status?: number }).status
      const message = error instanceof Error ? error.message : 'Playlist import failed'
      if (status === 400 || status === 503) {
        return c.json({ error: message }, status)
      }
      return c.json({ error: message }, 500)
    }
  })

  admin.delete('/admin/api/catalog/:trackId', async (c) => {
    const trackId = c.req.param('trackId')
    const result = await removeTrackFromCatalog(c.env.AUDIO_BUCKET, trackId)
    if (!result.ok) {
      return c.json({ error: result.reason ?? 'Could not remove track' }, 404)
    }
    return c.json({ ok: true, totalTracks: result.totalTracks })
  })

  admin.get('/admin', async (c) => serveAdminAsset(c.env, '/admin/index.html'))
  admin.get('/admin/', async (c) => serveAdminAsset(c.env, '/admin/index.html'))

  admin.get('/admin/*', async (c) => {
    const path = new URL(c.req.url).pathname
    if (path.startsWith('/admin/api/')) {
      return c.notFound()
    }
    return serveAdminAsset(c.env, path)
  })

  return admin
}

async function serveAdminAsset(env: Env, assetPath: string): Promise<Response> {
  if (!env.ASSETS) {
    return new Response('Admin assets not available', { status: 503 })
  }

  const url = new URL(`https://assets.local${assetPath}`)
  const response = await env.ASSETS.fetch(new Request(url))

  if (assetPath.endsWith('/index.html') || assetPath === '/admin/index.html') {
    if (!response.ok) return response
    const html = await response.text()
    return new Response(html, {
      status: response.status,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  }

  return response
}

export async function handleAdminRequest(
  request: Request,
  env: Env,
  adminApp: Hono<{ Bindings: Env }>,
  ctx?: ExecutionContext,
): Promise<Response | null> {
  const url = new URL(request.url)
  if (!isAdminRequest(url)) return null

  const rewritten = rewriteAdminRequest(request)
  const response = await adminApp.fetch(rewritten, env, ctx)

  if (response.status !== 404) return response

  const path = new URL(rewritten.url).pathname
  if (path.startsWith('/admin/') && !path.startsWith('/admin/api/')) {
    return serveAdminAsset(env, '/admin/index.html')
  }

  return response
}
