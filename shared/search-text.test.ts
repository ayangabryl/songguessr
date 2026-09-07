import { test } from 'node:test'
import assert from 'node:assert/strict'
import { foldSearchText, rankSearchHits, searchHitScore, searchTerms } from './search-text.ts'

test('foldSearchText treats can\'t, cant, and curly apostrophes as the same', () => {
  assert.equal(foldSearchText("Can't Hold Us"), 'cant hold us')
  assert.equal(foldSearchText('cant hold us'), 'cant hold us')
  assert.equal(foldSearchText('Can’t Hold Us'), 'cant hold us')
  assert.equal(foldSearchText("dont you"), 'dont you')
  assert.equal(foldSearchText("don't you"), 'dont you')
})

test('searchTerms split a folded query', () => {
  assert.deepEqual(searchTerms("Can't Hold"), ['cant', 'hold'])
})

test('searchHitScore ranks an exact folded title first', () => {
  assert.ok(searchHitScore('cant', "Can't Hold Us", 'Macklemore') > searchHitScore('cant', 'Love Story', 'Taylor Swift'))
  assert.equal(searchHitScore("can't hold us", "Can't Hold Us", 'Macklemore'), 100)
})

test('rankSearchHits keeps punctuation-insensitive matches and drops misses', () => {
  const ranked = rankSearchHits(
    'cant',
    [
      { title: 'Love Story', artist: 'Taylor Swift' },
      { title: "Can't Hold Us", artist: 'Macklemore' },
      { title: 'Cancun', artist: 'Trueno' },
    ],
    (item) => item.title,
    (item) => item.artist,
  )
  assert.equal(ranked[0]?.title, "Can't Hold Us")
  assert.ok(ranked.every((item) => foldSearchText(item.title).includes('cant') || foldSearchText(item.artist).includes('cant')))
})
