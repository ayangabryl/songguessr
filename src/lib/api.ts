import {
  type CatalogFilters,
  type CatalogKind,
  type CountryCode,
  type EraFilter,
  type GenreFilter,
  type RegionFilter,
  filtersToSearchParams,
} from './filters'

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert' | 'impossible'

export type { CatalogFilters, CatalogKind, CountryCode, EraFilter, GenreFilter, RegionFilter }
export {
  ERA_LABELS,
  GENRE_LABELS,
  ERA_OPTIONS,
  GENRE_OPTIONS,
  REGION_LABELS,
  REGION_OPTIONS,
  GAME_REGIONS,
} from './filters'

export interface CatalogRegion {
  id: CountryCode
  label: string
  country: CountryCode
  count?: number
}

export interface CatalogCollection {
  id: CatalogKind
  name: string
  emoji: string
  country?: string | null
  trackCount?: number
}

export const ALL_STAGES = [0.01, 0.1, 0.5, 2, 8, 15] as const
export const DEFAULT_STAGES = [0.01, 0.1, 0.5, 2, 8, 15] as const

export interface GameRound {
  seed: string
  difficulty: Difficulty
  trackId: string
  songKey: string
  previewUrl: string
  hookPreviewUrl?: string
  hookStartSeconds?: number
  audioUrl?: string
  introClipUrl?: string
  hookClipUrl?: string
  startAtMs?: number
  hookStartMs?: number
  albumArt: string
  stages: number[]
  filters: CatalogFilters
}

export interface SearchResult {
  id: string
  title: string
  artist: string
  albumArt: string
}

export interface GuessResult {
  correct: boolean
  answer: SearchResult | null
}

export interface AvailabilityCounts {
  counts: Record<Difficulty, number>
  total: number
}

async function parseJson<T>(response: Response): Promise<T> {
  const data = (await response.json()) as T & { message?: string; error?: string }
  if (!response.ok) {
    throw new Error(data.message ?? data.error ?? `Request failed (${response.status})`)
  }
  return data
}

export async function fetchRegions(): Promise<CatalogRegion[]> {
  try {
    const response = await fetch('/api/catalog/regions')
    const data = await parseJson<{ regions: CatalogRegion[] }>(response)
    return data.regions
  } catch {
    return []
  }
}

export async function fetchCollections(): Promise<CatalogCollection[]> {
  try {
    const response = await fetch('/api/catalog/catalogs')
    const data = await parseJson<{
      collections?: CatalogCollection[]
      catalogs?: CatalogCollection[]
    }>(response)
    return data.collections ?? data.catalogs ?? []
  } catch {
    return []
  }
}

export async function fetchAvailability(filters: CatalogFilters): Promise<AvailabilityCounts> {
  const query = filtersToSearchParams(filters).replace(/^&/, '')
  const suffix = query ? `?${query}` : ''
  const response = await fetch(`/api/catalog/availability${suffix}`)
  return parseJson<AvailabilityCounts>(response)
}

export async function fetchRandomRound(
  difficulty: Difficulty,
  filters: CatalogFilters,
  options: { excludeTrackIds?: string[]; excludeSongKeys?: string[] } = {},
): Promise<GameRound> {
  const exclude = options.excludeTrackIds?.filter(Boolean) ?? []
  const excludeSongs = options.excludeSongKeys?.filter(Boolean) ?? []
  const excludeParam = exclude.length > 0 ? `&exclude=${encodeURIComponent(exclude.join(','))}` : ''
  const excludeSongsParam =
    excludeSongs.length > 0 ? `&excludeSongs=${encodeURIComponent(excludeSongs.join(','))}` : ''
  const seed = crypto.randomUUID()
  const bust = Date.now().toString(36)
  const response = await fetch(
    `/api/random?difficulty=${difficulty}&seed=${encodeURIComponent(seed)}&_=${bust}${filtersToSearchParams(filters)}${excludeParam}${excludeSongsParam}`,
    {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
      },
    },
  )
  const round = await parseJson<Omit<GameRound, 'filters'>>(response)
  return { ...round, filters }
}

export async function searchTracks(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return []
  const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
  const data = await parseJson<{ results: SearchResult[] }>(response)
  return data.results
}

export async function submitGuess(
  round: GameRound,
  options: { guessedTrackId?: string; guess?: string; reveal?: boolean },
): Promise<GuessResult> {
  const response = await fetch('/api/guess', {
    method: 'POST',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify({
      trackId: round.trackId,
      guessedTrackId: options.guessedTrackId,
      guess: options.guess,
      difficulty: round.difficulty,
      seed: round.seed,
      reveal: options.reveal ?? false,
      eras: round.filters.eras,
      genres: round.filters.genres,
      countries: round.filters.countries,
      regions: round.filters.countries,
      collections: round.filters.collections,
      catalogs: round.filters.collections,
    }),
  })
  return parseJson<GuessResult>(response)
}
