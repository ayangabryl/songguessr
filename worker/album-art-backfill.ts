import {
  albumArtFromSpotifyTrack,
  hydrateTrackRefsWithAlbumArt,
  type SpotifyGet,
} from './album-art'
import {
  applyAlbumArtPatches as applyD1AlbumArtPatches,
  listTracksMissingAlbumArt,
} from './catalog-d1'
import {
  applyAlbumArtPatches as applyR2AlbumArtPatches,
  loadCatalogFromR2,
} from './catalog-r2'
import type { SpotifyTrackRef } from './opm-artists'
import { getSpotifyClientCredentialsToken, spotifyApiGet } from './spotify-api'
import type { Env } from './types'

export interface AlbumArtBackfillResult {
  missing: number
  backfilled: number
  failed: number
  d1Updated: number
  r2Updated: number
}

export async function backfillMissingAlbumArt(env: Env): Promise<AlbumArtBackfillResult> {
  const clientId = env.SPOTIFY_CLIENT_ID
  const clientSecret = env.SPOTIFY_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw Object.assign(new Error('Spotify is not configured'), { status: 503 })
  }

  let missingFromD1: Array<{ id: string; title: string; artist: string }> = []
  try {
    missingFromD1 = await listTracksMissingAlbumArt(env)
  } catch (error) {
    console.warn(
      `[album-art] D1 missing-art query skipped: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }

  const r2Catalog = await loadCatalogFromR2(env.AUDIO_BUCKET)
  const missingFromR2 = (r2Catalog?.tracks ?? [])
    .filter((track) => !track.albumArt)
    .map((track) => ({ id: track.id, title: track.title, artist: track.artist }))

  const byId = new Map<string, { id: string; title: string; artist: string }>()
  for (const track of [...missingFromD1, ...missingFromR2]) {
    if (track.id) byId.set(track.id, track)
  }
  const missing = [...byId.values()]

  if (missing.length === 0) {
    return { missing: 0, backfilled: 0, failed: 0, d1Updated: 0, r2Updated: 0 }
  }

  const token = await getSpotifyClientCredentialsToken(clientId, clientSecret)
  const spotifyGet: SpotifyGet = (path, params) => spotifyApiGet(token, path, params)
  const stubs: SpotifyTrackRef[] = missing.map((track) => ({
    id: track.id,
    name: track.title,
    artists: track.artist
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean)
      .map((name) => ({ name })),
  }))

  const hydrated = await hydrateTrackRefsWithAlbumArt(spotifyGet, stubs)
  const patches = hydrated
    .map((track) => ({
      id: track.id ?? '',
      albumArt: albumArtFromSpotifyTrack(track),
    }))
    .filter((patch) => patch.id && patch.albumArt)

  let d1Updated = 0
  try {
    d1Updated = await applyD1AlbumArtPatches(env, patches)
  } catch (error) {
    console.warn(
      `[album-art] D1 album-art write skipped: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }

  const r2Updated = await applyR2AlbumArtPatches(env.AUDIO_BUCKET, patches)

  return {
    missing: missing.length,
    backfilled: patches.length,
    failed: missing.length - patches.length,
    d1Updated,
    r2Updated,
  }
}
