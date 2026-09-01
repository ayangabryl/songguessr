import { Hono } from 'hono'
import {
  CATALOG_R2_KEY,
  loadCheckpointFromR2,
} from './catalog-r2'
import { CatalogUnavailableError, searchCatalog } from './catalog'
import {
  addTrackToCatalog,
  findExistingTrackIds,
  getCatalogStats,
  listCatalogPage,
  MAX_CATALOG_TRACKS,
  removeTrackFromCatalog,
} from './catalog-d1'
import { syncSpotifyMetrics } from './spotify-sync'
import {
  ERA_OPTIONS,
  GENRE_OPTIONS,
  type EraFilter,
  type GenreFilter,
} from './filters'
import { createCatalogJob, getCatalogJob, updateCatalogJob } from './jobs'
import { isOpmSpotifyTrack, UNIQUE_OPM_ARTISTS } from './opm-artists'
import { importPlaylistToCatalog } from './playlist-import'
import { parseSpotifyPlaylistId } from './playlist-source'
import { backfillMissingAlbumArt } from './album-art'
import { fetchSpotifyTrack, getSpotifyClientCredentialsToken, searchSpotifyTracks } from './spotify-api'
import { runCatalogBuild } from './catalog-builder'
import { buildTrackFromSpotify } from './track-builder'
import type { Difficulty, Env } from './types'

const ADMIN_HOSTS = new Set([
  'admin.songguessr.lol',
  'admin.songguessr.ayangabryl.workers.dev',
  'admin.songguessr.localhost',
])

const SESSION_COOKIE = 'songguessr_admin'
const LEGACY_SESSION_COOKIE = 'songgussr_admin'
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000
const CRON_SCHEDULE = '0 */6 * * *'
const ADMIN_HOSTNAME = 'admin.songguessr.lol'
const APEX_HOSTS = new Set(['songguessr.lol', 'www.songguessr.lol'])
const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'expert', 'impossible']

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

function isSongguessrHost(hostname: string): boolean {
  return hostname === 'songguessr.lol' || hostname.endsWith('.songguessr.lol')
}

function cookieBase(hostname: string, path: string): string {
  const domain = isSongguessrHost(hostname) ? 'Domain=.songguessr.lol; ' : ''
  return `${domain}Path=${path}; HttpOnly; Secure; SameSite=Lax`
}

function sessionCookieOptions(hostname: string): string {
  return `${cookieBase(hostname, '/')}; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`
}

function expiredCookie(name: string, hostname: string, path: string): string {
  return `${name}=; ${cookieBase(hostname, path)}; Max-Age=0`
}

function appendClearedSessionCookies(response: Response, hostname: string): void {
  const paths = ['/', '/admin']
  for (const path of paths) {
    response.headers.append('Set-Cookie', expiredCookie(SESSION_COOKIE, hostname, path))
    response.headers.append('Set-Cookie', expiredCookie(LEGACY_SESSION_COOKIE, hostname, path))
  }
}

function shouldRedirectApexAdmin(url: URL): boolean {
  if (!APEX_HOSTS.has(url.hostname)) return false
  if (!url.pathname.startsWith('/admin')) return false
  return !url.pathname.startsWith('/admin/api')
}

function redirectToAdminSubdomain(url: URL): Response {
  const dest = new URL(url.toString())
  dest.protocol = 'https:'
  dest.hostname = ADMIN_HOSTNAME
  dest.pathname = url.pathname.replace(/^\/admin\/?/, '/') || '/'
  if (!dest.pathname.startsWith('/')) dest.pathname = `/${dest.pathname}`
  return Response.redirect(dest.toString(), 302)
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

function parseListDifficulty(value: string | undefined): Difficulty | undefined {
  if (value && DIFFICULTIES.includes(value as Difficulty)) {
    return value as Difficulty
  }
  return undefined
}

function parseListGenre(value: string | undefined): GenreFilter | undefined {
  if (value && GENRE_OPTIONS.includes(value as GenreFilter)) {
    return value as GenreFilter
  }
  return undefined
}

function parseListEra(value: string | undefined): EraFilter | undefined {
  if (value && ERA_OPTIONS.includes(value as EraFilter)) {
    return value as EraFilter
  }
  return undefined
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

    const hostname = new URL(c.req.url).hostname
    const response = c.json({ ok: true })
    response.headers.append(
      'Set-Cookie',
      `${SESSION_COOKIE}=${token}; ${sessionCookieOptions(hostname)}`,
    )
    return response
  })

  admin.post('/admin/api/spotify/sync', async (c) => {
    const cookieOk = await hasValidAdminSession(c.req.raw, c.env)
    const body = await c.req.json<{ password?: string }>().catch(() => ({ password: undefined }))
    const passwordOk = body.password?.trim() === getAdminPassword(c.env)

    if (!cookieOk && !passwordOk) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    try {
      const result = await syncSpotifyMetrics(c.env)
      return c.json({
        ok: true,
        message: result.skipped
          ? `Spotify sync skipped${result.reason ? `: ${result.reason}` : ''}`
          : `Synced ${result.updated} tracks from Spotify IDs`,
        ...result,
      })
    } catch (error) {
      return c.json(
        {
          ok: false,
          message: 'Spotify sync failed',
          updated: 0,
          tracks: 0,
          rateLimited: false,
          errors: [error instanceof Error ? error.message : 'Spotify sync failed'],
          error: error instanceof Error ? error.message : 'Spotify sync failed',
        },
        500,
      )
    }
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
    appendClearedSessionCookies(response, hostname)
    return response
  })

  admin.use('/admin/api/*', async (c, next) => {
    if (
      c.req.path === '/admin/api/login' ||
      c.req.path === '/admin/api/cron/trigger' ||
      c.req.path === '/admin/api/spotify/sync'
    ) {
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
    let spotifySyncedAt: string | null = null
    let catalogError: string | null = null

    try {
      const stats = await getCatalogStats(c.env)
      catalogOk = stats.count > 0
      trackCount = stats.count
      updatedAt = stats.updatedAt
      spotifySyncedAt = stats.spotifySyncedAt
      if (!catalogOk) catalogError = 'Catalog not found in D1'
    } catch (error) {
      catalogError = error instanceof Error ? error.message : 'Catalog unavailable'
    }

    return c.json({
      ok: catalogOk,
      health: catalogOk ? 'healthy' : 'degraded',
      tracks: trackCount,
      catalogCap: MAX_CATALOG_TRACKS,
      updatedAt,
      spotifySyncedAt,
      source: 'd1',
      r2UpdatedAt: catalogObject?.uploaded?.toISOString() ?? null,
      artistsDone: checkpoint.completedArtists.size,
      artistsTotal: UNIQUE_OPM_ARTISTS.length,
      playlistSyncedAt: checkpoint.playlistSyncedAt ?? null,
      genreSyncedAt: checkpoint.genreSyncedAt ?? null,
      genreSource: checkpoint.genreSource ?? null,
      genrePlaylistCursor: checkpoint.genrePlaylistCursor ?? 0,
      cronSchedule: CRON_SCHEDULE,
      cronDescription: 'Every 6 hours (UTC): sync Spotify popularity/artist metrics and recompute difficulty',
      nextCronEstimate: estimateNextCronRun(),
      catalogError,
    })
  })

  admin.get('/admin/api/catalog', async (c) => {
    try {
      const page = Number(c.req.query('page') ?? '1')
      const pageSize = Number(c.req.query('pageSize') ?? '50')
      const query = c.req.query('q') ?? c.req.query('search') ?? ''
      const filters = {
        difficulty: parseListDifficulty(c.req.query('difficulty')),
        genre: parseListGenre(c.req.query('genre')),
        era: parseListEra(c.req.query('era')),
        missingPreview:
          c.req.query('missingPreview') === '1' || c.req.query('missingPreview') === 'true',
      }

      return c.json(await listCatalogPage(c.env, page, pageSize, query, filters))
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

    const existingIds = await findExistingTrackIds(
      c.env,
      tracks.map((track) => track.id).filter((id): id is string => Boolean(id)),
    )

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

    const result = await addTrackToCatalog(c.env, built.track)
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
    if (!parseSpotifyPlaylistId(playlistUrl)) {
      return c.json({ error: 'Invalid Spotify playlist URL or ID' }, 400)
    }

    const jobId = createCatalogJob()
    const run = runPlaylistImportJob(c.env, jobId, playlistUrl)
    try {
      c.executionCtx.waitUntil(run)
    } catch {
      await run
    }

    return c.json({ jobId })
  })

  admin.post('/admin/api/catalog/backfill-art', async (c) => {
    const result = await backfillMissingAlbumArt(c.env)
    return c.json({ ok: true, ...result })
  })

  admin.get('/admin/api/jobs/:id', (c) => {
    const job = getCatalogJob(c.req.param('id'))
    if (!job) {
      return c.json({ error: 'Job not found' }, 404)
    }
    return c.json(job)
  })

  admin.delete('/admin/api/catalog/:trackId', async (c) => {
    const trackId = c.req.param('trackId')
    const result = await removeTrackFromCatalog(c.env, trackId)
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
    if (path.startsWith('/admin/assets/')) {
      return serveAdminAsset(c.env, path)
    }
    return serveAdminAsset(c.env, '/admin/index.html')
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

async function runPlaylistImportJob(env: Env, jobId: string, playlistUrl: string): Promise<void> {
  updateCatalogJob(jobId, { status: 'running', phase: 'fetching' })
  try {
    const result = await importPlaylistToCatalog(env, playlistUrl, (progress) => {
      updateCatalogJob(jobId, {
        status: 'running',
        phase: progress.phase,
        processed: progress.processed,
        total: progress.total,
        added: progress.added,
        skipped: progress.skipped,
        playlistName: progress.playlistName,
      })
    })
    updateCatalogJob(jobId, {
      status: 'done',
      phase: 'done',
      added: result.added,
      skipped: result.skippedExisting + result.skippedNonOpm + result.skippedNoPreview,
      processed: result.fetched,
      total: result.fetched,
      playlistName: result.playlistName,
      skippedExisting: result.skippedExisting,
      skippedNonOpm: result.skippedNonOpm,
      skippedNoPreview: result.skippedNoPreview,
      errors: result.errors,
      source: result.source,
      fetched: result.fetched,
    })
  } catch (error) {
    updateCatalogJob(jobId, {
      status: 'error',
      phase: 'error',
      error: error instanceof Error ? error.message : 'Playlist import failed',
    })
  }
}

export async function handleAdminRequest(
  request: Request,
  env: Env,
  adminApp: Hono<{ Bindings: Env }>,
  ctx?: ExecutionContext,
): Promise<Response | null> {
  const url = new URL(request.url)
  if (shouldRedirectApexAdmin(url)) {
    return redirectToAdminSubdomain(url)
  }
  if (!isAdminRequest(url)) return null

  const rewritten = rewriteAdminRequest(request)
  const response = await adminApp.fetch(rewritten, env, ctx)

  if (response.status !== 404) return response

  const path = new URL(rewritten.url).pathname
  if (path.startsWith('/admin/api/')) return response
  if (path.startsWith('/admin')) {
    return serveAdminAsset(env, '/admin/index.html')
  }

  return response
}
