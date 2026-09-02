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
 * Difficulty is derived from Spotify metadata only:
 *   - track.popularity (0–100) — primary, when the Web API quota allows it
 *   - play count from the public web player — log-scaled, and the primary signal
 *     whenever popularity is missing
 *   - artist.popularity (0–100) — secondary
 *   - album release year — recency nudge (newer hits are slightly easier)
 *
 * Play counts are real numbers read from Spotify's own pathfinder response.
 * Never estimate one. Recompute on each ID-based sync.
 */
const CURRENT_YEAR = new Date().getUTCFullYear()

/** Plays that map to the bottom and top of the log scale. */
const PLAY_COUNT_FLOOR_LOG = 4
const PLAY_COUNT_SPAN_LOG = 4.5

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * Maps raw plays onto the same 0–100 range as popularity so the two can blend.
 * 10K plays scores 0, 1M scores ~44, 100M scores ~89.
 */
export function playCountScore(playCount: number | null | undefined): number | undefined {
  if (playCount == null || !Number.isFinite(playCount) || playCount <= 0) return undefined
  const magnitude = Math.log10(playCount)
  return clamp(Math.round(((magnitude - PLAY_COUNT_FLOOR_LOG) / PLAY_COUNT_SPAN_LOG) * 100), 0, 100)
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
  playCount?: number | null,
): number {
  const track = clamp(trackPopularity, 0, 100)
  const artist = clamp(artistPopularity, 0, 100)
  const plays = playCountScore(playCount)
  const recency = recencyBonus(releaseYear)

  if (plays == null) {
    return clamp(Math.round(0.72 * track + 0.2 * artist + recency), 0, 100)
  }

  // Popularity is often unavailable (quota), so plays carry the full track
  // weight in that case instead of leaving the score artificially low.
  const trackSignal = track > 0 ? 0.52 * track + 0.3 * plays : 0.82 * plays
  return clamp(Math.round(trackSignal + 0.2 * artist + recency), 0, 100)
}

export function assignDifficultyFromMetrics(input: {
  popularity: number
  artistPopularity?: number
  releaseYear?: number | null
  playCount?: number | null
}): Difficulty {
  const track = clamp(input.popularity, 0, 100)
  const artist = clamp(input.artistPopularity ?? 0, 0, 100)
  const plays = playCountScore(input.playCount)
  const score = guessabilityScore(track, artist, input.releaseYear, input.playCount)

  // Easy = actually well-known (high track pop, or solid track + famous artist).
  if (track >= 72 || (track >= 60 && artist >= 70)) return 'easy'
  // ~56M plays and up is a household song even with no popularity number.
  if (plays != null && plays >= 80) return 'easy'
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
