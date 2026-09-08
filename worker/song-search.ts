import { foldSearchText } from '../shared/search-text.ts'
import { artistWordDistance } from './search-match.ts'
import { dedupeTracks } from './track-dedupe.ts'
import type { Track } from './types'

export function createSongIndex(tracks: Track[]) {
  return dedupeTracks(tracks)
    .sort((a, b) => a.title.localeCompare(b.title) || a.artist.localeCompare(b.artist) || a.id.localeCompare(b.id))
    .map(track => ({ track, title: foldSearchText(track.title), artist: foldSearchText(track.artist) }))
}

export function searchSongIndex(index: ReturnType<typeof createSongIndex>, query: string, offset = 0, limit = 40) {
  const q = foldSearchText(query.slice(0, 200))
  if (!q) return { tracks: [], total: 0, nextOffset: null }
  const terms = q.split(' ')
  const buckets: Track[][] = Array.from({ length: 7 }, () => [])
  for (const { track, title, artist } of index) {
    const rank = title === q ? 0 : title.startsWith(q) ? 1
      : ` ${title} `.includes(` ${q} `) ? 2 : title.includes(q) ? 3
      : artist === q || artist.startsWith(q) ? 4 : artist.includes(q) ? 5
      : terms.every(term => title.includes(term) || artist.includes(term)) ? 6 : -1
    if (rank >= 0) buckets[rank].push(track)
  }
  let matches = buckets.flat()
  // Only fall back when no literal matches exist. Do not filter these a second
  // time against the misspelling, which used to discard every suggested artist.
  if (!matches.length && terms.length === 1 && q.length >= 4) {
    const distances = new Map<string, number>()
    for (const { artist } of index) {
      if (!distances.has(artist)) distances.set(artist, Math.min(...artist.split(' ').map(word => artistWordDistance(q, word))))
    }
    const best = Math.min(...distances.values())
    if (Number.isFinite(best)) matches = index.filter(row => distances.get(row.artist) === best).map(row => row.track)
  }
  const start = Number.isFinite(offset) ? Math.max(0, Math.floor(offset)) : 0
  const size = Number.isFinite(limit) ? Math.max(1, Math.min(100, Math.floor(limit))) : 40
  const tracks = matches.slice(start, start + size)
  return { tracks, total: matches.length, nextOffset: start + size < matches.length ? start + size : null }
}
