import { albumArtFromSpotifyTrack } from './album-art'
import { insertTracks, listTrackIds, MAX_CATALOG_TRACKS } from './catalog-d1'
import { assignDifficultyFromMetrics, parseReleaseYear } from './difficulty'
import { syncPopularityByIds } from './spotify-sync'
import {
  loadCheckpointFromR2,
  saveCheckpointToR2,
} from './catalog-r2'
import {
  artistNameScore,
  isOpmSpotifyTrack,
  type SpotifyTrackRef,
  UNIQUE_OPM_ARTISTS,
} from './opm-artists'
import {
  fetchCategoryPlaylists,
  fetchNewOpmTracksFromPlaylist,
  type GenreDiscoverSource,
} from './genre-source'
import { resolvePreviewSourcesForTrack } from './preview-sources'
import type { Env, GenreFilter, Track } from './types'

const MARKET = 'PH'
const SEARCH_PAGE_SIZE = 10
const MAX_SEARCH_OFFSET = 950
const MAX_PAGES_PER_ARTIST = 12
const MAX_ALBUMS_PER_ARTIST = 8
const MAX_TRACKS_PER_ALBUM = 30
const ALBUM_PAGE_SIZE = 10
const API_DELAY_MS = 400
const RATE_LIMIT_BASE_DELAY_SECONDS = 2
const RATE_LIMIT_MAX_BACKOFF_SECONDS = 300
const TRANSIENT_ERROR_MAX_ATTEMPTS = 6
const ARTISTS_PER_CRON_MIN = 1
const ARTISTS_PER_CRON_MAX = 3
const CRON_TIME_BUDGET_MS = 4 * 60 * 1000
const MAX_PREVIEW_RESOLVES_PER_RUN = 180
const ENABLE_ARTIST_SCRAPE = false

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms))
}

function inferGenreGroups(artist: string, title: string): GenreFilter[] {
  const haystack = `${artist} ${title}`.toLowerCase()
  const groups: GenreFilter[] = []
  if (/hip.?hop|rap|trap|skusta|flow g|hellmerry|brando|gloc-9|loonie|abra/i.test(haystack)) {
    groups.push('hip-hop')
  }
  if (/r&b|soul|moira|regine|gary valenciano|martin nievera|jona|morissette|kyla|jay r/i.test(haystack)) {
    groups.push('r&b')
  }
  if (/rock|eraserheads|rivermaya|parokya|itchyworms|silent sanctuary|chicosci|hale|up dharma|kamikazee|bamboo|franco|sponge cola/i.test(haystack)) {
    groups.push('rock')
  }
  if (/dance|electro|house|edm|remix|dj/i.test(haystack)) groups.push('dance')
  if (/sb19|bini|p-pop|ben&ben|cup of joe|zack tabudlo|arthur nery|juan karlos|lola amour|hev abi|sarah geronimo|december avenue|bgyo|alamat/i.test(haystack)) {
    groups.push('pop')
  }
  return groups.length > 0 ? groups : ['other']
}

function spotifyErrorStatus(error: unknown): number | undefined {
  return (error as { status?: number }).status
}

class SpotifyClient {
  private lastRequestAt = 0
  private consecutiveRateLimits = 0
  private rateLimitPaused = false
  currentArtistName: string | null = null

  constructor(
    private readonly token: string,
    private readonly log: (message: string) => void,
  ) {}

  get didPauseForRateLimit(): boolean {
    return this.rateLimitPaused
  }

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
      if (Number.isFinite(seconds) && seconds > 0) {
        return seconds
      }
    }
    return RATE_LIMIT_BASE_DELAY_SECONDS * 2 ** rateLimitAttempt
  }

  async get(
    path: string,
    params: Record<string, string | number | undefined> = {},
    rateLimitAttempt = 0,
    transientAttempt = 0,
  ): Promise<unknown> {
    await this.throttle()

    const url = new URL(`https://api.spotify.com/v1/${path}`)
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value))
      }
    }

    let response: Response
    try {
      response = await fetch(url, {
        headers: { Authorization: `Bearer ${this.token}` },
      })
    } catch (error) {
      if (transientAttempt < TRANSIENT_ERROR_MAX_ATTEMPTS) {
        const waitSeconds = Math.min(60, 2 ** transientAttempt)
        this.log(
          `Network error on ${path}, retrying in ${waitSeconds}s: ${error instanceof Error ? error.message : String(error)}`,
        )
        await sleep(waitSeconds * 1000)
        return this.get(path, params, rateLimitAttempt, transientAttempt + 1)
      }
      throw error
    }

    if (response.status === 429) {
      const retryAfterSeconds = this.parseRetryAfterSeconds(response, rateLimitAttempt)
      const backoffBonus = Math.min(60, this.consecutiveRateLimits * 5)
      const waitSeconds = Math.min(
        RATE_LIMIT_MAX_BACKOFF_SECONDS,
        retryAfterSeconds + backoffBonus,
      )
      this.consecutiveRateLimits += 1
      this.rateLimitPaused = true

      if (retryAfterSeconds > RATE_LIMIT_MAX_BACKOFF_SECONDS || rateLimitAttempt > 0) {
        const error = new Error(
          `Spotify GET ${path} failed: 429 rate limited (retry-after ${retryAfterSeconds}s)`,
        )
        ;(error as Error & { status?: number }).status = 429
        this.log(
          `Rate limited on ${path}; retry-after ${retryAfterSeconds}s exceeds wait cap or already retried. Continuing without abandoning the run.`,
        )
        throw error
      }

      this.log(`Rate limited, waiting ${waitSeconds}s then continuing (${path})`)
      await sleep(waitSeconds * 1000)
      if (this.currentArtistName) {
        this.log(`Resuming after rate limit (${this.currentArtistName})`)
      }
      return this.get(path, params, rateLimitAttempt + 1, 0)
    }

    if (response.status >= 500 && transientAttempt < TRANSIENT_ERROR_MAX_ATTEMPTS) {
      const waitSeconds = Math.min(60, 2 ** transientAttempt)
      this.log(`Spotify ${response.status} on ${path}, retrying in ${waitSeconds}s`)
      await sleep(waitSeconds * 1000)
      return this.get(path, params, rateLimitAttempt, transientAttempt + 1)
    }

    this.consecutiveRateLimits = 0

    if (!response.ok) {
      const body = await response.text()
      const error = new Error(`Spotify GET ${path} failed: ${response.status} ${body.slice(0, 200)}`)
      ;(error as Error & { status?: number }).status = response.status
      throw error
    }

    return response.json()
  }
}

async function getSpotifyToken(clientId: string, clientSecret: string): Promise<string> {
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

async function searchArtist(client: SpotifyClient, artistName: string) {
  const data = (await client.get('search', {
    q: artistName,
    type: 'artist',
    market: MARKET,
    limit: 5,
  })) as { artists?: { items?: { id: string; name: string }[] } }

  const artists = data.artists?.items ?? []
  let bestArtist: { id: string; name: string } | null = null
  let bestScore = 0

  for (const artist of artists) {
    const score = artistNameScore(artist.name, artistName)
    if (score > bestScore) {
      bestScore = score
      bestArtist = artist
    }
  }

  return bestScore >= 60 ? bestArtist : null
}

async function fetchArtistTopTracks(client: SpotifyClient, artistId: string): Promise<SpotifyTrackRef[]> {
  const data = (await client.get(`artists/${artistId}/top-tracks`, {
    market: MARKET,
  })) as { tracks?: SpotifyTrackRef[] }
  return data.tracks ?? []
}

async function fetchFullTracks(client: SpotifyClient, trackIds: string[]): Promise<SpotifyTrackRef[]> {
  const tracks: SpotifyTrackRef[] = []
  for (let index = 0; index < trackIds.length; index += 50) {
    const batch = trackIds.slice(index, index + 50)
    const data = (await client.get('tracks', {
      ids: batch.join(','),
      market: MARKET,
    })) as { tracks?: (SpotifyTrackRef | null)[] }
    for (const track of data.tracks ?? []) {
      if (track) tracks.push(track)
    }
  }
  return tracks
}

async function fetchArtistAlbumTracks(
  client: SpotifyClient,
  artistId: string,
): Promise<SpotifyTrackRef[]> {
  const trackIds = new Set<string>()

  for (let albumPage = 0; albumPage < Math.ceil(MAX_ALBUMS_PER_ARTIST / ALBUM_PAGE_SIZE); albumPage += 1) {
    const offset = albumPage * ALBUM_PAGE_SIZE
    const data = (await client.get(`artists/${artistId}/albums`, {
      include_groups: 'album,single,compilation',
      market: MARKET,
      limit: ALBUM_PAGE_SIZE,
      offset,
    })) as { items?: { id: string }[] }

    const albums = data.items ?? []
    if (albums.length === 0) break

    for (const album of albums) {
      for (let trackPage = 0; trackPage < Math.ceil(MAX_TRACKS_PER_ALBUM / 50); trackPage += 1) {
        const trackOffset = trackPage * 50
        const albumData = (await client.get(`albums/${album.id}/tracks`, {
          limit: 50,
          offset: trackOffset,
        })) as { items?: { id?: string }[] }

        const items = albumData.items ?? []
        if (items.length === 0) break

        for (const track of items) {
          if (track?.id) trackIds.add(track.id)
        }

        if (items.length < 50) break
      }
    }

    if (albums.length < ALBUM_PAGE_SIZE) break
    if (offset + albums.length >= MAX_ALBUMS_PER_ARTIST) break
  }

  return fetchFullTracks(client, [...trackIds])
}

async function searchArtistTracks(
  client: SpotifyClient,
  artistName: string,
): Promise<SpotifyTrackRef[]> {
  const tracks: SpotifyTrackRef[] = []
  const escapedName = artistName.replace(/"/g, '\\"')

  for (let pageIndex = 0; pageIndex < MAX_PAGES_PER_ARTIST; pageIndex += 1) {
    const offset = pageIndex * SEARCH_PAGE_SIZE
    if (offset > MAX_SEARCH_OFFSET) break

    const data = (await client.get('search', {
      q: `artist:"${escapedName}"`,
      type: 'track',
      market: MARKET,
      limit: SEARCH_PAGE_SIZE,
      offset,
    })) as { tracks?: { items?: SpotifyTrackRef[] } }

    const page = data.tracks?.items ?? []
    if (page.length === 0) break

    for (const track of page) {
      if (isOpmSpotifyTrack(track)) {
        tracks.push(track)
      }
    }
  }

  return tracks
}

async function collectArtistTracks(
  client: SpotifyClient,
  artistName: string,
): Promise<SpotifyTrackRef[]> {
  const trackById = new Map<string, SpotifyTrackRef>()

  const artist = await searchArtist(client, artistName)
  if (artist) {
    try {
      for (const track of await fetchArtistTopTracks(client, artist.id)) {
        if (isOpmSpotifyTrack(track) && track.id) {
          trackById.set(track.id, track)
        }
      }
    } catch {
      // Top tracks are optional.
    }

    for (const track of await fetchArtistAlbumTracks(client, artist.id)) {
      if (isOpmSpotifyTrack(track) && track.id) {
        trackById.set(track.id, track)
      }
    }
  }

  for (const track of await searchArtistTracks(client, artistName)) {
    if (track.id) trackById.set(track.id, track)
  }

  return [...trackById.values()]
}

interface CatalogBuildState {
  existingIds: Set<string>
  pending: Track[]
  /** Written this run, so they can be enriched with public stats at the end. */
  insertedIds: Set<string>
}

type CatalogCheckpoint = {
  completedArtists: Set<string>
  playlistSyncedAt?: string
  genreSyncedAt?: string
  genrePlaylistCursor?: number
  genreSource?: string
}

function queueTrack(
  state: CatalogBuildState,
  track: SpotifyTrackRef,
  previews: { previewUrl: string | null; hookPreviewUrl?: string; hookStartSeconds: number },
): boolean {
  const { previewUrl, hookPreviewUrl, hookStartSeconds } = previews
  if (!track?.id || !previewUrl) return false
  if (!isOpmSpotifyTrack(track)) return false
  if (state.existingIds.has(track.id)) return false

  const artist = (track.artists ?? []).map((item) => item.name).join(', ')
  const releaseYear = parseReleaseYear(track.album?.release_date)
  // Left undefined when Spotify did not return one; the public-stats sweep
  // right after this build fills it in properly rather than storing a fake 0.
  const popularity = track.popularity

  state.existingIds.add(track.id)
  state.pending.push({
    id: track.id,
    title: track.name ?? 'Unknown',
    artist,
    previewUrl,
    ...(hookPreviewUrl ? { hookPreviewUrl } : {}),
    hookStartSeconds,
    albumArt: albumArtFromSpotifyTrack(track),
    difficulty: assignDifficultyFromMetrics({ popularity, releaseYear }),
    releaseYear,
    genreGroups: inferGenreGroups(artist, track.name ?? ''),
    popularity,
    durationMs: track.duration_ms,
    country: 'PH',
    catalog: 'opm',
  })
  return true
}

async function persistProgress(
  env: Env,
  state: CatalogBuildState,
  checkpoint: CatalogCheckpoint,
): Promise<void> {
  if (state.pending.length > 0) {
    for (const track of state.pending) state.insertedIds.add(track.id)
    await insertTracks(env, state.pending)
    state.pending.length = 0
  }
  await saveCheckpointToR2(env.AUDIO_BUCKET, checkpoint)
}

async function processGenrePlaylists(
  env: Env,
  client: SpotifyClient,
  state: CatalogBuildState,
  checkpoint: CatalogCheckpoint,
  log: (message: string) => void,
  runStartedAt: number,
  previewBudget: number,
): Promise<{
  tracksAdded: number
  previewResolves: number
  playlistsProcessed: number
  source: GenreDiscoverSource
}> {
  const spotifyGet = (path: string, params?: Record<string, string | number | undefined>) =>
    client.get(path, params ?? {})

  const discovered = await fetchCategoryPlaylists(spotifyGet)
  checkpoint.genreSource = discovered.source
  log(
    `Genre source ${discovered.source}${discovered.categoryName ? ` (${discovered.categoryName})` : ''}: ${discovered.playlists.length} playlists`,
  )

  if (discovered.playlists.length === 0) {
    return { tracksAdded: 0, previewResolves: 0, playlistsProcessed: 0, source: discovered.source }
  }

  let tracksAdded = 0
  let previewResolves = 0
  let playlistsProcessed = 0
  const startCursor =
    ((checkpoint.genrePlaylistCursor ?? 0) % discovered.playlists.length +
      discovered.playlists.length) %
    discovered.playlists.length

  for (let step = 0; step < discovered.playlists.length; step += 1) {
    if (state.existingIds.size >= MAX_CATALOG_TRACKS) break
    if (previewResolves >= previewBudget) break
    if (Date.now() - runStartedAt >= CRON_TIME_BUDGET_MS) {
      log(`Time budget reached after ${playlistsProcessed} genre playlists`)
      break
    }

    const playlist = discovered.playlists[(startCursor + step) % discovered.playlists.length]
    if (!playlist) continue

    try {
      const existingIds = state.existingIds
      const result = await fetchNewOpmTracksFromPlaylist(spotifyGet, playlist, existingIds)
      log(
        `Playlist "${result.playlist.name}": ${result.totalTracks} reported, ${result.fetchedTracks} fetched, ${result.newOpmTracks.length} new OPM (${result.source})`,
      )

      let addedForPlaylist = 0
      let skippedNoPreview = 0
      for (const track of result.newOpmTracks) {
        if (state.existingIds.size >= MAX_CATALOG_TRACKS) break
        if (previewResolves >= previewBudget) break
        if (Date.now() - runStartedAt >= CRON_TIME_BUDGET_MS) break

        const artist = (track.artists ?? []).map((item) => item.name).join(', ')
        previewResolves += 1
        const previews = await resolvePreviewSourcesForTrack({
          title: track.name ?? '',
          artist,
          spotifyPreviewUrl: track.preview_url ?? null,
          spotifyId: track.id,
        })

        if (queueTrack(state, track, previews)) {
          addedForPlaylist += 1
          tracksAdded += 1
        } else if (!previews.previewUrl) {
          skippedNoPreview += 1
        }
      }

      playlistsProcessed += 1
      checkpoint.genrePlaylistCursor = (startCursor + step + 1) % discovered.playlists.length
      checkpoint.genreSyncedAt = new Date().toISOString()
      await persistProgress(env, state, checkpoint)
      log(
        `Playlist "${result.playlist.name}": ${addedForPlaylist} tracks added, ${skippedNoPreview} skipped (no official preview)`,
      )
    } catch (error) {
      const status = spotifyErrorStatus(error)
      log(
        `Playlist "${playlist.name}" failed: ${error instanceof Error ? error.message : String(error)}`,
      )
      if (status === 403 || status === 404 || status === 429) {
        playlistsProcessed += 1
        checkpoint.genrePlaylistCursor = (startCursor + step + 1) % discovered.playlists.length
        continue
      }
      if (client.didPauseForRateLimit) {
        checkpoint.genrePlaylistCursor = (startCursor + step) % discovered.playlists.length
        await persistProgress(env, state, checkpoint)
        log('Rate limit wait finished; continuing remaining playlists if time remains')
        continue
      }
      throw error
    }
  }

  return { tracksAdded, previewResolves, playlistsProcessed, source: discovered.source }
}

export interface CatalogBuildResult {
  skipped: boolean
  reason?: string
  artistsProcessed: number
  playlistsProcessed: number
  tracksAdded: number
  totalTracks: number
  genreSource?: GenreDiscoverSource
  rateLimited: boolean
  errors: string[]
}

export async function runCatalogBuild(env: Env): Promise<CatalogBuildResult> {
  const log = (message: string) => console.log(`[catalog-build] ${message}`)

  const clientId = env.SPOTIFY_CLIENT_ID
  const clientSecret = env.SPOTIFY_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return {
      skipped: true,
      reason: 'Spotify credentials not configured',
      artistsProcessed: 0,
      playlistsProcessed: 0,
      tracksAdded: 0,
      totalTracks: 0,
      rateLimited: false,
      errors: [],
    }
  }

  const state: CatalogBuildState = {
    existingIds: new Set(await listTrackIds(env)),
    pending: [],
    insertedIds: new Set(),
  }

  if (state.existingIds.size >= MAX_CATALOG_TRACKS) {
    log(`Catalog at cap (${state.existingIds.size} tracks). Skipping build.`)
    return {
      skipped: true,
      reason: 'catalog at 20k cap',
      artistsProcessed: 0,
      playlistsProcessed: 0,
      tracksAdded: 0,
      totalTracks: state.existingIds.size,
      rateLimited: false,
      errors: [],
    }
  }

  const checkpoint = await loadCheckpointFromR2(env.AUDIO_BUCKET)
  const token = await getSpotifyToken(clientId, clientSecret)
  const client = new SpotifyClient(token, log)
  const runStartedAt = Date.now()

  let artistsProcessed = 0
  let tracksAdded = 0
  let previewResolves = 0
  let playlistsProcessed = 0
  let genreSource: GenreDiscoverSource | undefined
  const errors: string[] = []

  try {
    const genreResult = await processGenrePlaylists(
      env,
      client,
      state,
      checkpoint,
      log,
      runStartedAt,
      MAX_PREVIEW_RESOLVES_PER_RUN,
    )
    tracksAdded += genreResult.tracksAdded
    previewResolves += genreResult.previewResolves
    playlistsProcessed += genreResult.playlistsProcessed
    genreSource = genreResult.source
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    log(`Genre ingest failed: ${message}`)
    errors.push(message)
    await persistProgress(env, state, checkpoint)
  }

  const remainingMs = CRON_TIME_BUDGET_MS - (Date.now() - runStartedAt)
  const pendingArtists = UNIQUE_OPM_ARTISTS.filter((name) => !checkpoint.completedArtists.has(name))
  const shouldScrapeArtists =
    ENABLE_ARTIST_SCRAPE &&
    remainingMs > 60_000 &&
    playlistsProcessed === 0 &&
    pendingArtists.length > 0 &&
    state.existingIds.size < MAX_CATALOG_TRACKS

  if (shouldScrapeArtists) {
    for (const artistName of pendingArtists) {
      if (state.existingIds.size >= MAX_CATALOG_TRACKS) break
      if (artistsProcessed >= ARTISTS_PER_CRON_MAX) break
      if (previewResolves >= MAX_PREVIEW_RESOLVES_PER_RUN) break

      const elapsedMs = Date.now() - runStartedAt
      if (artistsProcessed >= ARTISTS_PER_CRON_MIN && elapsedMs >= CRON_TIME_BUDGET_MS) {
        log(
          `Time budget reached after ${artistsProcessed} artists (${Math.round(elapsedMs / 1000)}s); deferring remainder to next cron`,
        )
        break
      }

      client.currentArtistName = artistName
      log(
        `Processing ${artistName} (${checkpoint.completedArtists.size + 1}/${UNIQUE_OPM_ARTISTS.length})`,
      )

      try {
        const tracks = await collectArtistTracks(client, artistName)
        let addedForArtist = 0

        for (const track of tracks) {
          if (state.existingIds.size >= MAX_CATALOG_TRACKS) break
          if (previewResolves >= MAX_PREVIEW_RESOLVES_PER_RUN) break
          if (track.id && state.existingIds.has(track.id)) continue

          const artist = (track.artists ?? []).map((item) => item.name).join(', ')
          previewResolves += 1
          const previews = await resolvePreviewSourcesForTrack({
            title: track.name ?? '',
            artist,
            spotifyPreviewUrl: track.preview_url ?? null,
            spotifyId: track.id,
          })

          if (queueTrack(state, track, previews)) {
            addedForArtist += 1
            tracksAdded += 1
          }
        }

        checkpoint.completedArtists.add(artistName)
        artistsProcessed += 1
        await persistProgress(env, state, checkpoint)
        log(
          `${artistName}: ${tracks.length} candidates, ${addedForArtist} added (${state.existingIds.size} total)`,
        )
      } catch (error) {
        await persistProgress(env, state, checkpoint)
        const status = spotifyErrorStatus(error)
        const message = error instanceof Error ? error.message : String(error)
        if (status === 429) {
          log(`Rate limit pause at ${artistName}; deferring to next cron`)
          errors.push(`Rate limited at ${artistName}`)
          break
        }
        if (status === 403 || status === 404) {
          checkpoint.completedArtists.add(artistName)
          artistsProcessed += 1
          await persistProgress(env, state, checkpoint)
          log(`${artistName}: skipped after ${status}`)
          continue
        }
        log(`Paused at ${artistName}: ${message}`)
        break
      } finally {
        client.currentArtistName = null
      }
    }
  } else {
    log(
      ENABLE_ARTIST_SCRAPE
        ? 'Skipping artist scrape (genre ingest ran or leftover time is too small)'
        : 'Skipping artist scrape (deprioritized; genre playlists are the primary source)',
    )
  }

  await persistProgress(env, state, checkpoint)

  // Newly built tracks have no play count yet. Enrich them now so they are not
  // stuck at the default difficulty until the next cron sweep finds them.
  if (state.insertedIds.size > 0) {
    try {
      await syncPopularityByIds(env, [...state.insertedIds])
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      log(`Public stats enrichment failed for new tracks: ${message}`)
      errors.push(message)
    }
  }

  return {
    skipped: tracksAdded === 0,
    reason: tracksAdded === 0 ? 'no new tracks from genre playlists' : undefined,
    artistsProcessed,
    playlistsProcessed,
    tracksAdded,
    totalTracks: state.existingIds.size,
    genreSource,
    rateLimited: client.didPauseForRateLimit,
    errors,
  }
}
