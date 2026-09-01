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

const VARIANT_PATTERN =
  /\b(remix|reimagined|re-recorded|live|acoustic|karaoke|instrumental|sped up|slowed|edit|mix|version|radio|demo|cover|extended|stripped)\b/i

/** Collapse "Lifetime (Reimagined)" → "lifetime" for duplicate detection. */
export function canonicalSongTitle(title: string): string {
  let value = title.trim()

  value = value.replace(/\s*\([^)]*\)/g, ' ')
  value = value.replace(/\s*\[[^\]]*\]/g, ' ')
  value = value.replace(/\s*-\s*(remix|reimagined|live|acoustic|karaoke|instrumental|edit|mix|version).*$/i, ' ')

  return normalizeText(value)
}

export function primaryArtistName(artist: string): string {
  return normalizeText(artist.split(',')[0] ?? artist)
}

export function songIdentityKey(track: Pick<Track, 'title' | 'artist'>): string {
  return `${primaryArtistName(track.artist)}|${canonicalSongTitle(track.title)}`
}

function variantPenalty(title: string): number {
  let penalty = 0
  if (/\([^)]*\)/.test(title) || /\[[^\]]*\]/.test(title)) penalty += 12
  if (VARIANT_PATTERN.test(title)) penalty += 24
  if (/\s-\s/.test(title)) penalty += 6
  return penalty
}

function canonicalTrackScore(track: Track): number {
  let score = 100
  score -= variantPenalty(track.title)
  score -= Math.min(20, track.title.length * 0.2)

  const difficultyBonus: Record<Track['difficulty'], number> = {
    easy: 8,
    medium: 6,
    hard: 4,
    expert: 2,
    impossible: 0,
  }
  score += difficultyBonus[track.difficulty] ?? 0

  return score
}

/** Keep one best version per song title + primary artist. */
export function dedupeTracks(tracks: Track[]): Track[] {
  const bestBySong = new Map<string, Track>()

  for (const track of tracks) {
    const key = songIdentityKey(track)
    const current = bestBySong.get(key)
    if (!current || canonicalTrackScore(track) > canonicalTrackScore(current)) {
      bestBySong.set(key, track)
    }
  }

  return [...bestBySong.values()]
}
