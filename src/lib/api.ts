import {
  type CatalogFilters,
  type EraFilter,
  type GenreFilter,
  filtersToSearchParams,
} from './filters'

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert' | 'impossible'

export type { CatalogFilters, EraFilter, GenreFilter }
export { ERA_LABELS, GENRE_LABELS, ERA_OPTIONS, GENRE_OPTIONS } from './filters'

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
  const response = await fetch(
    `/api/random?difficulty=${difficulty}&seed=${encodeURIComponent(seed)}${filtersToSearchParams(filters)}${excludeParam}${excludeSongsParam}`,
    { cache: 'no-store' },
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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      trackId: round.trackId,
      guessedTrackId: options.guessedTrackId,
      guess: options.guess,
      difficulty: round.difficulty,
      seed: round.seed,
      reveal: options.reveal ?? false,
      eras: round.filters.eras,
      genres: round.filters.genres,
    }),
  })
  return parseJson<GuessResult>(response)
}
