import {
  ISO_COUNTRIES,
  countryDisplayName,
  isIsoCountryCode,
  type IsoCountryCode,
} from './iso-countries'

/** ISO 3166-1 alpha-2, plus GLOBAL for mixed/non-territorial D1 rows. */
export type CountryCode = IsoCountryCode | 'GLOBAL'

export const COUNTRY_CODES: readonly CountryCode[] = [
  ...ISO_COUNTRIES.map((country) => country.code),
  'GLOBAL',
]

export const CATALOG_KINDS = ['opm', 'kpop', 'anime', 'other'] as const
export type CatalogKind = (typeof CATALOG_KINDS)[number]

/** Game region filters are every official ISO country. GLOBAL is not a region. */
export const REGION_OPTIONS: readonly IsoCountryCode[] = ISO_COUNTRIES.map(
  (country) => country.code,
)
export type RegionFilter = IsoCountryCode

export const COUNTRY_LABELS: Record<string, string> = Object.fromEntries([
  ...ISO_COUNTRIES.map((country) => [country.code, country.name] as const),
  ['GLOBAL', 'Global'] as const,
])

export const CATALOG_LABELS: Record<CatalogKind, string> = {
  opm: 'OPM',
  kpop: 'K-pop',
  anime: 'Anime',
  other: 'Other',
}

export const REGION_LABELS: Record<string, string> = {
  all: 'All regions',
  ...Object.fromEntries(ISO_COUNTRIES.map((country) => [country.code, country.name])),
}

export interface CatalogRegion {
  id: RegionFilter
  label: string
  country: CountryCode
}

export const GAME_REGIONS: CatalogRegion[] = ISO_COUNTRIES.map((country) => ({
  id: country.code,
  label: country.name,
  country: country.code,
}))

export const DEFAULT_COUNTRY: CountryCode = 'PH'
export const DEFAULT_CATALOG: CatalogKind = 'opm'

export function isCountryCode(value: string): value is CountryCode {
  return isIsoCountryCode(value) || value === 'GLOBAL'
}

export function isCatalogKind(value: string): value is CatalogKind {
  return (CATALOG_KINDS as readonly string[]).includes(value)
}

export function isRegionFilter(value: string): value is RegionFilter {
  return isIsoCountryCode(value)
}

export function parseCountryList(value: string | undefined): CountryCode[] {
  if (!value?.trim()) return []
  const seen = new Set<CountryCode>()
  for (const item of value.split(',')) {
    const code = item.trim().toUpperCase()
    if (isCountryCode(code)) seen.add(code)
  }
  return [...seen]
}

export function parseRegionList(value: string | undefined): RegionFilter[] {
  if (!value?.trim()) return []
  const seen = new Set<RegionFilter>()
  for (const item of value.split(',')) {
    const code = item.trim().toUpperCase()
    if (isRegionFilter(code)) seen.add(code)
  }
  return [...seen]
}

/** Regions query values are ISO country codes (PH, KR, …). */
export function countriesFromQuery(
  countries?: string,
  regions?: string,
): CountryCode[] {
  const merged = [...parseCountryList(countries), ...parseCountryList(regions)]
  return [...new Set(merged)]
}

export { countryDisplayName }
