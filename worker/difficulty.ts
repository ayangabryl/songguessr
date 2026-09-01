import type { Difficulty } from './types'

/**
 * Difficulty is derived from official Spotify Web API fields only:
 *   - track.popularity (0–100) — primary
 *   - artist.popularity (0–100) — secondary
 *   - album release year — recency nudge (newer hits are slightly easier)
 *
 * There is NO official play-count / "listens" on the public Web API.
 * Do not scrape unofficial listen endpoints. Recompute on each ID-based sync.
 */
const CURRENT_YEAR = new Date().getUTCFullYear()

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function recencyBonus(releaseYear: number | null | undefined): number {
  if (!releaseYear || !Number.isInteger(releaseYear)) return 0
  const age = CURRENT_YEAR - releaseYear
  if (age <= 2) return 6
  if (age <= 5) return 3
  if (age <= 10) return 1
  return 0
}

/** Blended 0–100 guessability. Higher = more well-known = easier. */
export function guessabilityScore(
  trackPopularity: number,
  artistPopularity: number,
  releaseYear?: number | null,
): number {
  const raw =
    0.72 * clamp(trackPopularity, 0, 100) +
    0.2 * clamp(artistPopularity, 0, 100) +
    recencyBonus(releaseYear)
  return clamp(Math.round(raw), 0, 100)
}

export function assignDifficultyFromMetrics(input: {
  popularity: number
  artistPopularity?: number
  releaseYear?: number | null
}): Difficulty {
  const track = clamp(input.popularity, 0, 100)
  const artist = clamp(input.artistPopularity ?? 0, 0, 100)
  const score = guessabilityScore(track, artist, input.releaseYear)

  // Easy = actually well-known (high track pop, or solid track + famous artist).
  if (track >= 72 || (track >= 60 && artist >= 70)) return 'easy'
  if (score >= 72) return 'easy'
  if (score >= 55) return 'medium'
  if (score >= 40) return 'hard'
  if (score >= 25) return 'expert'
  return 'impossible'
}

export function parseReleaseYear(releaseDate?: string | null): number | undefined {
  if (!releaseDate) return undefined
  const year = Number.parseInt(String(releaseDate).slice(0, 4), 10)
  return Number.isInteger(year) ? year : undefined
}
