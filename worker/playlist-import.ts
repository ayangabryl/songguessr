import { findExistingTrackIds, insertTracks, MAX_CATALOG_TRACKS } from './catalog-d1'
import { isOpmSpotifyTrack } from './opm-artists'
import {
  fetchPlaylistTracks,
  MAX_PLAYLIST_TRACKS,
  parseSpotifyPlaylistId,
  type PlaylistTrackSource,
} from './playlist-source'
import { getSpotifyClientCredentialsToken, spotifyApiGet } from './spotify-api'
import { buildTrackFromSpotify } from './track-builder'
import type { Env, Track } from './types'

const IMPORT_TIME_BUDGET_MS = 90_000
const PERSIST_EVERY_ADDED = 10
const MAX_ERROR_MESSAGES = 8

export type PlaylistImportPhase = 'fetching' | 'filtering' | 'resolving' | 'saving' | 'done'

export interface PlaylistImportProgress {
  phase: PlaylistImportPhase
  processed: number
  total: number
  added: number
  skipped: number
  playlistName?: string
}

export interface PlaylistImportResult {
  added: number
  skippedExisting: number
  skippedNonOpm: number
  skippedNoPreview: number
  errors: string[]
  playlistId: string
  playlistName: string
  source: PlaylistTrackSource
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
  onProgress?: (progress: PlaylistImportProgress) => void,
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

  onProgress?.({
    phase: 'fetching',
    processed: 0,
    total: 0,
    added: 0,
    skipped: 0,
  })

  const token = await getSpotifyClientCredentialsToken(clientId, clientSecret)
  const spotifyGet = (path: string, params?: Record<string, string | number | undefined>) =>
    spotifyApiGet(token, path, params)

  const playlist = await fetchPlaylistTracks(spotifyGet, playlistId)
  const existingIds = await findExistingTrackIds(
    env,
    playlist.tracks.map((track) => track.id).filter((id): id is string => Boolean(id)),
  )
  const tracks = playlist.tracks.slice(0, MAX_PLAYLIST_TRACKS)
  const total = tracks.length

  const pending: Track[] = []
  let added = 0
  let skippedExisting = 0
  let skippedNonOpm = 0
  let skippedNoPreview = 0
  const errors: string[] = []
  const runStartedAt = Date.now()

  const skipped = () => skippedExisting + skippedNonOpm + skippedNoPreview
  let currentProcessed = 0

  const report = (phase: PlaylistImportPhase, processed: number) => {
    currentProcessed = processed
    onProgress?.({
      phase,
      processed,
      total,
      added,
      skipped: skipped(),
      playlistName: playlist.playlistName,
    })
  }

  report('filtering', 0)

  const persistPending = async (): Promise<boolean> => {
    if (pending.length === 0) return false
    report('saving', currentProcessed)
    const saved = await insertTracks(env, pending)
    added += saved.added
    pending.length = 0
    if (saved.skippedCap > 0) {
      pushError(errors, `Catalog at ${MAX_CATALOG_TRACKS.toLocaleString()} track cap`)
      return true
    }
    return false
  }

  for (const [index, track] of tracks.entries()) {
    if (existingIds.size >= MAX_CATALOG_TRACKS) {
      pushError(errors, `Catalog at ${MAX_CATALOG_TRACKS.toLocaleString()} track cap`)
      break
    }

    if (Date.now() - runStartedAt >= IMPORT_TIME_BUDGET_MS) {
      pushError(errors, 'Stopped after time budget. Re-run to continue.')
      break
    }

    if (!track?.id) {
      report('filtering', index + 1)
      continue
    }

    if (existingIds.has(track.id)) {
      skippedExisting += 1
      report('filtering', index + 1)
      continue
    }

    if (!isOpmSpotifyTrack(track)) {
      skippedNonOpm += 1
      report('filtering', index + 1)
      continue
    }

    try {
      report('resolving', index + 1)
      const built = await buildTrackFromSpotify(track)
      if (!built.track) {
        if (built.reason?.toLowerCase().includes('preview')) {
          skippedNoPreview += 1
        } else if (built.reason?.toLowerCase().includes('opm')) {
          skippedNonOpm += 1
        } else {
          pushError(errors, built.reason ?? `Could not add ${track.name ?? track.id}`)
        }
        report('resolving', index + 1)
        continue
      }

      pending.push(built.track)
      existingIds.add(built.track.id)

      if (pending.length >= PERSIST_EVERY_ADDED) {
        const hitCap = await persistPending()
        report('resolving', index + 1)
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
      report('resolving', index + 1)
    }
  }

  await persistPending()
  report('done', total)

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
