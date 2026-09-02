import type { Track } from './types'

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9&\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Suffix text with punctuation flattened, so `From "THE FIRST TAKE"` matches. */
function normalizeQualifier(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Version/edition qualifiers, matched against a whole trailing suffix only.
 *
 * Every pattern is anchored on both ends: a qualifier is only recognised when it
 * accounts for the entire ` - suffix` or ` (suffix)` chunk. That is what keeps
 * "Alive" from reading as "live" and a song genuinely called "Live" intact,
 * since neither ever appears as a detachable suffix of a longer base title.
 */
const QUALIFIER_PATTERNS: RegExp[] = [
  // Session series and live performances.
  /^(?:from\s+)?(?:the\s+)?first\s+take$/,
  /^live$/,
  /^live\s+(?:version|edit|take|recording|performance|acoustic|session|sessions)$/,
  /^live\s+(?:at|from|in|on|@)\s+.+$/,
  /^.+\s+live(?:\s+(?:version|recording|performance|session|sessions))?$/,
  /^(?:.+\s)?(?:session|sessions|concert|showcase)$/,
  /^(?:.+\s)?tour(?:\s+.+)?$/,
  /^unplugged(?:\s+.+)?$/,
  /^(?:.+\s)?unplugged$/,

  // Remasters.
  /^(?:\d{4}\s+)?(?:digital(?:ly)?\s+)?remaster(?:ed)?(?:\s+version)?(?:\s+\d{4})?$/,
  /^remaster(?:ed)?\s+.+$/,
  /^.+\s+remaster(?:ed)?$/,

  // Alternate performances.
  /^acoustic(?:\s+.+)?$/,
  /^(?:.+\s)?acoustic(?:\s+(?:version|mix))?$/,
  /^(?:.+\s)?stripped(?:\s+(?:version|down|back))?$/,
  /^(?:.+\s)?(?:demo|instrumental|karaoke|cover|reprise|interlude|outro|intro)(?:\s+version)?$/,
  /^(?:.+\s)?a\s?cappella$/,
  /^(?:.+\s)?(?:piano|guitar|orchestral|string|band|studio|home)\s+(?:version|mix|arrangement)$/,

  // Edits, mixes, remixes.
  /^(?:.+\s)?edit$/,
  /^(?:.+\s)?(?:mix|remix|rmx|bootleg|flip|mashup|dub)$/,
  /^(?:.+\s)?remix(?:es)?$/,
  /^(?:.+\s)?version$/,
  /^extended(?:\s+.+)?$/,
  /^(?:sped\s?up|slowed|nightcore)(?:\s+.+)?$/,
  /^(?:.+\s)?(?:sped\s?up|slowed(?:\s+down)?|nightcore|reverb)$/,
  /^(?:.+\s)?(?:mono|stereo)(?:\s+(?:version|mix))?$/,

  // Release packaging.
  /^deluxe(?:\s+.+)?$/,
  /^(?:.+\s)?deluxe(?:\s+(?:edition|version))?$/,
  /^bonus(?:\s+track)?(?:\s+.+)?$/,
  /^(?:.+\s)?bonus\s+track$/,
  /^reissue(?:\s+.+)?$/,
  /^(?:.+\s)?(?:edition|reissue|remake|reimagined|revisited|rerecorded|re\s?recorded)$/,
  /^(?:.+\s)?(?:explicit|clean)(?:\s+version)?$/,

  // Credits.
  /^(?:feat|ft|featuring|with|w)\s+.+$/,
  /^(?:.+\s)?(?:duet|duo|collab|collaboration)\s+(?:with|w|feat|ft)\s+.+$/,
  /^(?:prod|produced)(?:\s+by)?\s+.+$/,

  // Soundtracks and media attributions.
  /^ost$/,
  /^(?:.+\s)?ost$/,
  /^from\s+.+$/,
  /^music\s+from\s+.+$/,
  /^(?:.+\s)?(?:original\s+)?(?:motion\s+picture\s+)?soundtrack(?:\s+.+)?$/,
  /^(?:.+\s)?theme(?:\s+song)?$/,
  /^(?:.+\s)?(?:opening|ending)(?:\s+theme)?$/,

  // Upload/video tags that leak in from non-Spotify sources.
  /^official(?:\s+.+)?$/,
  /^(?:.+\s)?(?:music\s+)?video$/,
  /^(?:.+\s)?(?:lyric|lyrics)(?:\s+video)?$/,
  /^(?:.+\s)?(?:audio|visualizer|visualiser|mv|hd|hq)$/,
]

function isVariantQualifier(suffix: string): boolean {
  const normalized = normalizeQualifier(suffix)
  if (!normalized) return false
  return QUALIFIER_PATTERNS.some((pattern) => pattern.test(normalized))
}

/** `Title (Suffix)` / `Title [Suffix]` split on the closing bracket at the end. */
function splitTrailingBracket(value: string): { base: string; suffix: string } | null {
  const match = /^(.*)[([{]([^()[\]{}]*)[)\]}]\s*$/.exec(value)
  if (!match) return null
  return { base: (match[1] ?? '').trim(), suffix: (match[2] ?? '').trim() }
}

/** `Title - Suffix` split on the last spaced dash, so "Spider-Man" is untouched. */
function splitTrailingDash(value: string): { base: string; suffix: string } | null {
  const match = /^(.*\S)\s+[-\u2013\u2014]\s+(\S.*)$/.exec(value)
  if (!match) return null
  return { base: (match[1] ?? '').trim(), suffix: (match[2] ?? '').trim() }
}

/** `Title feat. X` with no bracket or dash to hang the credit off. */
function stripTrailingFeature(value: string): string {
  const stripped = value.replace(/\s+(?:feat|ft|featuring)\.?\s+.+$/i, '').trim()
  return stripped.length > 0 ? stripped : value
}

const MAX_QUALIFIER_LAYERS = 6

/**
 * Collapse version qualifiers so every recording of a song shares one title.
 *
 * "MAPA - From THE FIRST TAKE", "MAPA (Acoustic)" and "MAPA" all reduce to
 * "mapa". Stripping only ever removes a trailing bracket or spaced-dash chunk
 * that matches a qualifier outright, and the original title is restored if
 * peeling leaves nothing usable behind.
 */
export function canonicalSongTitle(title: string): string {
  const original = title.trim()
  let value = original

  for (let layer = 0; layer < MAX_QUALIFIER_LAYERS; layer += 1) {
    const bracket = splitTrailingBracket(value)
    if (bracket && bracket.base && isVariantQualifier(bracket.suffix)) {
      value = bracket.base
      continue
    }

    const dash = splitTrailingDash(value)
    if (dash && dash.base && isVariantQualifier(dash.suffix)) {
      value = dash.base
      continue
    }

    break
  }

  value = stripTrailingFeature(value)

  const canonical = normalizeText(value)
  if (canonical.length > 1) return canonical

  // Titles that are entirely a qualifier ("Live", "Remix") keep their own name.
  return normalizeText(original) || canonical
}

/** True when a title carries no version qualifier, i.e. it is the plain release. */
export function isPlainTitle(title: string): boolean {
  return canonicalSongTitle(title) === normalizeText(title)
}

export function primaryArtistName(artist: string): string {
  return normalizeText(artist.split(',')[0] ?? artist)
}

export function songIdentityKey(track: Pick<Track, 'title' | 'artist'>): string {
  return `${primaryArtistName(track.artist)}|${canonicalSongTitle(track.title)}`
}

export function isSameSong(
  left: Pick<Track, 'title' | 'artist'>,
  right: Pick<Track, 'title' | 'artist'>,
): boolean {
  return songIdentityKey(left) === songIdentityKey(right)
}

export interface VariantCandidate {
  id?: string
  title: string
  playCount?: number | null
  popularity?: number | null
  albumArt?: string | null
  previewUrl?: string | null
}

/**
 * How much better a variant's plays must be to beat the plain release.
 *
 * Live and session cuts occasionally edge past the studio track on a single
 * metric; the margin keeps the recognisable version as the catalogue entry
 * unless the variant is decisively the one people actually play.
 */
const VARIANT_UPSET_RATIO = 1.25

function playsOf(candidate: VariantCandidate): number | null {
  const plays = candidate.playCount
  return typeof plays === 'number' && Number.isFinite(plays) && plays > 0 ? plays : null
}

function richnessScore(candidate: VariantCandidate): number {
  let score = 0
  if (candidate.albumArt) score += 2
  if (candidate.previewUrl) score += 1
  return score
}

/**
 * Order two recordings of the same song best-first.
 *
 * Play count leads, popularity breaks ties, and the plainer title wins when
 * neither metric separates them.
 */
export function compareVariants(left: VariantCandidate, right: VariantCandidate): number {
  const leftPlain = isPlainTitle(left.title)
  const rightPlain = isPlainTitle(right.title)
  const leftPlays = playsOf(left)
  const rightPlays = playsOf(right)

  if (leftPlays !== null && rightPlays !== null) {
    if (leftPlain !== rightPlain) {
      const plainPlays = leftPlain ? leftPlays : rightPlays
      const variantPlays = leftPlain ? rightPlays : leftPlays
      const variantWins = variantPlays >= plainPlays * VARIANT_UPSET_RATIO
      if (variantWins) return leftPlain ? 1 : -1
      return leftPlain ? -1 : 1
    }
    if (leftPlays !== rightPlays) return rightPlays - leftPlays
  } else if (leftPlays !== null || rightPlays !== null) {
    if (leftPlain !== rightPlain) return leftPlain ? -1 : 1
    return leftPlays !== null ? -1 : 1
  } else if (leftPlain !== rightPlain) {
    return leftPlain ? -1 : 1
  }

  const leftPopularity = left.popularity ?? -1
  const rightPopularity = right.popularity ?? -1
  if (leftPopularity !== rightPopularity) return rightPopularity - leftPopularity

  const richness = richnessScore(right) - richnessScore(left)
  if (richness !== 0) return richness

  if (left.title.length !== right.title.length) return left.title.length - right.title.length
  return (left.id ?? '').localeCompare(right.id ?? '')
}

function toCandidate(track: Track): VariantCandidate {
  return {
    id: track.id,
    title: track.title,
    playCount: track.playCount ?? null,
    popularity: track.popularity ?? null,
    albumArt: track.albumArt,
    previewUrl: track.previewUrl,
  }
}

/** Keep one best recording per song title + primary artist. */
export function dedupeTracks(tracks: Track[]): Track[] {
  const bestBySong = new Map<string, Track>()

  for (const track of tracks) {
    const key = songIdentityKey(track)
    const current = bestBySong.get(key)
    if (!current || compareVariants(toCandidate(track), toCandidate(current)) < 0) {
      bestBySong.set(key, track)
    }
  }

  return [...bestBySong.values()]
}
