import { isCountryCode, isCatalogKind } from './catalog-meta.ts'
import type { CountryCode, CatalogKind } from './catalog-meta'
export const MATCH_ERAS = ['modern', '2010s', '2000s', 'classics'] as const
export const MATCH_GENRES = ['pop', 'hip-hop', 'r&b', 'rock', 'dance', 'other'] as const
export const MATCH_COUNTRIES = ['PH', 'US', 'GB', 'KR', 'JP'] as const
export interface MatchFilters {
  eras?: (typeof MATCH_ERAS[number])[]
  genres?: (typeof MATCH_GENRES[number])[]
  countries?: CountryCode[]
  collections?: CatalogKind[]
  artists?: string[]
  excludedArtists?: string[]
  excludedGenres?: (typeof MATCH_GENRES[number])[]
  era?: typeof MATCH_ERAS[number]
  genre?: typeof MATCH_GENRES[number]
  country?: typeof MATCH_COUNTRIES[number]
}
export function parseMatchFilters(value: unknown): MatchFilters | null {
  if (value === undefined) return {}
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const f = value as Record<string, unknown>
  if (f.era !== undefined && !MATCH_ERAS.includes(f.era as never)) return null
  if (f.genre !== undefined && !MATCH_GENRES.includes(f.genre as never)) return null
  if (f.country !== undefined && !MATCH_COUNTRIES.includes(f.country as never)) return null
  const arrays: Record<string, unknown[]> = {}
  for (const key of ['eras','genres','countries','collections','artists','excludedArtists','excludedGenres']) {
    if (f[key] === undefined) continue
    if (!Array.isArray(f[key]) || (f[key] as unknown[]).length > 100) return null
    const values = f[key] as unknown[]
    if (!values.every(v => typeof v === 'string' && v.length > 0 && v.length <= 100 && (key === 'eras' ? MATCH_ERAS.includes(v as never) : key === 'genres' || key === 'excludedGenres' ? MATCH_GENRES.includes(v as never) : key === 'countries' ? isCountryCode(v) : key === 'collections' ? isCatalogKind(v) : true))) return null
    arrays[key] = [...new Set(values)]
  }
  return { ...arrays, ...(f.era ? {era: f.era as MatchFilters['era']} : {}), ...(f.genre ? {genre: f.genre as MatchFilters['genre']} : {}), ...(f.country ? {country: f.country as MatchFilters['country']} : {}) }
}
