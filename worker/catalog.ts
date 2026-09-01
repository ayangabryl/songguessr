import {
  CATALOG_SEED_MESSAGE,
  CatalogUnavailableError,
  findTrackById as findTrackByIdFromD1,
  getAvailabilityCounts as getAvailabilityCountsFromD1,
  getCatalogStats,
  pickRandomTrack as pickRandomTrackFromD1,
  searchCatalog as searchCatalogFromD1,
} from './catalog-d1'
import type { CatalogFilters } from './filters'
import type { Catalog, Difficulty, Env, Track } from './types'

export { CATALOG_SEED_MESSAGE, CatalogUnavailableError }

export async function getCatalog(env: Env): Promise<Catalog> {
  const stats = await getCatalogStats(env)
  if (stats.count === 0) {
    throw new CatalogUnavailableError()
  }
  return {
    updatedAt: stats.updatedAt ?? new Date().toISOString(),
    tracks: [],
  }
}

export function hashString(value: string): number {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function pickIndexFromSeed(seed: string, length: number): number {
  if (length <= 1) return 0

  const h1 = hashString(seed)
  const h2 = hashString(`${seed}:pick`)
  const combined = (Math.imul(h1, 31) + h2) >>> 0
  return combined % length
}

export async function pickRandomTrack(
  env: Env,
  difficulty: Difficulty,
  _seed: string,
  filters: CatalogFilters = { eras: [], genres: [] },
  excludeIds: ReadonlySet<string> = new Set(),
  excludeSongKeys: ReadonlySet<string> = new Set(),
): Promise<Track | null> {
  return pickRandomTrackFromD1(env, difficulty, filters, excludeIds, excludeSongKeys)
}

export async function findTrackById(env: Env, id: string): Promise<Track | undefined> {
  return findTrackByIdFromD1(env, id)
}

export async function getAvailabilityCounts(
  env: Env,
  filters: CatalogFilters,
): Promise<Record<Difficulty, number>> {
  return getAvailabilityCountsFromD1(env, filters)
}

export async function searchCatalog(env: Env, query: string, limit = 50): Promise<Track[]> {
  return searchCatalogFromD1(env, query, limit)
}
