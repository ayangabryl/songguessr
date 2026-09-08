import { foldSearchText } from '../shared/search-text.ts'
import { canonicalSongTitle, primaryArtistName, isSameSong } from './track-dedupe.ts'

export const normalizeGuess = foldSearchText

function levenshtein(a: string, b: string): number {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const next = [i]
    for (let j = 1; j <= b.length; j++) next[j] = Math.min(next[j - 1] + 1, row[j] + 1, row[j - 1] + Number(a[i - 1] !== b[j - 1]))
    row = next
  }
  return row[b.length]
}

function withoutTrailingArtist(guess: string, artist: string): string {
  const match = /^(.*\S)\s+[-\u2013\u2014]\s+(\S.*)$/.exec(guess.trim())
  if (!match) return guess
  const tail = foldSearchText(match[2])
  return tail && (tail === foldSearchText(artist) || tail === primaryArtistName(artist)) ? match[1].trim() : guess
}

/** A complete song title is required. Search fragments and artist names are not answers. */
export function checkMatchGuess(guess: string, title: string, artist: string): boolean {
  const candidate = withoutTrailingArtist(guess, artist)
  const target = canonicalSongTitle(title)
  const forms = [canonicalSongTitle(candidate)]
  // A familiar session label is often typed without its catalogue punctuation.
  forms.push(canonicalSongTitle(candidate.replace(/\s+(?:from\s+)?(?:the\s+)?first\s+take$/i, '')))
  if (!target) return false
  return forms.some(input => input && (input === target || target.length >= 8 && input.length >= 8 && levenshtein(input, target) <= 1))
}

export function checkGuess(guess: string, title: string, artist: string): { correct: boolean; matched: 'title' | 'artist' | 'both' | null } {
  const correct = checkMatchGuess(guess, title, artist)
  return { correct, matched: correct ? 'title' : null }
}

type Song = { id: string; title: string; artist: string }
/** A selected catalogue ID is authoritative: never rescue a rejected selection with its label. */
export function checkSubmittedSong(target: Song, guess: string, selectedId?: string, selected?: Song): boolean {
  if (selectedId) return selectedId === target.id || Boolean(selected && selected.id === selectedId && isSameSong(selected, target))
  return checkMatchGuess(guess, target.title, target.artist)
}
