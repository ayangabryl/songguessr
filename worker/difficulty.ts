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
 * Stored `tracks.difficulty` is a global ingest heuristic for admin. The live
 * game ignores that column and buckets against the active filter pool instead
 * (see `poolTierFromRank`): easy is the top slice of *this* collection/country,
 * so 1M plays can be a smash in a niche catalog and a deep cut in OPM.
 *
 * Ingest still blends:
 *   - track.popularity (0–100) — skipped when missing, never treated as 0
 *   - play count from the public web player
 *   - artist.popularity (0–100)
 *   - album release year — recency nudge
 */
const CURRENT_YEAR = new Date().getUTCFullYear()

/** Plays that map to the bottom and top of the log scale. */
const PLAY_COUNT_FLOOR_LOG = 4
const PLAY_COUNT_SPAN_LOG = 4.5

/**
 * Play-count floors per tier, calibrated against the Top 50 Philippines playlist
 * (`scripts/spotify-playcounts.mjs --playlist`). That playlist spans 1.04M to
 * 3.67B plays and every track in it must land easy or medium, so the medium
 * floor sits at 500K to keep a margin under the least-played chart entry.
 */
const PLAY_COUNT_TIERS: ReadonlyArray<{ plays: number; difficulty: Difficulty }> = [
  { plays: 100_000_000, difficulty: 'easy' },
  { plays: 500_000, difficulty: 'medium' },
  { plays: 100_000, difficulty: 'hard' },
  { plays: 10_000, difficulty: 'expert' },
]

/** Tier implied by plays alone, or undefined when there is no play count. */
export function difficultyFromPlayCount(
  playCount: number | null | undefined,
): Difficulty | undefined {
  if (playCount == null || !Number.isFinite(playCount) || playCount <= 0) return undefined
  for (const tier of PLAY_COUNT_TIERS) {
    if (playCount >= tier.plays) return tier.difficulty
  }
  return 'impossible'
}

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

/**
 * Plays per year since release. A song with 5M plays in its first year is a
 * current hit; the same 5M spread over fifteen years is a deep cut, and the
 * lifetime total alone cannot tell them apart.
 */
export function playVelocity(
  playCount: number | null | undefined,
  releaseYear: number | null | undefined,
): number | undefined {
  if (playCount == null || !Number.isFinite(playCount) || playCount <= 0) return undefined
  if (!releaseYear || !Number.isInteger(releaseYear)) return undefined
  const years = Math.max(1, CURRENT_YEAR - releaseYear + 1)
  return playCount / years
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

export const TIER_ORDER: readonly Difficulty[] = [
  'easy',
  'medium',
  'hard',
  'expert',
  'impossible',
]

/** How many distinct game tiers a pool of this size can fill. */
export function poolTierCount(poolN: number): 1 | 2 | 3 | 4 | 5 {
  if (poolN <= 2) return 1
  if (poolN <= 6) return 2
  if (poolN <= 14) return 3
  if (poolN <= 24) return 4
  return 5
}

const TIERS_FOR_WIDTH: Record<1 | 2 | 3 | 4 | 5, readonly Difficulty[]> = {
  1: ['easy'],
  2: ['easy', 'medium'],
  3: ['easy', 'medium', 'hard'],
  4: ['easy', 'medium', 'hard', 'expert'],
  5: TIER_ORDER,
}

/** Map a requested difficulty onto the hardest tier the pool can actually fill. */
export function mapRequestedPoolTier(requested: Difficulty, poolN: number): Difficulty {
  const available = TIERS_FOR_WIDTH[poolTierCount(poolN)]
  if (available.includes(requested)) return requested
  return available[available.length - 1] ?? 'easy'
}

/**
 * `famePct` is 0 = least known in this pool, 1 = most known.
 * Easy is the top ~20% once the catalog is large enough to support five tiers.
 */
export function poolTierFromRank(famePct: number, poolN: number): Difficulty {
  const width = poolTierCount(poolN)
  switch (width) {
    case 1:
      return 'easy'
    case 2:
      return famePct >= 0.45 ? 'easy' : 'medium'
    case 3:
      if (famePct >= 0.7) return 'easy'
      if (famePct >= 0.35) return 'medium'
      return 'hard'
    case 4:
      if (famePct >= 0.8) return 'easy'
      if (famePct >= 0.52) return 'medium'
      if (famePct >= 0.24) return 'hard'
      return 'expert'
    case 5:
      if (famePct >= 0.78) return 'easy'
      if (famePct >= 0.54) return 'medium'
      if (famePct >= 0.32) return 'hard'
      if (famePct >= 0.14) return 'expert'
      return 'impossible'
    default: {
      const _never: never = width
      return _never
    }
  }
}

/** SQL CASE matching `poolTierFromRank`, over columns `fame_pct` and `pool_n`. */
export function poolTierCaseSql(
  famePctColumn = 'fame_pct',
  poolNColumn = 'pool_n',
): string {
  return `CASE
    WHEN ${poolNColumn} <= 2 THEN 'easy'
    WHEN ${poolNColumn} <= 6 THEN CASE WHEN ${famePctColumn} >= 0.45 THEN 'easy' ELSE 'medium' END
    WHEN ${poolNColumn} <= 14 THEN CASE
      WHEN ${famePctColumn} >= 0.70 THEN 'easy'
      WHEN ${famePctColumn} >= 0.35 THEN 'medium'
      ELSE 'hard'
    END
    WHEN ${poolNColumn} <= 24 THEN CASE
      WHEN ${famePctColumn} >= 0.80 THEN 'easy'
      WHEN ${famePctColumn} >= 0.52 THEN 'medium'
      WHEN ${famePctColumn} >= 0.24 THEN 'hard'
      ELSE 'expert'
    END
    ELSE CASE
      WHEN ${famePctColumn} >= 0.78 THEN 'easy'
      WHEN ${famePctColumn} >= 0.54 THEN 'medium'
      WHEN ${famePctColumn} >= 0.32 THEN 'hard'
      WHEN ${famePctColumn} >= 0.14 THEN 'expert'
      ELSE 'impossible'
    END
  END`
}

function shiftTier(difficulty: Difficulty, steps: number): Difficulty {
  const index = TIER_ORDER.indexOf(difficulty)
  return TIER_ORDER[clamp(index - steps, 0, TIER_ORDER.length - 1)] ?? difficulty
}

/**
 * Blends every public signal we can read for a track.
 *
 * Lifetime plays set the base tier because they measure how many people have
 * ever heard the song. Popularity (Spotify's own 0-100 heat score), play
 * velocity, and artist popularity then nudge it by at most a tier or two, so a
 * currently-charting song is not buried just because it is new, and a dormant
 * back-catalogue track with a big lifetime total is not called easy.
 *
 * Every input is optional. A signal that Spotify would not give us is skipped
 * rather than treated as zero, since zero is a real popularity value.
 */
export function assignDifficultyFromMetrics(input: {
  popularity?: number | null
  artistPopularity?: number | null
  releaseYear?: number | null
  playCount?: number | null
}): Difficulty {
  const track = input.popularity == null ? undefined : clamp(input.popularity, 0, 100)
  const artist = input.artistPopularity == null ? undefined : clamp(input.artistPopularity, 0, 100)

  // Easy = unmistakably well-known right now.
  if (track != null && (track >= 72 || (track >= 60 && (artist ?? 0) >= 70))) return 'easy'

  const base = difficultyFromPlayCount(input.playCount)
  if (base) {
    let steps = 0

    if (track != null) {
      if (track >= 70) steps += 2
      else if (track >= 55) steps += 1
      else if (track <= 15) steps -= 1
    }

    if ((artist ?? 0) >= 75) steps += 1

    const velocity = playVelocity(input.playCount, input.releaseYear)
    if (velocity != null) {
      if (velocity >= 20_000_000) steps += 1
      else if (velocity < 25_000) steps -= 1
    }

    // Keep the play count authoritative: nudges can move a track two tiers
    // easier at most, and never more than one tier harder.
    return shiftTier(base, clamp(steps, -1, 2))
  }

  // No play count: fall back to the popularity-weighted blend.
  const score = guessabilityScore(track ?? 0, artist ?? 0, input.releaseYear, input.playCount)
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
