import { canonicalSongTitle, primaryArtistName } from './track-dedupe.ts'

const STOP_WORDS = new Set([
  'the',
  'a',
  'an',
  'ft',
  'feat',
  'featuring',
  'and',
  'ng',
  'sa',
  'ang',
  'ni',
  'at',
])

function stripParentheticals(value: string): string {
  return value.replace(/\([^)]*\)/g, ' ').replace(/\[[^\]]*\]/g, ' ')
}

export function normalizeGuess(value: string): string {
  return stripParentheticals(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenize(value: string): string[] {
  return normalizeGuess(value)
    .split(' ')
    .filter((token) => token.length > 0 && !STOP_WORDS.has(token))
}

function levenshtein(a: string, b: string): number {
  const matrix = Array.from({ length: a.length + 1 }, () =>
    Array<number>(b.length + 1).fill(0),
  )

  for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i
  for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      )
    }
  }

  return matrix[a.length][b.length]
}

function fuzzyIncludes(guess: string, target: string): boolean {
  if (!guess || !target) return false
  if (target.includes(guess) || guess.includes(target)) return true
  if (guess.length < 4) return false
  return levenshtein(guess, target) <= Math.max(1, Math.floor(target.length * 0.2))
}

/**
 * Drop a trailing " - Artist" so a suggestion label canonicalizes as a title.
 *
 * The autocomplete fills the box with `${title} - ${artist}`, which would
 * otherwise look like a version qualifier chunk to the canonicalizer.
 */
function withoutTrailingArtist(guess: string, artist: string): string | null {
  const match = /^(.*\S)\s+[-\u2013\u2014]\s+(\S.*)$/.exec(guess.trim())
  if (!match) return null
  const tail = normalizeGuess(match[2] ?? '')
  if (!tail) return null
  if (tail !== normalizeGuess(artist) && tail !== normalizeGuess(primaryArtistName(artist))) {
    return null
  }
  return (match[1] ?? '').trim()
}

/** Every canonical title a player could reasonably have typed for this song. */
function canonicalGuessForms(guess: string, artist: string): string[] {
  const forms = new Set<string>()
  const withoutArtist = withoutTrailingArtist(guess, artist)
  for (const candidate of [guess, withoutArtist]) {
    if (!candidate) continue
    const canonical = normalizeGuess(canonicalSongTitle(candidate))
    if (canonical) forms.add(canonical)
  }
  return [...forms]
}

export function checkGuess(
  guess: string,
  title: string,
  artist: string,
): { correct: boolean; matched: 'title' | 'artist' | 'both' | null } {
  const normalizedGuess = normalizeGuess(guess)
  if (!normalizedGuess) return { correct: false, matched: null }

  const titleNorm = normalizeGuess(title)
  const artistNorm = normalizeGuess(artist)
  const combined = `${titleNorm} ${artistNorm}`.trim()

  if (
    normalizedGuess === titleNorm ||
    normalizedGuess === artistNorm ||
    normalizedGuess === combined
  ) {
    return {
      correct: true,
      matched: normalizedGuess === combined ? 'both' : normalizedGuess === titleNorm ? 'title' : 'artist',
    }
  }

  // Any recording of the right song counts. "MAPA" and "MAPA - From THE FIRST
  // TAKE" collapse to the same canonical title, so naming either one scores.
  const canonicalTitle = normalizeGuess(canonicalSongTitle(title))
  const canonicalForms = canonicalGuessForms(guess, artist)
  if (canonicalTitle && canonicalForms.includes(canonicalTitle)) {
    return { correct: true, matched: 'title' }
  }
  const canonicalCombined = `${canonicalTitle} ${artistNorm}`.trim()
  if (canonicalCombined && canonicalForms.includes(canonicalCombined)) {
    return { correct: true, matched: 'both' }
  }

  const guessTokens = tokenize(normalizedGuess)
  const titleTokens = tokenize(titleNorm)
  const canonicalTitleTokens = tokenize(canonicalTitle)
  const artistTokens = tokenize(artistNorm)

  const matchesTitleTokens = (tokens: string[], targets: string[]) =>
    tokens.length > 0 && tokens.every((token) => targets.some((target) => fuzzyIncludes(token, target)))

  const titleMatch =
    fuzzyIncludes(normalizedGuess, titleNorm) ||
    matchesTitleTokens(guessTokens, titleTokens) ||
    canonicalForms.some(
      (form) =>
        fuzzyIncludes(form, canonicalTitle) ||
        matchesTitleTokens(tokenize(form), canonicalTitleTokens),
    )

  const artistMatch =
    fuzzyIncludes(normalizedGuess, artistNorm) ||
    matchesTitleTokens(guessTokens, artistTokens)

  if (titleMatch && artistMatch) return { correct: true, matched: 'both' }
  if (titleMatch) return { correct: true, matched: 'title' }
  if (artistMatch) return { correct: true, matched: 'artist' }

  return { correct: false, matched: null }
}
