export const MATCH_ERAS = ['modern', '2010s', '2000s', 'classics'] as const
export const MATCH_GENRES = ['pop', 'hip-hop', 'r&b', 'rock', 'dance', 'other'] as const
export const MATCH_COUNTRIES = ['PH', 'US', 'GB', 'KR', 'JP'] as const
export interface MatchFilters {
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
  return { ...(f.era ? {era: f.era as MatchFilters['era']} : {}), ...(f.genre ? {genre: f.genre as MatchFilters['genre']} : {}), ...(f.country ? {country: f.country as MatchFilters['country']} : {}) }
}
