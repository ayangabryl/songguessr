import {
  COUNTRY_CODES,
  COUNTRY_LABELS,
  GAME_REGIONS,
  REGION_LABELS,
  REGION_OPTIONS,
  isCatalogKind,
  isCountryCode,
  type CatalogKind,
  type CountryCode,
  type RegionFilter,
} from '../../shared/catalog-meta'
import { ISO_COUNTRY_CODES } from '../../shared/iso-countries'
import { readMigratedItem } from './storage'

export const ERA_OPTIONS = ['modern', '2010s', '2000s', 'classics'] as const
export const GENRE_OPTIONS = ['pop', 'hip-hop', 'r&b', 'rock', 'dance', 'other'] as const
export {
  COUNTRY_CODES,
  COUNTRY_LABELS,
  GAME_REGIONS,
  ISO_COUNTRY_CODES,
  REGION_LABELS,
  REGION_OPTIONS,
}
export type { CatalogKind, CountryCode, RegionFilter }

export type EraFilter = (typeof ERA_OPTIONS)[number]
export type GenreFilter = (typeof GENRE_OPTIONS)[number]

export interface CatalogFilters {
  eras: EraFilter[]
  genres: GenreFilter[]
  countries: CountryCode[]
  collections: CatalogKind[]
  artists: string[]
}

export const ERA_LABELS: Record<EraFilter | 'all', string> = {
  all: 'All',
  modern: '2020s',
  '2010s': '2010s',
  '2000s': '2000s',
  classics: 'Classics',
}

export const GENRE_LABELS: Record<GenreFilter | 'all', string> = {
  all: 'All',
  pop: 'Pop',
  'hip-hop': 'Hip-hop',
  'r&b': 'R&B',
  rock: 'Rock',
  dance: 'Dance',
  other: 'Other',
}

const ERA_KEY = 'songguessr-era-filter'
const GENRE_KEY = 'songguessr-genre-filter'
const REGION_KEY = 'songguessr-region-filter'
const COLLECTION_KEY = 'songguessr-collection-filter'
const ARTIST_KEY = 'songguessr-artist-filter'
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
      .filter((item): item is CountryCode => isCountryCode(item))
  } catch {
    return []
  }
}

export function saveRegionFilters(countries: CountryCode[]) {
  localStorage.setItem(REGION_KEY, JSON.stringify(countries))
}

export function loadCollectionFilters(): CatalogKind[] {
  try {
    const raw = localStorage.getItem(COLLECTION_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as string[]
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item) => item.trim().toLowerCase())
      .filter((item): item is CatalogKind => isCatalogKind(item))
  } catch {
    return []
  }
}

export function saveCollectionFilters(collections: CatalogKind[]) {
  localStorage.setItem(COLLECTION_KEY, JSON.stringify(collections))
}

export function loadArtistFilters(): string[] {
  try {
    const raw = localStorage.getItem(ARTIST_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as string[]
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item) => item.length > 0 && item.length <= 80)
      .slice(0, 12)
  } catch {
    return []
  }
}

export function saveArtistFilters(artists: string[]) {
  localStorage.setItem(ARTIST_KEY, JSON.stringify(artists))
}

export function toggleFilterValue<T extends string>(current: T[], value: T, allValues: readonly T[]): T[] {
  if (current.includes(value)) {
    return current.filter((item) => item !== value)
  }
  return [...current, value].sort(
    (left, right) => allValues.indexOf(left) - allValues.indexOf(right),
  )
}

export function toggleArtistFilter(current: string[], name: string): string[] {
  const key = name.trim().toLowerCase()
  if (!key) return current
  if (current.some((item) => item.toLowerCase() === key)) {
    return current.filter((item) => item.toLowerCase() !== key)
  }
  return [...current, name.trim()].slice(0, 12)
}

export function activeFilterCount(filters: CatalogFilters): number {
  return (
    filters.eras.length +
    filters.genres.length +
    filters.countries.length +
    filters.collections.length +
    filters.artists.length
  )
}

export function filtersToSearchParams(filters: CatalogFilters): string {
  const params = new URLSearchParams()
  if (filters.eras.length > 0) params.set('eras', filters.eras.join(','))
  if (filters.genres.length > 0) params.set('genres', filters.genres.join(','))
  if (filters.countries.length > 0) {
    params.set('countries', filters.countries.join(','))
    params.set('regions', filters.countries.join(','))
  }
  if (filters.collections.length > 0) {
    params.set('collections', filters.collections.join(','))
    params.set('catalogs', filters.collections.join(','))
  }
  if (filters.artists.length > 0) params.set('artists', filters.artists.join('|'))
  const query = params.toString()
  return query ? `&${query}` : ''
}
