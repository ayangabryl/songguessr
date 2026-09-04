import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  mergeSingerRows,
  rankByArtistPopularity,
  uniqueArtistsByFame,
} from './catalog-artists.ts'

test('idle Mix names the five most famous artists, not whoever is on a popular track', () => {
  const ranked = rankByArtistPopularity([
    { name: 'Temper City', popularity: 38 },
    { name: 'Shakira', popularity: 89 },
    { name: 'Malcolm Todd', popularity: 54 },
    { name: 'Dominic Fike', popularity: 72 },
    { name: 'Burna Boy', popularity: 84 },
    { name: 'The Beatles', popularity: 86 },
  ])
  assert.deepEqual(
    ranked.map((hit) => hit.name),
    ['Shakira', 'The Beatles', 'Burna Boy', 'Dominic Fike', 'Malcolm Todd'],
  )
})

test('a featured name on someone else’s track does not take a Mix slot', () => {
  const ranked = uniqueArtistsByFame([
    { artist: 'Malcolm Todd, Temper City', artistPopularity: 54 },
    { artist: 'Shakira', artistPopularity: 89 },
    { artist: 'Dominic Fike', artistPopularity: 72 },
  ])
  assert.deepEqual(
    ranked.map((hit) => hit.name),
    ['Shakira', 'Dominic Fike', 'Malcolm Todd'],
  )
})

test('a selected singer keeps their portrait when they leave the famous five', () => {
  const known = new Map([
    [
      'shakira',
      {
        name: 'Shakira',
        imageUrl: 'https://i.scdn.co/image/ab6761610000e5eb111111111111111111111111',
      },
    ],
  ])
  const rows = mergeSingerRows(
    [{ name: 'The Beatles', imageUrl: 'https://i.scdn.co/image/ab6761610000e5eb222222222222222222222222' }],
    ['Shakira'],
    known,
  )
  assert.equal(rows[0]?.name, 'Shakira')
  assert.match(rows[0]?.imageUrl ?? '', /ab676161/)
})
