import {
  invalidateCatalogCache,
  loadCatalogFromR2,
  loadCheckpointFromR2,
  MAX_CATALOG_TRACKS,
  saveCatalogToR2,
  saveCheckpointToR2,
} from './catalog-r2'
import {
  artistNameScore,
  isOpmSpotifyTrack,
  type SpotifyTrackRef,
  UNIQUE_OPM_ARTISTS,
} from './opm-artists'
import {
  fetchPlaylistTracks,
  isLikelyOpmPlaylistTrack,
  OPM_PLAYLIST_ID,
} from './playlist-source'
import { resolvePreviewSourcesForTrack } from './preview-sources'
import { dedupeTracks } from './track-dedupe'
import type { Catalog, Difficulty, Env, GenreFilter, Track } from './types'

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
const ARTISTS_PER_CRON_MIN = 3
const ARTISTS_PER_CRON_MAX = 5
const CRON_TIME_BUDGET_MS = 4 * 60 * 1000
const MAX_PREVIEW_RESOLVES_PER_RUN = 80
const MAX_PLAYLIST_PREVIEW_RESOLVES = 30
const PLAYLIST_SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms))
}

function assignDifficulty(popularity: number, index: number): Difficulty {
  if (popularity >= 70) return 'easy'
  if (popularity >= 55) return 'medium'
  if (popularity >= 40) return 'hard'
  if (popularity >= 25) return 'expert'
  if (popularity > 0) return 'impossible'

  const levels: Difficulty[] = ['easy', 'medium', 'hard', 'expert', 'impossible']
  return levels[index % levels.length]
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

function parseReleaseYear(releaseDate?: string): number | undefined {
  if (!releaseDate) return undefined
  const year = Number.parseInt(String(releaseDate).slice(0, 4), 10)
  return Number.isInteger(year) ? year : undefined
}

class SpotifyClient {
  private lastRequestAt = 0
  private consecutiveRateLimits = 0
  currentArtistName: string | null = null

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
      if (Number.isFinite(seconds) && seconds > 0) {
        return Math.min(RATE_LIMIT_MAX_BACKOFF_SECONDS, seconds)
      }
    }
    return Math.min(
      RATE_LIMIT_MAX_BACKOFF_SECONDS,
      RATE_LIMIT_BASE_DELAY_SECONDS * 2 ** rateLimitAttempt,
    )
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
      const waitSeconds = retryAfterSeconds + backoffBonus
      this.consecutiveRateLimits += 1
      this.log(`Rate limited, waiting ${waitSeconds}s (${path})`)
      await sleep(waitSeconds * 1000)
      if (this.currentArtistName) {
        this.log(`Resuming artist ${this.currentArtistName}`)
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

function catalogFromTrackMap(trackMap: Map<string, Track>): Catalog {
  const deduped = dedupeTracks([...trackMap.values()])
  return {
    updatedAt: new Date().toISOString(),
    tracks: deduped.sort((left, right) => left.title.localeCompare(right.title)),
  }
}

function addTrack(
  trackMap: Map<string, Track>,
  track: SpotifyTrackRef,
  previews: { previewUrl: string | null; hookPreviewUrl?: string; hookStartSeconds: number },
  index: number,
): boolean {
  const { previewUrl, hookPreviewUrl, hookStartSeconds } = previews
  if (!track?.id || !previewUrl) return false
  if (!isOpmSpotifyTrack(track)) return false
  if (trackMap.has(track.id)) return false

  trackMap.set(track.id, {
    id: track.id,
    title: track.name ?? 'Unknown',
    artist: (track.artists ?? []).map((artist) => artist.name).join(', '),
    previewUrl,
    ...(hookPreviewUrl ? { hookPreviewUrl } : {}),
    hookStartSeconds,
    albumArt: track.album?.images?.[0]?.url ?? '',
    difficulty: assignDifficulty(track.popularity ?? 0, index),
    releaseYear: parseReleaseYear(track.album?.release_date),
    genreGroups: inferGenreGroups(
      (track.artists ?? []).map((artist) => artist.name).join(', '),
      track.name ?? '',
    ),
  })
  return true
}

function shouldSyncPlaylist(playlistSyncedAt?: string): boolean {
  if (!playlistSyncedAt) return true
  const syncedAt = Date.parse(playlistSyncedAt)
  if (!Number.isFinite(syncedAt)) return true
  return Date.now() - syncedAt >= PLAYLIST_SYNC_INTERVAL_MS
}

async function processPlaylistTracks(
  client: SpotifyClient,
  trackMap: Map<string, Track>,
  log: (message: string) => void,
  maxPreviewResolves: number,
): Promise<{ tracksAdded: number; previewResolves: number }> {
  const result = await fetchPlaylistTracks(
    (path, params) => client.get(path, params ?? {}),
    OPM_PLAYLIST_ID,
  )
  log(
    `Playlist "${result.playlistName}": ${result.totalTracks} reported, ${result.tracks.length} fetched (${result.source})`,
  )

  let tracksAdded = 0
  let previewResolves = 0

  for (const track of result.tracks) {
    if (trackMap.size >= MAX_CATALOG_TRACKS) break
    if (previewResolves >= maxPreviewResolves) break
    if (!isLikelyOpmPlaylistTrack(track)) continue
    if (track.id && trackMap.has(track.id)) continue

    const artist = (track.artists ?? []).map((item) => item.name).join(', ')
    previewResolves += 1
    const previews = await resolvePreviewSourcesForTrack({
      title: track.name ?? '',
      artist,
      spotifyPreviewUrl: track.preview_url ?? null,
    })

    if (addTrack(trackMap, track, previews, trackMap.size)) {
      tracksAdded += 1
    }
  }

  log(`Playlist sync: ${tracksAdded} tracks added`)
  return { tracksAdded, previewResolves }
}

export interface CatalogBuildResult {
  skipped: boolean
  reason?: string
  artistsProcessed: number
  tracksAdded: number
  totalTracks: number
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
      tracksAdded: 0,
      totalTracks: 0,
    }
  }

  const existingCatalog = (await loadCatalogFromR2(env.AUDIO_BUCKET)) ?? {
    updatedAt: new Date().toISOString(),
    tracks: [],
  }
  const trackMap = new Map(existingCatalog.tracks.map((track) => [track.id, track]))

  if (trackMap.size >= MAX_CATALOG_TRACKS) {
    log(`Catalog at cap (${trackMap.size} tracks). Skipping build.`)
    return {
      skipped: true,
      reason: 'catalog at 20k cap',
      artistsProcessed: 0,
      tracksAdded: 0,
      totalTracks: trackMap.size,
    }
  }

  const checkpoint = await loadCheckpointFromR2(env.AUDIO_BUCKET)
  const completedArtists = checkpoint.completedArtists
  let playlistSyncedAt = checkpoint.playlistSyncedAt
  const pendingArtists = UNIQUE_OPM_ARTISTS.filter((name) => !completedArtists.has(name))

  const token = await getSpotifyToken(clientId, clientSecret)
  const client = new SpotifyClient(token, log)

  let artistsProcessed = 0
  let tracksAdded = 0
  let previewResolves = 0

  if (shouldSyncPlaylist(playlistSyncedAt) && trackMap.size < MAX_CATALOG_TRACKS) {
    try {
      const playlistResult = await processPlaylistTracks(
        client,
        trackMap,
        log,
        MAX_PLAYLIST_PREVIEW_RESOLVES,
      )
      tracksAdded += playlistResult.tracksAdded
      previewResolves += playlistResult.previewResolves
      playlistSyncedAt = new Date().toISOString()

      const catalog = catalogFromTrackMap(trackMap)
      await saveCatalogToR2(env.AUDIO_BUCKET, catalog)
      await saveCheckpointToR2(env.AUDIO_BUCKET, completedArtists, playlistSyncedAt)
      invalidateCatalogCache()
    } catch (error) {
      log(`Playlist sync failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  if (pendingArtists.length === 0) {
    log('All artists completed.')
    return {
      skipped: tracksAdded === 0,
      reason: tracksAdded === 0 ? 'all artists done' : undefined,
      artistsProcessed: 0,
      tracksAdded,
      totalTracks: trackMap.size,
    }
  }

  const runStartedAt = Date.now()

  for (const artistName of pendingArtists) {
    if (trackMap.size >= MAX_CATALOG_TRACKS) break
    if (artistsProcessed >= ARTISTS_PER_CRON_MAX) break

    const elapsedMs = Date.now() - runStartedAt
    if (artistsProcessed >= ARTISTS_PER_CRON_MIN && elapsedMs >= CRON_TIME_BUDGET_MS) {
      log(
        `Time budget reached after ${artistsProcessed} artists (${Math.round(elapsedMs / 1000)}s); deferring remainder to next cron`,
      )
      break
    }

    client.currentArtistName = artistName
    log(`Processing ${artistName} (${completedArtists.size + 1}/${UNIQUE_OPM_ARTISTS.length})`)

    try {
      const tracks = await collectArtistTracks(client, artistName)
      let addedForArtist = 0

      for (const track of tracks) {
        if (trackMap.size >= MAX_CATALOG_TRACKS) break
        if (previewResolves >= MAX_PREVIEW_RESOLVES_PER_RUN) break

        const artist = (track.artists ?? []).map((item) => item.name).join(', ')
        previewResolves += 1
        const previews = await resolvePreviewSourcesForTrack({
          title: track.name ?? '',
          artist,
          spotifyPreviewUrl: track.preview_url ?? null,
        })

        if (addTrack(trackMap, track, previews, trackMap.size)) {
          addedForArtist += 1
          tracksAdded += 1
        }
      }

      completedArtists.add(artistName)
      artistsProcessed += 1

      const catalog = catalogFromTrackMap(trackMap)
      await saveCatalogToR2(env.AUDIO_BUCKET, catalog)
      await saveCheckpointToR2(env.AUDIO_BUCKET, completedArtists, playlistSyncedAt)
      invalidateCatalogCache()

      log(`${artistName}: ${tracks.length} candidates, ${addedForArtist} added (${catalog.tracks.length} total)`)
    } catch (error) {
      const catalog = catalogFromTrackMap(trackMap)
      await saveCatalogToR2(env.AUDIO_BUCKET, catalog)
      await saveCheckpointToR2(env.AUDIO_BUCKET, completedArtists, playlistSyncedAt)
      invalidateCatalogCache()
      log(`Paused at ${artistName}: ${error instanceof Error ? error.message : String(error)}`)
      throw error
    } finally {
      client.currentArtistName = null
    }
  }

  return {
    skipped: false,
    artistsProcessed,
    tracksAdded,
    totalTracks: trackMap.size,
  }
}
