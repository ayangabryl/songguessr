import {
  applyOembedPatches,
  applyTrackMetricPatches,
  getCatalogStats,
  getDifficultyDistribution,
  listTrackIds,
  type TrackMetricsPatch,
} from './catalog-d1'
import { assignDifficultyFromMetrics, parseReleaseYear } from './difficulty'
import type { SpotifyArtistRef, SpotifyTrackRef } from './opm-artists'
import { getSpotifyClientCredentialsToken } from './spotify-api'
import type { Difficulty, Env } from './types'

const TRACK_BATCH_SIZE = 50
const ARTIST_BATCH_SIZE = 50
const API_DELAY_MS = 150
const RATE_LIMIT_BASE_DELAY_SECONDS = 2
const RATE_LIMIT_MAX_WAIT_SECONDS = 45
const TRANSIENT_ERROR_MAX_ATTEMPTS = 5
const CRON_TIME_BUDGET_MS = 4 * 60 * 1000
const EMBED_SAMPLE_SIZE = 3
const EMBED_CONCURRENCY = 4
const EMBED_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

export const SPOTIFY_SYNC_RESULT_R2_KEY = 'catalog/spotify-sync-result.json'

export type SpotifySyncSource = 'web-api' | 'embed' | 'mixed' | 'none'

export interface SpotifySyncResult {
  skipped: boolean
  reason?: string
  updated: number
  tracks: number
  popularityFilled: number
  popularityMissing: number
  source: SpotifySyncSource
  distribution: Record<Difficulty, number>
  rateLimited: boolean
  errors: string[]
  at: string
  message: string
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms))
}

function emptyDistribution(): Record<Difficulty, number> {
  return {
    easy: 0,
    medium: 0,
    hard: 0,
    expert: 0,
    impossible: 0,
  }
}

function describeSource(source: SpotifySyncSource): string {
  switch (source) {
    case 'web-api':
      return 'GET /v1/tracks?ids='
    case 'embed':
      return 'Spotify embed page'
    case 'mixed':
      return 'Web API + embed fallback'
    case 'none':
      return 'no source'
    default: {
      const _never: never = source
      return _never
    }
  }
}

function describeSync(result: Omit<SpotifySyncResult, 'message'>): string {
  if (result.skipped) {
    return `Spotify sync skipped${result.reason ? `: ${result.reason}` : ''}`
  }
  const filled = `Filled ${result.popularityFilled} of ${result.tracks} tracks with Spotify popularity (${describeSource(result.source)})`
  if (result.popularityFilled === 0 && result.rateLimited) {
    return `${filled}. Web API returned 429 QUOTA_EXCEEDED; embed HTML has no popularity. Retry after the rate-limit window.`
  }
  return filled
}

function statusOf(error: unknown): number | undefined {
  return (error as { status?: number } | undefined)?.status
}

class IdOnlySpotifyClient {
  private lastRequestAt = 0
  private consecutiveRateLimits = 0
  rateLimited = false
  /** Some Spotify apps 403 the batch `?ids=` routes; fall back to per-id GETs. */
  private batchForbidden = false

  constructor(
    private readonly token: string,
    private readonly log: (message: string) => void,
  ) {}

  private async throttle(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestAt
    if (elapsed < API_DELAY_MS) {
      await sleep(API_DELAY_MS - elapsed)
    }
    this.lastRequestAt = Date.now()
  }

  private parseRetryAfterSeconds(response: Response, rateLimitAttempt: number): number {
    const header = response.headers.get('retry-after')
    if (header) {
      const seconds = Number(header)
      if (Number.isFinite(seconds) && seconds > 0) return seconds
    }
    return RATE_LIMIT_BASE_DELAY_SECONDS * 2 ** rateLimitAttempt
  }

  private async requestJson(
    url: URL,
    label: string,
    rateLimitAttempt = 0,
    transientAttempt = 0,
  ): Promise<unknown> {
    await this.throttle()

    let response: Response
    try {
      response = await fetch(url, {
        headers: { Authorization: `Bearer ${this.token}` },
      })
    } catch (error) {
      if (transientAttempt < TRANSIENT_ERROR_MAX_ATTEMPTS) {
        const waitSeconds = Math.min(30, 2 ** transientAttempt)
        this.log(
          `Network error on ${label}, retrying in ${waitSeconds}s: ${error instanceof Error ? error.message : String(error)}`,
        )
        await sleep(waitSeconds * 1000)
        return this.requestJson(url, label, rateLimitAttempt, transientAttempt + 1)
      }
      throw error
    }

    if (response.status === 429) {
      this.rateLimited = true
      this.consecutiveRateLimits += 1
      const retryAfterSeconds = this.parseRetryAfterSeconds(response, rateLimitAttempt)
      const waitSeconds = Math.min(RATE_LIMIT_MAX_WAIT_SECONDS, retryAfterSeconds)

      if (rateLimitAttempt >= 1 || retryAfterSeconds > RATE_LIMIT_MAX_WAIT_SECONDS) {
        const error = new Error(
          `Spotify GET ${label} rate limited (retry-after ${retryAfterSeconds}s)`,
        )
        ;(error as Error & { status?: number }).status = 429
        throw error
      }

      this.log(`Rate limited on ${label}, waiting ${waitSeconds}s`)
      await sleep(waitSeconds * 1000)
      return this.requestJson(url, label, rateLimitAttempt + 1, 0)
    }

    if (response.status >= 500 && transientAttempt < TRANSIENT_ERROR_MAX_ATTEMPTS) {
      const waitSeconds = Math.min(30, 2 ** transientAttempt)
      this.log(`Spotify ${response.status} on ${label}, retrying in ${waitSeconds}s`)
      await sleep(waitSeconds * 1000)
      return this.requestJson(url, label, rateLimitAttempt, transientAttempt + 1)
    }

    this.consecutiveRateLimits = 0

    if (!response.ok) {
      const body = await response.text()
      const error = new Error(`Spotify GET ${label} failed: ${response.status} ${body.slice(0, 200)}`)
      ;(error as Error & { status?: number }).status = response.status
      throw error
    }

    return response.json()
  }

  private async getOne(path: 'tracks' | 'artists', id: string): Promise<unknown | null> {
    const url = new URL(`https://api.spotify.com/v1/${path}/${id}`)
    try {
      return await this.requestJson(url, `/v1/${path}/${id}`)
    } catch (error) {
      if (statusOf(error) === 404) return null
      throw error
    }
  }

  async getByIds(path: 'tracks' | 'artists', ids: string[]): Promise<unknown[]> {
    if (ids.length === 0) return []

    if (!this.batchForbidden) {
      const url = new URL(`https://api.spotify.com/v1/${path}`)
      url.searchParams.set('ids', ids.join(','))
      try {
        const data = (await this.requestJson(url, `/v1/${path}?ids=`)) as Record<string, unknown>
        const rows = data[path]
        return Array.isArray(rows) ? rows.filter(Boolean) : []
      } catch (error) {
        if (statusOf(error) === 403) {
          this.batchForbidden = true
          this.log(
            `Batch GET /v1/${path}?ids= returned 403; probing one GET /v1/${path}/{id} before per-id fallback`,
          )
          const probe = await this.getOne(path, ids[0] ?? '')
          if (probe) {
            return [probe, ...(await this.getByIds(path, ids.slice(1)))]
          }
          return this.getByIds(path, ids.slice(1))
        }
        throw error
      }
    }

    const results: unknown[] = []
    for (const id of ids) {
      const item = await this.getOne(path, id)
      if (item) results.push(item)
    }
    return results
  }
}

interface SpotifyArtistMetrics {
  id: string
  name: string
  popularity: number
  genres?: string[]
}

interface SpotifyTrackPayload extends SpotifyTrackRef {
  duration_ms?: number
}

interface EmbedTrackMetrics {
  id: string
  title?: string
  artist?: string
  popularity?: number
  artistPopularity?: number
  albumArt?: string
  releaseDate?: string
  durationMs?: number
}

function primaryArtistPopularity(
  artists: SpotifyArtistRef[] | undefined,
  popularityById: Map<string, number>,
): number | undefined {
  const primary = artists?.[0]
  if (primary?.id && popularityById.has(primary.id)) {
    return popularityById.get(primary.id)
  }
  let max: number | undefined
  for (const artist of artists ?? []) {
    if (!artist.id || !popularityById.has(artist.id)) continue
    const value = popularityById.get(artist.id)
    if (value == null) continue
    max = max == null ? value : Math.max(max, value)
  }
  return max
}

function findNumericPopularity(value: unknown, depth = 0): number | undefined {
  if (value == null || depth > 10) return undefined
  if (typeof value !== 'object') return undefined
  const record = value as Record<string, unknown>
  if (typeof record.popularity === 'number' && record.popularity >= 0 && record.popularity <= 100) {
    return Math.round(record.popularity)
  }
  for (const child of Object.values(record)) {
    const found = findNumericPopularity(child, depth + 1)
    if (found != null) return found
  }
  return undefined
}

function largestEmbedImage(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined
  const record = value as { visualIdentity?: { image?: Array<{ url?: string; maxWidth?: number }> } }
  const images = record.visualIdentity?.image ?? []
  const ranked = [...images].sort((left, right) => (right.maxWidth ?? 0) - (left.maxWidth ?? 0))
  return ranked[0]?.url
}

function embedReleaseDate(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined
  const record = value as { releaseDate?: string | { isoString?: string } }
  if (typeof record.releaseDate === 'string') return record.releaseDate
  return record.releaseDate?.isoString
}

function parseEmbedEntity(id: string, entity: Record<string, unknown> | undefined): EmbedTrackMetrics | null {
  if (!entity) return null
  const artists = Array.isArray(entity.artists) ? entity.artists : []
  const artistNames = artists
    .map((artist) =>
      artist && typeof artist === 'object' && 'name' in artist
        ? String((artist as { name?: string }).name ?? '')
        : '',
    )
    .filter(Boolean)
  const primaryArtist = artists[0]
  const artistPopularity =
    primaryArtist && typeof primaryArtist === 'object'
      ? findNumericPopularity(primaryArtist)
      : undefined

  return {
    id,
    title: typeof entity.name === 'string' ? entity.name : typeof entity.title === 'string' ? entity.title : undefined,
    artist: artistNames.join(', ') || undefined,
    popularity: findNumericPopularity(entity),
    artistPopularity,
    albumArt: largestEmbedImage(entity),
    releaseDate: embedReleaseDate(entity)?.slice(0, 10),
    durationMs: typeof entity.duration === 'number' ? entity.duration : undefined,
  }
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': EMBED_USER_AGENT,
        Accept: 'text/html',
      },
    })
    if (!response.ok) return null
    return response.text()
  } catch {
    return null
  }
}

function parseNextDataEntity(html: string): Record<string, unknown> | undefined {
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
  if (!match?.[1]) return undefined
  try {
    const data = JSON.parse(match[1]) as {
      props?: { pageProps?: { state?: { data?: { entity?: Record<string, unknown> } } } }
    }
    return data.props?.pageProps?.state?.data?.entity
  } catch {
    return undefined
  }
}

async function fetchTrackMetricsFromEmbed(id: string): Promise<EmbedTrackMetrics | null> {
  const embedHtml = await fetchHtml(`https://open.spotify.com/embed/track/${encodeURIComponent(id)}`)
  if (embedHtml) {
    const fromEmbed = parseEmbedEntity(id, parseNextDataEntity(embedHtml))
    if (fromEmbed) return fromEmbed
  }

  const pageHtml = await fetchHtml(`https://open.spotify.com/track/${encodeURIComponent(id)}`)
  if (!pageHtml) return null
  const fromPage = parseEmbedEntity(id, parseNextDataEntity(pageHtml))
  if (fromPage) return fromPage

  const popularity = findNumericPopularity(
    [...pageHtml.matchAll(/"popularity"\s*:\s*(\d{1,3})/g)].map((item) => ({
      popularity: Number(item[1]),
    })),
  )
  if (popularity == null) return null
  return { id, popularity }
}

function patchFromTrack(
  track: SpotifyTrackPayload,
  popularityByArtist: Map<string, number>,
  genresByArtist: Map<string, string[]>,
): TrackMetricsPatch | null {
  if (!track.id) return null
  const popularity = track.popularity
  const artistPopularity = primaryArtistPopularity(track.artists, popularityByArtist)
  const releaseYear = parseReleaseYear(track.album?.release_date)
  return {
    id: track.id,
    title: track.name,
    artist: (track.artists ?? []).map((artist) => artist.name).join(', ') || undefined,
    albumArt: track.album?.images?.[0]?.url,
    popularity,
    artistPopularity,
    releaseYear,
    releaseDate: track.album?.release_date,
    durationMs: track.duration_ms,
    spotifyGenres: [
      ...new Set(
        (track.artists ?? []).flatMap((artist) =>
          artist.id ? (genresByArtist.get(artist.id) ?? []) : [],
        ),
      ),
    ],
    difficulty:
      popularity == null
        ? undefined
        : assignDifficultyFromMetrics({
            popularity,
            artistPopularity,
            releaseYear,
          }),
  }
}

function patchFromEmbed(metrics: EmbedTrackMetrics): TrackMetricsPatch {
  const releaseYear = parseReleaseYear(metrics.releaseDate)
  return {
    id: metrics.id,
    title: metrics.title,
    artist: metrics.artist,
    albumArt: metrics.albumArt,
    popularity: metrics.popularity,
    artistPopularity: metrics.artistPopularity,
    releaseYear,
    releaseDate: metrics.releaseDate,
    durationMs: metrics.durationMs,
    difficulty:
      metrics.popularity == null
        ? undefined
        : assignDifficultyFromMetrics({
            popularity: metrics.popularity,
            artistPopularity: metrics.artistPopularity,
            releaseYear,
          }),
  }
}

async function persistLastSpotifySync(env: Env, result: SpotifySyncResult): Promise<void> {
  try {
    await env.AUDIO_BUCKET.put(SPOTIFY_SYNC_RESULT_R2_KEY, JSON.stringify(result), {
      httpMetadata: { contentType: 'application/json' },
    })
  } catch (error) {
    console.warn(
      `[spotify-sync] Could not persist last sync: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

export async function loadLastSpotifySync(env: Env): Promise<SpotifySyncResult | null> {
  try {
    const object = await env.AUDIO_BUCKET.get(SPOTIFY_SYNC_RESULT_R2_KEY)
    if (!object) return null
    return JSON.parse(await object.text()) as SpotifySyncResult
  } catch {
    return null
  }
}

async function finishResult(
  env: Env,
  partial: Omit<SpotifySyncResult, 'popularityFilled' | 'popularityMissing' | 'distribution' | 'at' | 'message'> & {
    popularityFilled?: number
    popularityMissing?: number
    distribution?: Record<Difficulty, number>
  },
): Promise<SpotifySyncResult> {
  const stats = await getCatalogStats(env)
  const distribution = partial.distribution ?? (await getDifficultyDistribution(env))
  const result: SpotifySyncResult = {
    ...partial,
    popularityFilled: partial.popularityFilled ?? stats.popularityFilled,
    popularityMissing: partial.popularityMissing ?? stats.popularityMissing,
    distribution,
    at: new Date().toISOString(),
    message: '',
  }
  result.message = describeSync(result)
  await persistLastSpotifySync(env, result)
  return result
}

async function hydrateArtists(
  client: IdOnlySpotifyClient,
  artistIds: string[],
  runStartedAt: number,
  log: (message: string) => void,
  errors: string[],
): Promise<{ popularityByArtist: Map<string, number>; genresByArtist: Map<string, string[]> }> {
  const popularityByArtist = new Map<string, number>()
  const genresByArtist = new Map<string, string[]>()
  const artistIdList = [...artistIds]

  for (let index = 0; index < artistIdList.length; index += ARTIST_BATCH_SIZE) {
    if (Date.now() - runStartedAt >= CRON_TIME_BUDGET_MS) {
      log(`Time budget reached after ${index} artist IDs`)
      break
    }

    const batch = artistIdList.slice(index, index + ARTIST_BATCH_SIZE)
    try {
      const artists = (await client.getByIds('artists', batch)) as SpotifyArtistMetrics[]
      for (const artist of artists) {
        if (artist?.id) {
          if (typeof artist.popularity === 'number') {
            popularityByArtist.set(artist.id, artist.popularity)
          }
          if (artist.genres?.length) genresByArtist.set(artist.id, artist.genres)
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      errors.push(message)
      if (statusOf(error) === 429) break
    }
  }

  return { popularityByArtist, genresByArtist }
}

async function syncViaEmbed(
  ids: string[],
  env: Env,
  log: (message: string) => void,
  runStartedAt: number,
  errors: string[],
): Promise<{ updated: number; used: boolean }> {
  if (ids.length === 0) return { updated: 0, used: false }

  const sampleIds = ids.slice(0, EMBED_SAMPLE_SIZE)
  log(`Embed fallback sample of ${sampleIds.length} tracks`)
  const sample: EmbedTrackMetrics[] = []
  for (const id of sampleIds) {
    const metrics = await fetchTrackMetricsFromEmbed(id)
    if (metrics) sample.push(metrics)
    await sleep(80)
  }

  const sampleHasPopularity = sample.some((item) => item.popularity != null)
  if (!sampleHasPopularity) {
    const artPatches = sample
      .filter((item) => item.albumArt || item.title)
      .map((item) => ({
        id: item.id,
        title: item.title,
        artist: item.artist,
        albumArt: item.albumArt,
      }))
    if (artPatches.length > 0) {
      await applyOembedPatches(env, artPatches)
    }
    log('Embed sample had no popularity; not scraping the rest of the catalog')
    errors.push('Embed pages did not include popularity; Web API ID batch is required')
    return { updated: 0, used: false }
  }

  let updated = 0
  const pending: TrackMetricsPatch[] = sample.filter((item) => item.popularity != null).map(patchFromEmbed)
  const remaining = ids.slice(sampleIds.length)

  for (let index = 0; index < remaining.length; index += EMBED_CONCURRENCY) {
    if (Date.now() - runStartedAt >= CRON_TIME_BUDGET_MS) {
      log(`Time budget reached during embed after ${sampleIds.length + index} tracks`)
      break
    }
    const chunk = remaining.slice(index, index + EMBED_CONCURRENCY)
    const rows = await Promise.all(chunk.map((id) => fetchTrackMetricsFromEmbed(id)))
    for (const metrics of rows) {
      if (metrics?.popularity != null) pending.push(patchFromEmbed(metrics))
    }
    if (pending.length >= 50) {
      updated += await applyTrackMetricPatches(env, pending.splice(0, pending.length))
    }
  }

  if (pending.length > 0) {
    updated += await applyTrackMetricPatches(env, pending)
  }
  log(`Embed fallback wrote ${updated} popularity rows`)
  return { updated, used: true }
}

export async function syncPopularityByIds(
  env: Env,
  trackIds?: string[],
): Promise<SpotifySyncResult> {
  const log = (message: string) => console.log(`[spotify-sync] ${message}`)
  const ids = [...new Set((trackIds ?? (await listTrackIds(env))).filter(Boolean))]

  if (ids.length === 0) {
    return finishResult(env, {
      skipped: true,
      reason: 'No tracks in D1',
      updated: 0,
      tracks: 0,
      source: 'none',
      rateLimited: false,
      errors: [],
      distribution: emptyDistribution(),
      popularityFilled: 0,
      popularityMissing: 0,
    })
  }

  const runStartedAt = Date.now()
  const errors: string[] = []
  const trackById = new Map<string, SpotifyTrackPayload>()
  const artistIds = new Set<string>()
  let usedWebApi = false
  let usedEmbed = false
  let rateLimited = false
  let updated = 0

  const clientId = env.SPOTIFY_CLIENT_ID
  const clientSecret = env.SPOTIFY_CLIENT_SECRET
  if (clientId && clientSecret) {
    try {
      const token = await getSpotifyClientCredentialsToken(clientId, clientSecret)
      const client = new IdOnlySpotifyClient(token, log)
      log(`Syncing ${ids.length} tracks via GET /v1/tracks?ids= (max 50, no search)`)

      for (let index = 0; index < ids.length; index += TRACK_BATCH_SIZE) {
        if (Date.now() - runStartedAt >= CRON_TIME_BUDGET_MS) {
          log(`Time budget reached after ${index} track IDs`)
          break
        }

        const batch = ids.slice(index, index + TRACK_BATCH_SIZE)
        try {
          const tracks = (await client.getByIds('tracks', batch)) as SpotifyTrackPayload[]
          for (const track of tracks) {
            if (!track?.id) continue
            trackById.set(track.id, track)
            for (const artist of track.artists ?? []) {
              if (artist.id) artistIds.add(artist.id)
            }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          errors.push(message)
          if (statusOf(error) === 429) {
            rateLimited = true
            log('Web API 429 after capped Retry-After; switching remaining IDs to embed fallback')
            break
          }
        }
      }

      rateLimited = rateLimited || client.rateLimited

      if (trackById.size > 0) {
        usedWebApi = true
        const { popularityByArtist, genresByArtist } = await hydrateArtists(
          client,
          [...artistIds],
          runStartedAt,
          log,
          errors,
        )
        const patches = [...trackById.values()]
          .map((track) => patchFromTrack(track, popularityByArtist, genresByArtist))
          .filter((patch): patch is TrackMetricsPatch => Boolean(patch))
        updated += await applyTrackMetricPatches(env, patches)
        log(`Web API wrote ${patches.length} popularity rows`)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      errors.push(message)
      if (statusOf(error) === 429) rateLimited = true
    }
  } else {
    errors.push('Spotify credentials not configured; trying embed fallback')
  }

  const remainingIds = ids.filter((id) => !trackById.has(id))
  if (remainingIds.length > 0) {
    const embed = await syncViaEmbed(remainingIds, env, log, runStartedAt, errors)
    updated += embed.updated
    usedEmbed = embed.used
  }

  const source: SpotifySyncSource =
    usedWebApi && usedEmbed ? 'mixed' : usedWebApi ? 'web-api' : usedEmbed ? 'embed' : 'none'

  const result = await finishResult(env, {
    skipped: false,
    updated,
    tracks: ids.length,
    source,
    rateLimited,
    errors,
  })
  log(result.message)
  return result
}

export async function syncSpotifyMetrics(env: Env): Promise<SpotifySyncResult> {
  return syncPopularityByIds(env)
}
