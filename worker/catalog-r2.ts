import type { Catalog } from './types'

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

export async function loadCheckpointFromR2(bucket: R2Bucket): Promise<{
  completedArtists: Set<string>
  playlistSyncedAt?: string
}> {
  const object = await bucket.get(CHECKPOINT_R2_KEY)
  if (!object) return { completedArtists: new Set() }

  try {
    const parsed = JSON.parse(await object.text()) as CatalogCheckpoint
    return {
      completedArtists: new Set(
        Array.isArray(parsed.completedArtists) ? parsed.completedArtists : [],
      ),
      playlistSyncedAt: parsed.playlistSyncedAt,
    }
  } catch {
    return { completedArtists: new Set() }
  }
}

export async function saveCheckpointToR2(
  bucket: R2Bucket,
  completedArtists: Set<string>,
  playlistSyncedAt?: string,
): Promise<void> {
  const payload: CatalogCheckpoint = {
    completedArtists: [...completedArtists],
    ...(playlistSyncedAt ? { playlistSyncedAt } : {}),
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
