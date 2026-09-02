/** ISO-like catalog origin. All current songs are PH / OPM. */
export const COUNTRY_CODES = ['PH', 'KR', 'JP', 'US', 'GLOBAL'] as const
export type CountryCode = (typeof COUNTRY_CODES)[number]

export const CATALOG_KINDS = ['opm', 'kpop', 'anime', 'other'] as const
export type CatalogKind = (typeof CATALOG_KINDS)[number]

/** Game-facing regions. Add KR, JP, … here when those catalogs exist. */
export const REGION_OPTIONS = ['PH'] as const
export type RegionFilter = (typeof REGION_OPTIONS)[number]

export const COUNTRY_LABELS: Record<CountryCode, string> = {
  PH: 'Philippines',
  KR: 'Korea',
  JP: 'Japan',
  US: 'United States',
  GLOBAL: 'Global',
}

export const CATALOG_LABELS: Record<CatalogKind, string> = {
  opm: 'OPM',
  kpop: 'K-pop',
  anime: 'Anime',
  other: 'Other',
}

export const REGION_LABELS: Record<RegionFilter | 'all', string> = {
  all: 'All regions',
  PH: 'Philippines',
}

export interface CatalogRegion {
  id: RegionFilter
  label: string
  country: CountryCode
}

export const GAME_REGIONS: CatalogRegion[] = REGION_OPTIONS.map((id) => ({
  id,
  label: REGION_LABELS[id],
  country: id,
}))

export const DEFAULT_COUNTRY: CountryCode = 'PH'
export const DEFAULT_CATALOG: CatalogKind = 'opm'

export function isCountryCode(value: string): value is CountryCode {
  return (COUNTRY_CODES as readonly string[]).includes(value)
}

export function isCatalogKind(value: string): value is CatalogKind {
  return (CATALOG_KINDS as readonly string[]).includes(value)
}

export function isRegionFilter(value: string): value is RegionFilter {
  return (REGION_OPTIONS as readonly string[]).includes(value)
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

/** Regions query values are country codes (PH, KR, …). */
export function countriesFromQuery(
  countries?: string,
  regions?: string,
): CountryCode[] {
  const merged = [...parseCountryList(countries), ...parseCountryList(regions)]
  return [...new Set(merged)]
}
