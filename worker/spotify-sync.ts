import {
  applyTrackMetricPatches,
  getDifficultyDistribution,
  listTrackIdsForSync,
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
const RATE_LIMIT_MAX_BACKOFF_SECONDS = 120
const TRANSIENT_ERROR_MAX_ATTEMPTS = 5
const CRON_TIME_BUDGET_MS = 4 * 60 * 1000

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms))
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
      const waitSeconds = Math.min(
        RATE_LIMIT_MAX_BACKOFF_SECONDS,
        retryAfterSeconds + Math.min(30, this.consecutiveRateLimits * 3),
      )

      if (rateLimitAttempt > 1 || retryAfterSeconds > RATE_LIMIT_MAX_BACKOFF_SECONDS) {
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
      if ((error as { status?: number }).status === 404) return null
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
        if ((error as { status?: number }).status === 403) {
          this.batchForbidden = true
          this.log(
            `Batch GET /v1/${path}?ids= returned 403; falling back to per-id GET /v1/${path}/{id}`,
          )
        } else {
          throw error
        }
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
}

interface SpotifyTrackPayload extends SpotifyTrackRef {
  duration_ms?: number
}

function primaryArtistPopularity(
  artists: SpotifyArtistRef[] | undefined,
  popularityById: Map<string, number>,
): number {
  const primary = artists?.[0]
  if (primary?.id && popularityById.has(primary.id)) {
    return popularityById.get(primary.id) ?? 0
  }
  let max = 0
  for (const artist of artists ?? []) {
    if (artist.id) {
      max = Math.max(max, popularityById.get(artist.id) ?? 0)
    }
  }
  return max
}

export interface SpotifySyncResult {
  skipped: boolean
  reason?: string
  updated: number
  tracks: number
  distribution: Record<Difficulty, number>
  rateLimited: boolean
  errors: string[]
}

export async function syncSpotifyMetrics(env: Env): Promise<SpotifySyncResult> {
  const log = (message: string) => console.log(`[spotify-sync] ${message}`)
  const emptyDistribution = {
    easy: 0,
    medium: 0,
    hard: 0,
    expert: 0,
    impossible: 0,
  } as Record<Difficulty, number>

  const clientId = env.SPOTIFY_CLIENT_ID
  const clientSecret = env.SPOTIFY_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return {
      skipped: true,
      reason: 'Spotify credentials not configured',
      updated: 0,
      tracks: 0,
      distribution: emptyDistribution,
      rateLimited: false,
      errors: [],
    }
  }

  const ids = await listTrackIdsForSync(env)
  if (ids.length === 0) {
    return {
      skipped: true,
      reason: 'No tracks in D1',
      updated: 0,
      tracks: 0,
      distribution: emptyDistribution,
      rateLimited: false,
      errors: [],
    }
  }

  const token = await getSpotifyClientCredentialsToken(clientId, clientSecret)
  const client = new IdOnlySpotifyClient(token, log)
  const runStartedAt = Date.now()
  const errors: string[] = []
  const patches: TrackMetricsPatch[] = []
  const artistIds = new Set<string>()
  const trackById = new Map<string, SpotifyTrackPayload>()

  log(`Syncing ${ids.length} tracks via GET /v1/tracks?ids= (no search)`)

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
      if ((error as { status?: number }).status === 429) break
    }
  }

  const popularityByArtist = new Map<string, number>()
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
          popularityByArtist.set(artist.id, artist.popularity ?? 0)
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      errors.push(message)
      if ((error as { status?: number }).status === 429) break
    }
  }

  for (const [id, track] of trackById) {
    const popularity = track.popularity ?? 0
    const artistPopularity = primaryArtistPopularity(track.artists, popularityByArtist)
    const releaseYear = parseReleaseYear(track.album?.release_date)
    patches.push({
      id,
      title: track.name,
      artist: (track.artists ?? []).map((artist) => artist.name).join(', ') || undefined,
      albumArt: track.album?.images?.[0]?.url,
      popularity,
      artistPopularity,
      releaseYear,
      durationMs: track.duration_ms,
      difficulty: assignDifficultyFromMetrics({
        popularity,
        artistPopularity,
        releaseYear,
      }),
    })
  }

  const updated = await applyTrackMetricPatches(env, patches)
  const distribution = await getDifficultyDistribution(env)
  log(`Updated ${updated} tracks. Distribution ${JSON.stringify(distribution)}`)

  return {
    skipped: false,
    updated,
    tracks: ids.length,
    distribution,
    rateLimited: client.rateLimited,
    errors,
  }
}
