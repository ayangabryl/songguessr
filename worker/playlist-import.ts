import {
  addTracksToCatalog,
  loadCatalogFromR2,
  MAX_CATALOG_TRACKS,
} from './catalog-r2'
import { isOpmSpotifyTrack } from './opm-artists'
import {
  fetchPlaylistTracks,
  MAX_PLAYLIST_TRACKS,
  parseSpotifyPlaylistId,
} from './playlist-source'
import { getSpotifyClientCredentialsToken, spotifyApiGet } from './spotify-api'
import { buildTrackFromSpotify } from './track-builder'
import type { Env, Track } from './types'

const IMPORT_TIME_BUDGET_MS = 90_000
const PERSIST_EVERY_ADDED = 10
const MAX_ERROR_MESSAGES = 8

export interface PlaylistImportResult {
  added: number
  skippedExisting: number
  skippedNonOpm: number
  skippedNoPreview: number
  errors: string[]
  playlistId: string
  playlistName: string
  source: 'spotify-api' | 'archive-fallback'
  fetched: number
}

function pushError(errors: string[], message: string): void {
  if (errors.length < MAX_ERROR_MESSAGES) {
    errors.push(message)
    return
  }
  if (errors.length === MAX_ERROR_MESSAGES) {
    errors.push('Additional errors omitted')
  }
}

export async function importPlaylistToCatalog(
  env: Env,
  playlistUrl: string,
): Promise<PlaylistImportResult> {
  const playlistId = parseSpotifyPlaylistId(playlistUrl)
  if (!playlistId) {
    throw Object.assign(new Error('Invalid Spotify playlist URL or ID'), { status: 400 })
  }

  const clientId = env.SPOTIFY_CLIENT_ID
  const clientSecret = env.SPOTIFY_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw Object.assign(new Error('Spotify is not configured'), { status: 503 })
  }

  const token = await getSpotifyClientCredentialsToken(clientId, clientSecret)
  const spotifyGet = (path: string, params?: Record<string, string | number | undefined>) =>
    spotifyApiGet(token, path, params)

  const playlist = await fetchPlaylistTracks(spotifyGet, playlistId)
  const existingCatalog = (await loadCatalogFromR2(env.AUDIO_BUCKET)) ?? {
    updatedAt: new Date().toISOString(),
    tracks: [],
  }
  const existingIds = new Set(existingCatalog.tracks.map((track) => track.id))

  const pending: Track[] = []
  let added = 0
  let skippedExisting = 0
  let skippedNonOpm = 0
  let skippedNoPreview = 0
  const errors: string[] = []
  const runStartedAt = Date.now()

  const persistPending = async (): Promise<boolean> => {
    if (pending.length === 0) return false
    const saved = await addTracksToCatalog(env.AUDIO_BUCKET, pending)
    added += saved.added
    pending.length = 0
    if (saved.skippedCap > 0) {
      pushError(errors, `Catalog at ${MAX_CATALOG_TRACKS.toLocaleString()} track cap`)
      return true
    }
    return false
  }

  for (const track of playlist.tracks.slice(0, MAX_PLAYLIST_TRACKS)) {
    if (existingIds.size >= MAX_CATALOG_TRACKS) {
      pushError(errors, `Catalog at ${MAX_CATALOG_TRACKS.toLocaleString()} track cap`)
      break
    }

    if (Date.now() - runStartedAt >= IMPORT_TIME_BUDGET_MS) {
      pushError(errors, 'Stopped after time budget. Re-run to continue.')
      break
    }

    if (!track?.id) continue

    if (existingIds.has(track.id)) {
      skippedExisting += 1
      continue
    }

    if (!isOpmSpotifyTrack(track)) {
      skippedNonOpm += 1
      continue
    }

    try {
      const built = await buildTrackFromSpotify(track, existingIds.size + pending.length)
      if (!built.track) {
        if (built.reason?.toLowerCase().includes('preview')) {
          skippedNoPreview += 1
        } else if (built.reason?.toLowerCase().includes('opm')) {
          skippedNonOpm += 1
        } else {
          pushError(errors, built.reason ?? `Could not add ${track.name ?? track.id}`)
        }
        continue
      }

      pending.push(built.track)
      existingIds.add(built.track.id)

      if (pending.length >= PERSIST_EVERY_ADDED) {
        const hitCap = await persistPending()
        if (hitCap) break
      }
    } catch (error) {
      const status = (error as { status?: number }).status
      if (status === 429) {
        pushError(errors, 'Spotify rate limited')
        break
      }
      pushError(
        errors,
        error instanceof Error ? error.message : `Failed ${track.name ?? track.id}`,
      )
    }
  }

  await persistPending()

  return {
    added,
    skippedExisting,
    skippedNonOpm,
    skippedNoPreview,
    errors,
    playlistId: playlist.playlistId,
    playlistName: playlist.playlistName,
    source: playlist.source,
    fetched: playlist.tracks.length,
  }
}
