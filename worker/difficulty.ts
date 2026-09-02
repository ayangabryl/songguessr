import { normalizeName } from './opm-artists'
import type { Difficulty } from './types'

/** Household OPM names used when Spotify popularity is unavailable. */
const WELL_KNOWN_OPM_ARTISTS = [
  'SB19',
  'BINI',
  'Ben&Ben',
  'Cup of Joe',
  'Arthur Nery',
  'IV of Spades',
  'IV OF SPADES',
  'December Avenue',
  'Up Dharma Down',
  'Hev Abi',
  'Skusta Clee',
  'Flow G',
  'Shanti Dope',
  'Unique Salonga',
  'Adie',
  'Dilaw',
  'Sugarfree',
  'Hellmerry',
  'HELLMERRY',
  'Yuridope',
  'Moira Dela Torre',
  'Zack Tabudlo',
  'Sarah Geronimo',
  'Eraserheads',
  'Parokya ni Edgar',
  'Rivermaya',
].map((name) => normalizeName(name))

export function isWellKnownArtistName(name: string | undefined): boolean {
  if (!name) return false
  const parts = name.split(',').map((part) => normalizeName(part))
  return parts.some((part) =>
    WELL_KNOWN_OPM_ARTISTS.some(
      (known) => part === known || part.includes(known) || known.includes(part),
    ),
  )
}

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

/** Top-chart imports never go harder than medium. */
export function assignChartDifficulty(input: {
  popularity: number
  artistPopularity?: number
  artistName?: string
}): Difficulty {
  const track = clamp(input.popularity, 0, 100)
  const artist = clamp(input.artistPopularity ?? 0, 0, 100)
  if (track >= 60 || artist >= 60 || isWellKnownArtistName(input.artistName)) return 'easy'
  return 'medium'
}

export function clampChartDifficulty(difficulty: Difficulty): Difficulty {
  switch (difficulty) {
    case 'easy':
      return 'easy'
    case 'medium':
    case 'hard':
    case 'expert':
    case 'impossible':
      return 'medium'
    default: {
      const _never: never = difficulty
      return _never
    }
  }
}

export function parseReleaseYear(releaseDate?: string | null): number | undefined {
  if (!releaseDate) return undefined
  const year = Number.parseInt(String(releaseDate).slice(0, 4), 10)
  return Number.isInteger(year) ? year : undefined
}
