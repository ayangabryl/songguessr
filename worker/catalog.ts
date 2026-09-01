import { CATALOG_SEED_MESSAGE, getCachedCatalog } from './catalog-r2'
import type { CatalogFilters } from './filters'
import { filterTracks } from './filters'
import { dedupeTracks, songIdentityKey } from './track-dedupe.ts'
import type { Catalog, Difficulty, Env, Track } from './types'

export { CATALOG_SEED_MESSAGE }

export class CatalogUnavailableError extends Error {
  constructor(message = CATALOG_SEED_MESSAGE) {
    super(message)
    this.name = 'CatalogUnavailableError'
  }
}

async function loadTracks(env: Env): Promise<Track[]> {
  const catalog = await getCachedCatalog(env.AUDIO_BUCKET)
  if (!catalog) {
    throw new CatalogUnavailableError()
  }
  return dedupeTracks(catalog.tracks)
}

export async function getCatalog(env: Env): Promise<Catalog> {
  const catalog = await getCachedCatalog(env.AUDIO_BUCKET)
  if (!catalog) {
    throw new CatalogUnavailableError()
  }
  return {
    ...catalog,
    tracks: dedupeTracks(catalog.tracks),
  }
}

export async function getTracksByDifficulty(
  env: Env,
  difficulty: Difficulty,
  filters: CatalogFilters = { eras: [], genres: [] },
): Promise<Track[]> {
  const tracks = await loadTracks(env)
  return filterTracks(
    tracks.filter((track) => track.difficulty === difficulty),
    filters,
  )
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
  seed: string,
  filters: CatalogFilters = { eras: [], genres: [] },
  excludeIds: ReadonlySet<string> = new Set(),
  excludeSongKeys: ReadonlySet<string> = new Set(),
): Promise<Track | null> {
  const allTracks = await getTracksByDifficulty(env, difficulty, filters)
  if (allTracks.length === 0) return null

  const matchesExcludes = (track: Track) =>
    !excludeIds.has(track.id) && !excludeSongKeys.has(songIdentityKey(track))

  let tracks = allTracks.filter(matchesExcludes)
  if (tracks.length === 0) {
    tracks = allTracks.filter((track) => !excludeSongKeys.has(songIdentityKey(track)))
  }
  if (tracks.length === 0) {
    tracks = allTracks.filter((track) => !excludeIds.has(track.id))
  }
  if (tracks.length === 0) {
    tracks = allTracks
  }

  const index = pickIndexFromSeed(seed, tracks.length)
  return tracks[index] ?? null
}

export async function findTrackById(env: Env, id: string): Promise<Track | undefined> {
  const tracks = await loadTracks(env)
  return tracks.find((track) => track.id === id)
}

export async function getAvailabilityCounts(
  env: Env,
  filters: CatalogFilters,
): Promise<Record<Difficulty, number>> {
  const difficulties: Difficulty[] = ['easy', 'medium', 'hard', 'expert', 'impossible']
  const counts = await Promise.all(
    difficulties.map(async (difficulty) => [
      difficulty,
      (await getTracksByDifficulty(env, difficulty, filters)).length,
    ] as const),
  )
  return Object.fromEntries(counts) as Record<Difficulty, number>
}

export async function searchCatalog(env: Env, query: string, limit = 50): Promise<Track[]> {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return []

  const tracks = await loadTracks(env)
  return tracks
    .filter((track) => {
      const haystack = `${track.title} ${track.artist}`.toLowerCase()
      return haystack.includes(normalized)
    })
    .sort((left, right) => left.title.localeCompare(right.title))
    .slice(0, limit)
}
