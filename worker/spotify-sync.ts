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
  type PublicTrackStats,
} from './spotify-public-stats'
import { assignDifficultyFromMetrics, parseReleaseYear } from './difficulty'
import type { Difficulty, Env } from './types'

const CRON_TIME_BUDGET_MS = 4 * 60 * 1000

export const SPOTIFY_SYNC_RESULT_R2_KEY = 'catalog/spotify-sync-result.json'

/**
 * `web-api` is retained only so historical sync results stored in R2 still
 * parse; nothing writes it any more.
 */
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
  playCountStale: number
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

function emptyDistribution(): Record<Difficulty, number> {
  return {
    easy: 0,
    medium: 0,
    hard: 0,
    expert: 0,
    impossible: 0,
  }
}

const WEB_PLAYER_SOURCE =
  'open.spotify.com web player (anonymous token + pathfinder getTrack + spclient metadata)'

function describeSync(result: Omit<SpotifySyncResult, 'message'>): string {
  if (result.skipped) {
    return `Spotify sync skipped${result.reason ? `: ${result.reason}` : ''}`
  }

  const parts = [
    `${result.filled.playCount} play counts`,
    `${result.filled.popularity} popularity values`,
    `${result.filled.releaseDate} release dates`,
  ]
  const via = result.sources.length > 0 ? ` via ${result.sources.join(' + ')}` : ''
  const sentences = [`Filled ${parts.join(', ')} across ${result.tracks} tracks${via}.`]

  const gaps: string[] = []
  if (result.coverage.playCountMissing > 0) {
    gaps.push(`${result.coverage.playCountMissing} without plays`)
  }
  if (result.coverage.popularityMissing > 0) {
    gaps.push(`${result.coverage.popularityMissing} without popularity`)
  }
  if (result.coverage.releaseDateMissing > 0) {
    gaps.push(`${result.coverage.releaseDateMissing} without a release date`)
  }
  if (gaps.length > 0) {
    sentences.push(`${gaps.join(', ')} remain; the next sync picks up where this one stopped.`)
  }

  if (result.rateLimited) {
    sentences.push('Spotify throttled part of this run; the rest will be picked up next sweep.')
  }

  return sentences.join(' ')
}


/**
 * Builds a patch from the public signals, falling back to whatever D1 already
 * holds for anything this run could not read. A signal that is missing stays
 * missing — it is never written as 0, because 0 is a meaningful popularity.
 */
function patchFromPublicStats(
  stats: PublicTrackStats,
  existing: TrackScoringRow | undefined,
): TrackMetricsPatch {
  const releaseYear = parseReleaseYear(stats.releaseDate) ?? existing?.releaseYear ?? undefined
  const playCount = stats.playCount ?? existing?.playCount ?? undefined
  const popularity = stats.popularity ?? existing?.popularity ?? undefined
  const artistPopularity = stats.artistPopularity ?? existing?.artistPopularity ?? undefined

  const hasSignal = playCount != null || popularity != null || artistPopularity != null

  return {
    id: stats.id,
    playCount: stats.playCount,
    popularity: stats.popularity,
    artistPopularity: stats.artistPopularity,
    releaseYear: parseReleaseYear(stats.releaseDate),
    releaseDate: stats.releaseDate,
    durationMs: stats.durationMs,
    difficulty: hasSignal
      ? assignDifficultyFromMetrics({
          popularity,
          artistPopularity,
          releaseYear,
          playCount,
        })
      : undefined,
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
      playCountStale: stats.playCountStale,
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

interface PublicStatsSyncOutcome {
  updated: number
  used: boolean
  rateLimited: boolean
  playCountFilled: number
  popularityFilled: number
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
    popularityFilled: 0,
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
    if (stats.playCount == null && !stats.releaseDate && stats.popularity == null) continue
    if (stats.playCount != null) outcome.playCountFilled += 1
    if (stats.releaseDate) outcome.releaseDateFilled += 1
    if (stats.popularity != null) outcome.popularityFilled += 1
    patches.push(patchFromPublicStats(stats, existing.get(stats.id)))
  }

  outcome.updated = await applyTrackMetricPatches(env, patches)
  outcome.used = patches.length > 0
  log(
    `Web player wrote ${outcome.updated} rows (${outcome.playCountFilled} plays, ` +
      `${outcome.popularityFilled} popularity, ${outcome.releaseDateFilled} release dates)`,
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
  const filled: SpotifySyncFilled = { popularity: 0, playCount: 0, releaseDate: 0 }
  let updated = 0

  // Everything comes from the public web player now. The Web API's
  // GET /v1/tracks is quota-blocked for this app and has no play count anyway,
  // so calling it only produced 429s and an empty popularity column.
  const publicIds = trackIds
    ? ids.slice(0, PUBLIC_STATS_RUN_LIMIT)
    : await pickWebPlayerTargets(env)

  const webPlayer = await syncViaWebPlayer(publicIds, env, log, runStartedAt, errors)
  updated += webPlayer.updated
  filled.playCount += webPlayer.playCountFilled
  filled.popularity += webPlayer.popularityFilled
  filled.releaseDate += webPlayer.releaseDateFilled

  const source: SpotifySyncSource = webPlayer.used ? 'web-player' : 'none'
  const sources = webPlayer.used ? [WEB_PLAYER_SOURCE] : []

  const result = await finishResult(env, {
    skipped: false,
    updated,
    tracks: ids.length,
    source,
    sources,
    filled,
    rateLimited: webPlayer.rateLimited,
    errors,
  })
  log(result.message)
  return result
}

/** Prefer tracks with gaps; once the catalog is complete, refresh the stalest. */
async function pickWebPlayerTargets(env: Env, limit = PUBLIC_STATS_RUN_LIMIT): Promise<string[]> {
  const missing = await listTrackIdsMissingPublicStats(env, limit)
  if (missing.length >= limit) return missing
  const stale = await listTrackIdsStalestStats(env, limit)
  return [...new Set([...missing, ...stale])].slice(0, limit)
}

export interface PublicStatsRefreshResult {
  scanned: number
  updated: number
  playCountFilled: number
  popularityFilled: number
  releaseDateFilled: number
  rateLimited: boolean
  errors: string[]
  coverage: SpotifySyncCoverage
  distribution: Record<Difficulty, number>
  message: string
}

/**
 * A single public-stats sweep an admin can trigger by hand: plays, popularity,
 * artist popularity, and release dates for whichever tracks are furthest out of
 * date. Same code path as the cron, just with a caller-chosen batch size.
 */
export async function refreshPublicStats(
  env: Env,
  limit = PUBLIC_STATS_RUN_LIMIT,
  trackIds?: string[],
): Promise<PublicStatsRefreshResult> {
  const log = (message: string) => console.log(`[public-stats] ${message}`)
  const errors: string[] = []
  const ids = trackIds?.length
    ? [...new Set(trackIds.filter(Boolean))].slice(0, limit)
    : await pickWebPlayerTargets(env, limit)

  const outcome = await syncViaWebPlayer(ids, env, log, Date.now(), errors)
  const stats = await getCatalogStats(env)
  const distribution = await getDifficultyDistribution(env)

  const coverage: SpotifySyncCoverage = {
    popularityFilled: stats.popularityFilled,
    popularityMissing: stats.popularityMissing,
    playCountFilled: stats.playCountFilled,
    playCountMissing: stats.playCountMissing,
    playCountStale: stats.playCountStale,
    releaseDateFilled: stats.releaseDateFilled,
    releaseDateMissing: stats.releaseDateMissing,
  }

  const message =
    ids.length === 0
      ? 'Every track already has public stats.'
      : `Refreshed ${outcome.playCountFilled} play counts, ${outcome.popularityFilled} popularity values, ` +
        `and ${outcome.releaseDateFilled} release dates across ${ids.length} tracks. ` +
        `${coverage.playCountMissing} still without plays, ${coverage.popularityMissing} without popularity.`

  return {
    scanned: ids.length,
    updated: outcome.updated,
    playCountFilled: outcome.playCountFilled,
    popularityFilled: outcome.popularityFilled,
    releaseDateFilled: outcome.releaseDateFilled,
    rateLimited: outcome.rateLimited,
    errors,
    coverage,
    distribution,
    message,
  }
}

export async function syncSpotifyMetrics(env: Env): Promise<SpotifySyncResult> {
  return syncPopularityByIds(env)
}
