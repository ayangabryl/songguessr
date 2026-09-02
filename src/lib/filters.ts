import {
  COUNTRY_LABELS,
  GAME_REGIONS,
  REGION_LABELS,
  REGION_OPTIONS,
  type CountryCode,
  type RegionFilter,
} from '../../shared/catalog-meta'
import { readMigratedItem } from './storage'

export const ERA_OPTIONS = ['modern', '2010s', '2000s', 'classics'] as const
export const GENRE_OPTIONS = ['pop', 'hip-hop', 'r&b', 'rock', 'dance', 'other'] as const
export { COUNTRY_LABELS, GAME_REGIONS, REGION_LABELS, REGION_OPTIONS }
export type { CountryCode, RegionFilter }

export type EraFilter = (typeof ERA_OPTIONS)[number]
export type GenreFilter = (typeof GENRE_OPTIONS)[number]

export interface CatalogFilters {
  eras: EraFilter[]
  genres: GenreFilter[]
  countries: CountryCode[]
}

export const ERA_LABELS: Record<EraFilter | 'all', string> = {
  all: 'All eras',
  modern: 'Modern (2020+)',
  '2010s': '2010s',
  '2000s': '2000s',
  classics: 'Classics (pre-2000)',
}

export const GENRE_LABELS: Record<GenreFilter | 'all', string> = {
  all: 'All genres',
  pop: 'Pop',
  'hip-hop': 'Hip-hop / Rap',
  'r&b': 'R&B / Soul',
  rock: 'Rock / Alternative',
  dance: 'Dance / Electronic',
  other: 'Other / Unclassified',
}

const ERA_KEY = 'songguessr-era-filter'
const GENRE_KEY = 'songguessr-genre-filter'
const REGION_KEY = 'songguessr-region-filter'
const LEGACY_ERA_KEY = 'songgussr-era-filter'
const LEGACY_GENRE_KEY = 'songgussr-genre-filter'

export function loadEraFilters(): EraFilter[] {
  try {
    const raw = readMigratedItem(localStorage, ERA_KEY, [LEGACY_ERA_KEY])
    if (!raw) return []
    const parsed = JSON.parse(raw) as string[]
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is EraFilter =>
      ERA_OPTIONS.includes(item as EraFilter),
    )
  } catch {
    return []
  }
}

export function loadGenreFilters(): GenreFilter[] {
  try {
    const raw = readMigratedItem(localStorage, GENRE_KEY, [LEGACY_GENRE_KEY])
    if (!raw) return []
    const parsed = JSON.parse(raw) as string[]
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is GenreFilter =>
      GENRE_OPTIONS.includes(item as GenreFilter),
    )
  } catch {
    return []
  }
}

export function saveEraFilters(eras: EraFilter[]) {
  localStorage.setItem(ERA_KEY, JSON.stringify(eras))
}

export function saveGenreFilters(genres: GenreFilter[]) {
  localStorage.setItem(GENRE_KEY, JSON.stringify(genres))
}

export function loadRegionFilters(): CountryCode[] {
  try {
    const raw = localStorage.getItem(REGION_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as string[]
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item) => item.trim().toUpperCase())
      .filter((item): item is CountryCode =>
        (REGION_OPTIONS as readonly string[]).includes(item),
      )
  } catch {
    return []
  }
}

export function saveRegionFilters(countries: CountryCode[]) {
  localStorage.setItem(REGION_KEY, JSON.stringify(countries))
}

export function toggleFilterValue<T extends string>(current: T[], value: T, allValues: readonly T[]): T[] {
  if (current.includes(value)) {
    return current.filter((item) => item !== value)
  }
  return [...current, value].sort(
    (left, right) => allValues.indexOf(left) - allValues.indexOf(right),
  )
}

export function activeFilterCount(filters: CatalogFilters): number {
  return filters.eras.length + filters.genres.length + filters.countries.length
}

export function filtersToSearchParams(filters: CatalogFilters): string {
  const params = new URLSearchParams()
  if (filters.eras.length > 0) params.set('eras', filters.eras.join(','))
  if (filters.genres.length > 0) params.set('genres', filters.genres.join(','))
  if (filters.countries.length > 0) {
    params.set('countries', filters.countries.join(','))
    params.set('regions', filters.countries.join(','))
  }
  const query = params.toString()
  return query ? `&${query}` : ''
}
