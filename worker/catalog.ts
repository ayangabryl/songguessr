import catalogData from '../data/catalog.json'
import type { CatalogFilters } from './filters'
import { filterTracks } from './filters'
import { dedupeTracks, songIdentityKey } from './track-dedupe.ts'
import type { Catalog, Difficulty, Track } from './types'

const catalog = catalogData as Catalog
const uniqueTracks = dedupeTracks(catalog.tracks)

export function getCatalog(): Catalog {
  return {
    ...catalog,
    tracks: uniqueTracks,
  }
}

export function getTracksByDifficulty(difficulty: Difficulty, filters: CatalogFilters = { eras: [], genres: [] }): Track[] {
  return filterTracks(
    uniqueTracks.filter((track) => track.difficulty === difficulty),
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

export function pickRandomTrack(
  difficulty: Difficulty,
  seed: string,
  filters: CatalogFilters = { eras: [], genres: [] },
  excludeIds: ReadonlySet<string> = new Set(),
  excludeSongKeys: ReadonlySet<string> = new Set(),
): Track | null {
  const allTracks = getTracksByDifficulty(difficulty, filters)
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

export function findTrackById(id: string): Track | undefined {
  return uniqueTracks.find((track) => track.id === id)
}

export function getAvailabilityCounts(filters: CatalogFilters): Record<Difficulty, number> {
  const difficulties: Difficulty[] = ['easy', 'medium', 'hard', 'expert', 'impossible']
  return Object.fromEntries(
    difficulties.map((difficulty) => [difficulty, getTracksByDifficulty(difficulty, filters).length]),
  ) as Record<Difficulty, number>
}

export function searchCatalog(query: string, limit = 50): Track[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return []

  return uniqueTracks
    .filter((track) => {
      const haystack = `${track.title} ${track.artist}`.toLowerCase()
      return haystack.includes(normalized)
    })
    .sort((left, right) => left.title.localeCompare(right.title))
    .slice(0, limit)
}
