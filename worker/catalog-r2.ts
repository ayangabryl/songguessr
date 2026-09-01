import { dedupeTracks } from './track-dedupe'
import type { Catalog, Track } from './types'

export const CATALOG_R2_KEY = 'catalog/catalog.json'
export const CHECKPOINT_R2_KEY = 'catalog/build-checkpoint.json'
export const MAX_CATALOG_TRACKS = 20_000

/** In-memory cache TTL (10 minutes). */
const CACHE_TTL_MS = 10 * 60 * 1000

interface CatalogCacheEntry {
  catalog: Catalog
  loadedAt: number
}

let catalogCache: CatalogCacheEntry | null = null

export interface CatalogCheckpoint {
  completedArtists: string[]
  playlistSyncedAt?: string
  genreSyncedAt?: string
  genrePlaylistCursor?: number
  genreSource?: string
}

export function invalidateCatalogCache(): void {
  catalogCache = null
}

export async function loadCatalogFromR2(bucket: R2Bucket): Promise<Catalog | null> {
  const object = await bucket.get(CATALOG_R2_KEY)
  if (!object) return null

  try {
    const parsed = JSON.parse(await object.text()) as Catalog
    if (!parsed?.tracks || !Array.isArray(parsed.tracks)) return null
    return parsed
  } catch {
    return null
  }
}

export async function saveCatalogToR2(bucket: R2Bucket, catalog: Catalog): Promise<void> {
  await bucket.put(CATALOG_R2_KEY, JSON.stringify(catalog), {
    httpMetadata: { contentType: 'application/json' },
  })
  catalogCache = { catalog, loadedAt: Date.now() }
}

export interface CheckpointState {
  completedArtists: Set<string>
  playlistSyncedAt?: string
  genreSyncedAt?: string
  genrePlaylistCursor?: number
  genreSource?: string
}

export async function loadCheckpointFromR2(bucket: R2Bucket): Promise<CheckpointState> {
  const object = await bucket.get(CHECKPOINT_R2_KEY)
  if (!object) return { completedArtists: new Set() }

  try {
    const parsed = JSON.parse(await object.text()) as CatalogCheckpoint
    return {
      completedArtists: new Set(
        Array.isArray(parsed.completedArtists) ? parsed.completedArtists : [],
      ),
      playlistSyncedAt: parsed.playlistSyncedAt,
      genreSyncedAt: parsed.genreSyncedAt,
      genrePlaylistCursor: parsed.genrePlaylistCursor,
      genreSource: parsed.genreSource,
    }
  } catch {
    return { completedArtists: new Set() }
  }
}

export async function saveCheckpointToR2(
  bucket: R2Bucket,
  checkpoint: CheckpointState,
): Promise<void> {
  const payload: CatalogCheckpoint = {
    completedArtists: [...checkpoint.completedArtists],
    ...(checkpoint.playlistSyncedAt ? { playlistSyncedAt: checkpoint.playlistSyncedAt } : {}),
    ...(checkpoint.genreSyncedAt ? { genreSyncedAt: checkpoint.genreSyncedAt } : {}),
    ...(checkpoint.genrePlaylistCursor !== undefined
      ? { genrePlaylistCursor: checkpoint.genrePlaylistCursor }
      : {}),
    ...(checkpoint.genreSource ? { genreSource: checkpoint.genreSource } : {}),
  }
  await bucket.put(CHECKPOINT_R2_KEY, JSON.stringify(payload), {
    httpMetadata: { contentType: 'application/json' },
  })
}

export const CATALOG_SEED_MESSAGE =
  'Catalog not found in R2. Run `npm run upload:catalog` to seed the catalog.'

export async function getCachedCatalog(bucket: R2Bucket): Promise<Catalog | null> {
  const now = Date.now()
  if (catalogCache && now - catalogCache.loadedAt < CACHE_TTL_MS) {
    return catalogCache.catalog
  }

  const fromR2 = await loadCatalogFromR2(bucket)
  if (fromR2) {
    catalogCache = { catalog: fromR2, loadedAt: now }
    return fromR2
  }

  return null
}

export interface CatalogMutationResult {
  ok: boolean
  reason?: string
  totalTracks?: number
}

export async function addTrackToCatalog(
  bucket: R2Bucket,
  track: Track,
): Promise<CatalogMutationResult> {
  const catalog = (await loadCatalogFromR2(bucket)) ?? {
    updatedAt: new Date().toISOString(),
    tracks: [],
  }

  const existingIds = new Set(catalog.tracks.map((item) => item.id))
  if (existingIds.has(track.id)) {
    return { ok: false, reason: 'Track already in catalog', totalTracks: catalog.tracks.length }
  }

  if (catalog.tracks.length >= MAX_CATALOG_TRACKS) {
    return {
      ok: false,
      reason: `Catalog at ${MAX_CATALOG_TRACKS.toLocaleString()} track cap`,
      totalTracks: catalog.tracks.length,
    }
  }

  const nextCatalog: Catalog = {
    updatedAt: new Date().toISOString(),
    tracks: dedupeTracks([...catalog.tracks, track]).sort((left, right) =>
      left.title.localeCompare(right.title),
    ),
  }

  await saveCatalogToR2(bucket, nextCatalog)
  return { ok: true, totalTracks: nextCatalog.tracks.length }
}

export async function removeTrackFromCatalog(
  bucket: R2Bucket,
  trackId: string,
): Promise<CatalogMutationResult> {
  const catalog = await loadCatalogFromR2(bucket)
  if (!catalog) {
    return { ok: false, reason: 'Catalog not found' }
  }

  const nextTracks = catalog.tracks.filter((track) => track.id !== trackId)
  if (nextTracks.length === catalog.tracks.length) {
    return { ok: false, reason: 'Track not found', totalTracks: catalog.tracks.length }
  }

  const nextCatalog: Catalog = {
    updatedAt: new Date().toISOString(),
    tracks: nextTracks,
  }

  await saveCatalogToR2(bucket, nextCatalog)
  return { ok: true, totalTracks: nextCatalog.tracks.length }
}
