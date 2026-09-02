/** JS mirror of worker/track-dedupe.ts for catalogue builds and D1 maintenance. */

function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9&\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeQualifier(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const QUALIFIER_PATTERNS = [
  /^(?:from\s+)?(?:the\s+)?first\s+take$/,
  /^live$/,
  /^live\s+(?:version|edit|take|recording|performance|acoustic|session|sessions)$/,
  /^live\s+(?:at|from|in|on|@)\s+.+$/,
  /^.+\s+live(?:\s+(?:version|recording|performance|session|sessions))?$/,
  /^(?:.+\s)?(?:session|sessions|concert|showcase)$/,
  /^(?:.+\s)?tour(?:\s+.+)?$/,
  /^unplugged(?:\s+.+)?$/,
  /^(?:.+\s)?unplugged$/,

  /^(?:\d{4}\s+)?(?:digital(?:ly)?\s+)?remaster(?:ed)?(?:\s+version)?(?:\s+\d{4})?$/,
  /^remaster(?:ed)?\s+.+$/,
  /^.+\s+remaster(?:ed)?$/,

  /^acoustic(?:\s+.+)?$/,
  /^(?:.+\s)?acoustic(?:\s+(?:version|mix))?$/,
  /^(?:.+\s)?stripped(?:\s+(?:version|down|back))?$/,
  /^(?:.+\s)?(?:demo|instrumental|karaoke|cover|reprise|interlude|outro|intro)(?:\s+version)?$/,
  /^(?:.+\s)?a\s?cappella$/,
  /^(?:.+\s)?(?:piano|guitar|orchestral|string|band|studio|home)\s+(?:version|mix|arrangement)$/,

  /^(?:.+\s)?edit$/,
  /^(?:.+\s)?(?:mix|remix|rmx|bootleg|flip|mashup|dub)$/,
  /^(?:.+\s)?remix(?:es)?$/,
  /^(?:.+\s)?version$/,
  /^extended(?:\s+.+)?$/,
  /^(?:sped\s?up|slowed|nightcore)(?:\s+.+)?$/,
  /^(?:.+\s)?(?:sped\s?up|slowed(?:\s+down)?|nightcore|reverb)$/,
  /^(?:.+\s)?(?:mono|stereo)(?:\s+(?:version|mix))?$/,

  /^deluxe(?:\s+.+)?$/,
  /^(?:.+\s)?deluxe(?:\s+(?:edition|version))?$/,
  /^bonus(?:\s+track)?(?:\s+.+)?$/,
  /^(?:.+\s)?bonus\s+track$/,
  /^reissue(?:\s+.+)?$/,
  /^(?:.+\s)?(?:edition|reissue|remake|reimagined|revisited|rerecorded|re\s?recorded)$/,
  /^(?:.+\s)?(?:explicit|clean)(?:\s+version)?$/,

  /^(?:feat|ft|featuring|with|w)\s+.+$/,
  /^(?:.+\s)?(?:duet|duo|collab|collaboration)\s+(?:with|w|feat|ft)\s+.+$/,
  /^(?:prod|produced)(?:\s+by)?\s+.+$/,

  /^ost$/,
  /^(?:.+\s)?ost$/,
  /^from\s+.+$/,
  /^music\s+from\s+.+$/,
  /^(?:.+\s)?(?:original\s+)?(?:motion\s+picture\s+)?soundtrack(?:\s+.+)?$/,
  /^(?:.+\s)?theme(?:\s+song)?$/,
  /^(?:.+\s)?(?:opening|ending)(?:\s+theme)?$/,

  /^official(?:\s+.+)?$/,
  /^(?:.+\s)?(?:music\s+)?video$/,
  /^(?:.+\s)?(?:lyric|lyrics)(?:\s+video)?$/,
  /^(?:.+\s)?(?:audio|visualizer|visualiser|mv|hd|hq)$/,
]

function isVariantQualifier(suffix) {
  const normalized = normalizeQualifier(suffix)
  if (!normalized) return false
  return QUALIFIER_PATTERNS.some((pattern) => pattern.test(normalized))
}

function splitTrailingBracket(value) {
  const match = /^(.*)[([{]([^()[\]{}]*)[)\]}]\s*$/.exec(value)
  if (!match) return null
  return { base: (match[1] ?? '').trim(), suffix: (match[2] ?? '').trim() }
}

function splitTrailingDash(value) {
  const match = /^(.*\S)\s+[-\u2013\u2014]\s+(\S.*)$/.exec(value)
  if (!match) return null
  return { base: (match[1] ?? '').trim(), suffix: (match[2] ?? '').trim() }
}

function stripTrailingFeature(value) {
  const stripped = value.replace(/\s+(?:feat|ft|featuring)\.?\s+.+$/i, '').trim()
  return stripped.length > 0 ? stripped : value
}

const MAX_QUALIFIER_LAYERS = 6

export function canonicalSongTitle(title) {
  const original = String(title ?? '').trim()
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

  return normalizeText(original) || canonical
}

export function isPlainTitle(title) {
  return canonicalSongTitle(title) === normalizeText(title)
}

export function primaryArtistName(artist) {
  return normalizeText(String(artist ?? '').split(',')[0] ?? '')
}

export function songIdentityKey(track) {
  return `${primaryArtistName(track.artist)}|${canonicalSongTitle(track.title)}`
}

export function isSameSong(left, right) {
  return songIdentityKey(left) === songIdentityKey(right)
}

const VARIANT_UPSET_RATIO = 1.25

function playsOf(candidate) {
  const plays = candidate.playCount
  return typeof plays === 'number' && Number.isFinite(plays) && plays > 0 ? plays : null
}

function richnessScore(candidate) {
  let score = 0
  if (candidate.albumArt) score += 2
  if (candidate.previewUrl) score += 1
  return score
}

export function compareVariants(left, right) {
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
  return String(left.id ?? '').localeCompare(String(right.id ?? ''))
}

function toCandidate(track) {
  return {
    id: track.id,
    title: track.title,
    playCount: track.playCount ?? null,
    popularity: track.popularity ?? null,
    albumArt: track.albumArt,
    previewUrl: track.previewUrl,
  }
}

export function dedupeTracks(tracks) {
  const bestBySong = new Map()

  for (const track of tracks) {
    const key = songIdentityKey(track)
    const current = bestBySong.get(key)
    if (!current || compareVariants(toCandidate(track), toCandidate(current)) < 0) {
      bestBySong.set(key, track)
    }
  }

  return [...bestBySong.values()]
}
