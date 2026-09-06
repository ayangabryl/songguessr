import { test } from 'node:test'
import assert from 'node:assert/strict'
import { closeArtistWord } from './search-match.ts'
test('artist spelling fallback accepts small mistakes and rejects unrelated words', () => {
  assert.equal(closeArtistWord('oliva', 'olivia'), true)
  assert.equal(closeArtistWord('iliva', 'olivia'), true)
  assert.equal(closeArtistWord('olivia', 'olivia'), true)
  assert.equal(closeArtistWord('oli', 'olivia'), false)
  assert.equal(closeArtistWord('olivia', 'taylor'), false)
})
