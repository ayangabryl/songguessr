import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createSongSearchCache, getSongSearchCache } from './song-search-cache.ts'
const song = (id: string, title: string, artist = 'Taylor Swift') => ({ id, title, artist, albumArt: '' })
const page = { results: [song('1', 'Love Story'), song('2', 'Love')], total: 70, nextOffset: 40 }

test('repeated and normalized searches reuse complete pages without losing pagination', () => {
  const cache = createSongSearchCache()
  cache.put(' LOVE! ', 0, page)
  cache.put('love', 40, { results: [song('3', 'Lover')], total: 70, nextOffset: null })
  assert.equal(cache.get('love'), page)
  assert.equal(cache.get('LOVE', 40)?.results[0].id, '3')
  assert.equal(cache.get('lov'), null)
})
test('local suggestions match the current query and remain separate from complete results', () => {
  const cache = createSongSearchCache()
  cache.put('love', 0, page)
  assert.deepEqual(cache.preview('story').results.map(s => s.id), ['1'])
  assert.equal(cache.preview('taylor').results.length, 2)
  assert.deepEqual(cache.preview('love').results.map(s => s.id), ['2', '1'])
  assert.equal(cache.preview('unrelated').results.length, 0)
  assert.equal(cache.get('story'), null)
})
test('expired pages and suggestions cannot conceal catalog changes', () => {
  let time = 0
  const cache = createSongSearchCache(() => time)
  cache.put('love', 0, page)
  time = 60001
  assert.equal(cache.get('love'), null)
  assert.equal(cache.preview('love').results.length, 0)
})
test('cache stays bounded and evicts least recently used pages', () => {
  const cache = createSongSearchCache()
  for (let i = 0; i < 80; i++) cache.put(String(i), 0, page)
  cache.get('0')
  cache.put('80', 0, page)
  assert.equal(cache.get('1'), null)
  assert.equal(cache.get('0'), page)
  for (let i = 0; i < 500; i++) cache.put(String(i), 0, {results:[song(String(i), i === 0 ? 'Forgotten original' : `Song ${i}`)], total:1, nextOffset:null})
  assert.equal(cache.preview('Forgotten original').results.length, 0)
})

test('playlist searches cannot reuse another playlist or global suggestions',()=>{
  const global=getSongSearchCache(),first=getSongSearchCache('a'.repeat(64)),second=getSongSearchCache('b'.repeat(64))
  global.put('love',0,page)
  assert.equal(first.get('love'),null)
  first.put('love',0,{results:[song('new','Love newly imported')],total:1,nextOffset:null})
  assert.equal(first.preview('love').results[0].id,'new')
  assert.equal(second.preview('love').results.length,0)
  assert.equal(global.get('love'),page)
})
