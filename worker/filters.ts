import {
  COUNTRY_CODES,
  COUNTRY_LABELS,
  REGION_LABELS,
  REGION_OPTIONS,
  countriesFromQuery,
  isCatalogKind,
  type CatalogKind,
  type CountryCode,
  type RegionFilter,
} from '../shared/catalog-meta'
import type { Track } from './types'

export const ERA_OPTIONS = ['modern', '2010s', '2000s', 'classics'] as const
export const GENRE_OPTIONS = ['pop', 'hip-hop', 'r&b', 'rock', 'dance', 'other'] as const
export { COUNTRY_CODES, COUNTRY_LABELS, REGION_LABELS, REGION_OPTIONS }
export type { CountryCode, RegionFilter }

export type EraFilter = (typeof ERA_OPTIONS)[number]
export type GenreFilter = (typeof GENRE_OPTIONS)[number]

export interface CatalogFilters {
  eras: EraFilter[]
  genres: GenreFilter[]
  countries: CountryCode[]
  collections: CatalogKind[]
}

export const EMPTY_CATALOG_FILTERS: CatalogFilters = {
  eras: [],
  genres: [],
  countries: [],
  collections: [],
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

export function parseEraFilters(value: string | undefined): EraFilter[] {
  if (!value?.trim()) return []
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item): item is EraFilter => ERA_OPTIONS.includes(item as EraFilter))
}

export function parseGenreFilters(value: string | undefined): GenreFilter[] {
  if (!value?.trim()) return []
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item): item is GenreFilter => GENRE_OPTIONS.includes(item as GenreFilter))
}

export function parseCountryFilters(
  countries?: string,
  regions?: string,
): CountryCode[] {
  return countriesFromQuery(countries, regions)
}

export function parseCollectionFilters(
  collections?: string,
  catalogs?: string,
): CatalogKind[] {
  const seen = new Set<CatalogKind>()
  for (const raw of [collections, catalogs]) {
    if (!raw?.trim()) continue
    for (const item of raw.split(',')) {
      const id = item.trim().toLowerCase()
      if (isCatalogKind(id)) seen.add(id)
    }
  }
  return [...seen]
}

export function toggleFilterValue<T extends string>(current: T[], value: T, allValues: readonly T[]): T[] {
  if (current.includes(value)) {
    return current.filter((item) => item !== value)
  }
  return [...current, value].sort(
    (left, right) => allValues.indexOf(left) - allValues.indexOf(right),
  )
}

export function getTrackEra(track: Track): EraFilter | null {
  if (!Number.isInteger(track.releaseYear)) return null

  const year = track.releaseYear!
  if (year >= 2020) return 'modern'
  if (year >= 2010) return '2010s'
  if (year >= 2000) return '2000s'
  return 'classics'
}

function matchesEra(track: Track, era: EraFilter): boolean {
  return getTrackEra(track) === era
}

export function getGenreGroups(track: Track): Set<GenreFilter> {
  if (track.genreGroups?.length) {
    return new Set(track.genreGroups)
  }

  const haystack = `${track.artist} ${track.title}`.toLowerCase()
  const groups = new Set<GenreFilter>()

  if (/hip.?hop|rap|trap|skusta|flow g|hellmerry|ck\d|brando/i.test(haystack)) {
    groups.add('hip-hop')
  }
  if (/r&b|soul|moira|regine|gary valenciano|martin nievera|jona|morissette/i.test(haystack)) {
    groups.add('r&b')
  }
  if (/rock|eraserheads|rivermaya|parokya|itchyworms|silent sanctuary|chicosci|hale|up dharma/i.test(haystack)) {
    groups.add('rock')
  }
  if (/dance|electro|house|edm|remix|dj/i.test(haystack)) {
    groups.add('dance')
  }
  if (/sb19|bini|p-pop|ben&ben|cup of joe|zack tabudlo|arthur nery|juan karlos|lola amour|hev abi/i.test(haystack)) {
    groups.add('pop')
  }

  if (groups.size === 0) {
    groups.add('other')
  }

  return groups
}

function matchesGenre(track: Track, genre: GenreFilter): boolean {
  return getGenreGroups(track).has(genre)
}

export function getTrackCountry(track: Track): CountryCode {
  return track.country ?? 'PH'
}

function matchesCountry(track: Track, country: CountryCode): boolean {
  return getTrackCountry(track) === country
}

function matchesCollection(track: Track, collection: CatalogKind): boolean {
  if (track.catalog === collection) return true
  return track.collections?.includes(collection) === true
}

export function trackMatchesFilters(track: Track, filters: CatalogFilters): boolean {
  const eras = filters.eras
  const genres = filters.genres
  const countries = filters.countries
  const collections = filters.collections

  const eraMatch = eras.length === 0 || eras.some((era) => matchesEra(track, era))
  const genreMatch = genres.length === 0 || genres.some((genre) => matchesGenre(track, genre))
  const countryMatch =
    countries.length === 0 || countries.some((country) => matchesCountry(track, country))
  const collectionMatch =
    collections.length === 0 ||
    collections.some((collection) => matchesCollection(track, collection))

  return eraMatch && genreMatch && countryMatch && collectionMatch
}

export function filterTracks(tracks: Track[], filters: CatalogFilters): Track[] {
  return tracks.filter((track) => trackMatchesFilters(track, filters))
}
