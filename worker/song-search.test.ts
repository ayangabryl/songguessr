import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createSongIndex, searchSongIndex } from './song-search.ts'
import type { Track } from './types'

const track = (id: string, title: string, artist = 'Test Artist'): Track => ({ id, title, artist, albumArt: '', previewUrl: '', difficulty: 'easy' })

test('every matching song is reachable across pages, with no old 5/8/12/50/250 cap', () => {
  const index = createSongIndex(Array.from({ length: 603 }, (_, i) => track(String(i), `Love ${String(i).padStart(3, '0')}`)))
  const ids: string[] = []
  let offset: number | null = 0
  while (offset !== null) {
    const page = searchSongIndex(index, 'love', offset)
    assert.equal(page.total, 603)
    assert.ok(page.tracks.length <= 40)
    ids.push(...page.tracks.map(row => row.id))
    offset = page.nextOffset
  }
  assert.equal(ids.length, 603)
  assert.equal(new Set(ids).size, 603)
})

test('title, artist, combined terms, punctuation and Latin accents match consistently', () => {
  const index = createSongIndex([track('1', 'Señorita', 'Shawn Mendes & Camila Cabello'), track('2', 'Can’t Hold Us', 'Macklemore')])
  for (const q of ['senorita', 'SEÑORITA', 'camila', 'mendes señorita', 'shawn and camila']) assert.equal(searchSongIndex(index, q).tracks[0]?.id, '1')
  for (const q of ['cant hold', "can't hold", 'hold macklemore']) assert.equal(searchSongIndex(index, q).tracks[0]?.id, '2')
  assert.equal(searchSongIndex(index, 'nothing relevant').total, 0)
  assert.equal(searchSongIndex(index, '   ').total, 0)
})

test('international text keeps meaningful marks and exact titles rank first', () => {
  const index = createSongIndex([track('1', 'が'), track('2', 'か'), track('3', 'Love Story'), track('4', 'Love'), track('5', 'A Love Song')])
  assert.deepEqual(searchSongIndex(index, 'か').tracks.map(t => t.id), ['2'])
  assert.equal(searchSongIndex(index, 'love').tracks[0]?.id, '4')
})

test('artist typo fallback retains songs, but literal results take priority', () => {
  const index = createSongIndex([track('1', 'Vampire', 'Olivia Rodrigo'), track('2', 'Drivers License', 'Olivia Rodrigo')])
  assert.equal(searchSongIndex(index, 'oliva').total, 2)
  assert.equal(searchSongIndex(index, 'zxqzq').total, 0)
  const literal = createSongIndex([...index.map(row => row.track), track('3', 'Oliva')])
  assert.deepEqual(searchSongIndex(literal, 'oliva').tracks.map(t => t.id), ['3'])
})

test('deduplication precedes pagination; invalid offsets are bounded', () => {
  const index = createSongIndex([track('1', 'Song'), track('2', 'Song - Remastered')])
  assert.equal(searchSongIndex(index, 'song').total, 1)
  assert.equal(searchSongIndex(index, 'song', NaN).tracks.length, 1)
  assert.equal(searchSongIndex(index, 'song', Infinity).tracks.length, 1)
  assert.equal(searchSongIndex(index, 'song', -1).tracks.length, 1)
  assert.equal(searchSongIndex(index, 'song', 200).nextOffset, null)
})
