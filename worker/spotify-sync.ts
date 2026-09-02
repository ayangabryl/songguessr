import {
  applyTrackMetricPatches,
  getCatalogStats,
  getDifficultyDistribution,
  listTrackIds,
  listTrackIdsMissingPublicStats,
  listTrackIdsStalestStats,
  listTrackScoringRows,
  type TrackMetricsPatch,
  type TrackScoringRow,
} from './catalog-d1'
import {
  PUBLIC_STATS_CONCURRENCY,
  PUBLIC_STATS_RUN_LIMIT,
  fetchPublicTrackStatsBatch,
  openWebPlayerSession,
  type PublicTrackStats,
} from './spotify-public-stats'
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

export const SPOTIFY_SYNC_RESULT_R2_KEY = 'catalog/spotify-sync-result.json'

export type SpotifySyncSource = 'web-api' | 'web-player' | 'mixed' | 'none'

/** Fields this run actually wrote, by field. */
export interface SpotifySyncFilled {
  popularity: number
  playCount: number
  releaseDate: number
}

/** Catalog-wide coverage after the run. */
export interface SpotifySyncCoverage {
  popularityFilled: number
  popularityMissing: number
  playCountFilled: number
  playCountMissing: number
  releaseDateFilled: number
  releaseDateMissing: number
}

export interface SpotifySyncResult {
  skipped: boolean
  reason?: string
  updated: number
  tracks: number
  popularityFilled: number
  popularityMissing: number
  filled: SpotifySyncFilled
  coverage: SpotifySyncCoverage
  source: SpotifySyncSource
  sources: string[]
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

const WEB_API_SOURCE = 'Spotify Web API GET /v1/tracks?ids='
const WEB_PLAYER_SOURCE = 'open.spotify.com web player (anonymous token + pathfinder getTrack)'

function describeSync(result: Omit<SpotifySyncResult, 'message'>): string {
  if (result.skipped) {
    return `Spotify sync skipped${result.reason ? `: ${result.reason}` : ''}`
  }

  const parts = [
    `${result.filled.releaseDate} release dates`,
    `${result.filled.playCount} play counts`,
    `${result.filled.popularity} popularity values`,
  ]
  const via = result.sources.length > 0 ? ` via ${result.sources.join(' + ')}` : ''
  const sentences = [`Filled ${parts.join(', ')} across ${result.tracks} tracks${via}.`]

  const gaps: string[] = []
  if (result.coverage.playCountMissing > 0) {
    gaps.push(`${result.coverage.playCountMissing} without plays`)
  }
  if (result.coverage.releaseDateMissing > 0) {
    gaps.push(`${result.coverage.releaseDateMissing} without a release date`)
  }
  if (gaps.length > 0) {
    sentences.push(`${gaps.join(' and ')} remain; the next sync picks up where this one stopped.`)
  }

  if (result.rateLimited && result.filled.popularity === 0) {
    sentences.push('The Spotify Web API is quota limited, so popularity could not be refreshed.')
  } else if (result.rateLimited) {
    sentences.push('Spotify rate limited part of this run.')
  }

  return sentences.join(' ')
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

function patchFromTrack(
  track: SpotifyTrackPayload,
  popularityByArtist: Map<string, number>,
  genresByArtist: Map<string, string[]>,
  existing?: TrackScoringRow,
): TrackMetricsPatch | null {
  if (!track.id) return null
  const popularity = track.popularity
  const artistPopularity = primaryArtistPopularity(track.artists, popularityByArtist)
  const releaseYear = parseReleaseYear(track.album?.release_date)
  const playCount = existing?.playCount ?? undefined
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
            playCount,
          }),
  }
}

/**
 * The web player gives plays and a release date but no popularity, so difficulty
 * is recomputed against whatever popularity D1 already holds for the track.
 */
function patchFromPublicStats(
  stats: PublicTrackStats,
  existing: TrackScoringRow | undefined,
): TrackMetricsPatch {
  const releaseYear = parseReleaseYear(stats.releaseDate) ?? existing?.releaseYear ?? undefined
  const playCount = stats.playCount ?? existing?.playCount ?? undefined
  const popularity = existing?.popularity ?? undefined
  const artistPopularity = existing?.artistPopularity ?? undefined

  return {
    id: stats.id,
    playCount: stats.playCount,
    releaseYear: parseReleaseYear(stats.releaseDate),
    releaseDate: stats.releaseDate,
    durationMs: stats.durationMs,
    difficulty:
      popularity == null && playCount == null
        ? undefined
        : assignDifficultyFromMetrics({
            popularity: popularity ?? 0,
            artistPopularity,
            releaseYear,
            playCount,
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
  partial: Omit<
    SpotifySyncResult,
    'popularityFilled' | 'popularityMissing' | 'coverage' | 'distribution' | 'at' | 'message'
  > & {
    distribution?: Record<Difficulty, number>
  },
): Promise<SpotifySyncResult> {
  const stats = await getCatalogStats(env)
  const distribution = partial.distribution ?? (await getDifficultyDistribution(env))
  const result: SpotifySyncResult = {
    ...partial,
    popularityFilled: stats.popularityFilled,
    popularityMissing: stats.popularityMissing,
    coverage: {
      popularityFilled: stats.popularityFilled,
      popularityMissing: stats.popularityMissing,
      playCountFilled: stats.playCountFilled,
      playCountMissing: stats.playCountMissing,
      releaseDateFilled: stats.releaseDateFilled,
      releaseDateMissing: stats.releaseDateMissing,
    },
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

interface PublicStatsSyncOutcome {
  updated: number
  used: boolean
  rateLimited: boolean
  playCountFilled: number
  releaseDateFilled: number
}

async function syncViaWebPlayer(
  ids: string[],
  env: Env,
  log: (message: string) => void,
  runStartedAt: number,
  errors: string[],
): Promise<PublicStatsSyncOutcome> {
  const outcome: PublicStatsSyncOutcome = {
    updated: 0,
    used: false,
    rateLimited: false,
    playCountFilled: 0,
    releaseDateFilled: 0,
  }
  if (ids.length === 0) return outcome

  log(`Web player stats for ${ids.length} tracks (concurrency ${PUBLIC_STATS_CONCURRENCY})`)
  const batch = await fetchPublicTrackStatsBatch(ids, {
    deadlineAt: runStartedAt + CRON_TIME_BUDGET_MS,
    log,
  })
  outcome.rateLimited = batch.rateLimited
  for (const message of batch.errors) {
    if (!errors.includes(message)) errors.push(message)
  }
  if (batch.stats.length === 0) {
    log('Web player returned no usable stats this run')
    return outcome
  }

  const existing = await listTrackScoringRows(
    env,
    batch.stats.map((item) => item.id),
  )
  const patches: TrackMetricsPatch[] = []
  for (const stats of batch.stats) {
    if (stats.playCount == null && !stats.releaseDate) continue
    if (stats.playCount != null) outcome.playCountFilled += 1
    if (stats.releaseDate) outcome.releaseDateFilled += 1
    patches.push(patchFromPublicStats(stats, existing.get(stats.id)))
  }

  outcome.updated = await applyTrackMetricPatches(env, patches)
  outcome.used = patches.length > 0
  log(
    `Web player wrote ${outcome.updated} rows (${outcome.playCountFilled} plays, ${outcome.releaseDateFilled} release dates)`,
  )
  return outcome
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
      sources: [],
      filled: { popularity: 0, playCount: 0, releaseDate: 0 },
      rateLimited: false,
      errors: [],
      distribution: emptyDistribution(),
    })
  }

  const runStartedAt = Date.now()
  const errors: string[] = []
  const trackById = new Map<string, SpotifyTrackPayload>()
  const artistIds = new Set<string>()
  const filled: SpotifySyncFilled = { popularity: 0, playCount: 0, releaseDate: 0 }
  let usedWebApi = false
  let usedWebPlayer = false
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
            log('Web API 429 after capped Retry-After; the web player covers the rest')
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
        const scoring = await listTrackScoringRows(env, [...trackById.keys()])
        const patches = [...trackById.values()]
          .map((track) =>
            patchFromTrack(track, popularityByArtist, genresByArtist, scoring.get(track.id ?? '')),
          )
          .filter((patch): patch is TrackMetricsPatch => Boolean(patch))
        updated += await applyTrackMetricPatches(env, patches)
        filled.popularity += patches.filter((patch) => patch.popularity != null).length
        filled.releaseDate += patches.filter((patch) => Boolean(patch.releaseDate)).length
        log(`Web API wrote ${patches.length} popularity rows`)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      errors.push(message)
      if (statusOf(error) === 429) rateLimited = true
    }
  } else {
    errors.push('Spotify credentials not configured; using the public web player only')
  }

  // The web player is the only source of plays, and it also backfills release
  // dates the Web API could not return.
  const publicIds = trackIds
    ? ids.slice(0, PUBLIC_STATS_RUN_LIMIT)
    : await pickWebPlayerTargets(env)
  if (publicIds.length > 0) {
    const webPlayer = await syncViaWebPlayer(publicIds, env, log, runStartedAt, errors)
    updated += webPlayer.updated
    usedWebPlayer = webPlayer.used
    rateLimited = rateLimited || webPlayer.rateLimited
    filled.playCount += webPlayer.playCountFilled
    filled.releaseDate += webPlayer.releaseDateFilled
  }

  const source: SpotifySyncSource =
    usedWebApi && usedWebPlayer
      ? 'mixed'
      : usedWebApi
        ? 'web-api'
        : usedWebPlayer
          ? 'web-player'
          : 'none'
  const sources = [
    ...(usedWebApi ? [WEB_API_SOURCE] : []),
    ...(usedWebPlayer ? [WEB_PLAYER_SOURCE] : []),
  ]

  const result = await finishResult(env, {
    skipped: false,
    updated,
    tracks: ids.length,
    source,
    sources,
    filled,
    rateLimited,
    errors,
  })
  log(result.message)
  return result
}

/** Prefer tracks with gaps; once the catalog is complete, refresh the stalest. */
async function pickWebPlayerTargets(env: Env): Promise<string[]> {
  const missing = await listTrackIdsMissingPublicStats(env, PUBLIC_STATS_RUN_LIMIT)
  if (missing.length >= PUBLIC_STATS_RUN_LIMIT) return missing
  const stale = await listTrackIdsStalestStats(env, PUBLIC_STATS_RUN_LIMIT)
  return [...new Set([...missing, ...stale])].slice(0, PUBLIC_STATS_RUN_LIMIT)
}

export async function syncSpotifyMetrics(env: Env): Promise<SpotifySyncResult> {
  return syncPopularityByIds(env)
}
