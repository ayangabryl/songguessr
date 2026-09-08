import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkGuess, checkSubmittedSong } from './guess.ts'
import { canonicalSongTitle, songIdentityKey, isSameSong } from './track-dedupe.ts'

test('selected wrong IDs cannot fall back to a correct-looking or partial label', () => {
  const target = { id: 'love-story', title: 'Love Story', artist: 'Taylor Swift' }
  const wrong = { id: 'love-song', title: 'Love Song', artist: 'Taylor Swift' }
  assert.equal(checkSubmittedSong(target, 'Love Story', wrong.id, wrong), false)
  assert.equal(checkSubmittedSong(target, 'Love', wrong.id, wrong), false)
  assert.equal(checkSubmittedSong(target, 'Love Story', 'missing-id'), false)
  assert.equal(checkSubmittedSong(target, 'Anything', target.id), true)
  assert.equal(checkSubmittedSong(target, 'Love Story'), true)
})

test('international titles and artists retain distinct song identities', () => {
  const a = { id: 'a', title: '夜に駆ける', artist: 'YOASOBI' }
  const b = { id: 'b', title: '群青', artist: 'YOASOBI' }
  assert.notEqual(songIdentityKey(a), songIdentityKey(b))
  assert.equal(checkSubmittedSong(a, b.title, b.id, b), false)
  assert.notEqual(songIdentityKey({title:'봄날',artist:'방탄소년단'}), songIdentityKey({title:'불타오르네',artist:'방탄소년단'}))
  assert.notEqual(canonicalSongTitle('か'), canonicalSongTitle('が'))
  assert.equal(isSameSong({title:'!!!',artist:'???'}, {title:'???',artist:'!!!'}), false)
})

test('legitimate recording variants remain valid but meaningful subtitles stay distinct', () => {
  const target = { id: 'studio', title: 'MAPA', artist: 'SB19' }
  const live = { id: 'live', title: 'MAPA - From THE FIRST TAKE', artist: 'SB19' }
  assert.equal(checkSubmittedSong(target, live.title, live.id, live), true)
  assert.equal(isSameSong({title:'Hello (Goodbye)',artist:'A'}, {title:'Hello (Again)',artist:'A'}), false)
  assert.equal(checkGuess('Hello', 'Hello (Goodbye)', 'A').correct, false)
})

test('typed answers require the whole title, not substrings or artist-only guesses', () => {
  for (const guess of ['love', 'story', 'Taylor Swift', 'the']) assert.equal(checkGuess(guess, 'Love Story', 'Taylor Swift').correct, false)
  assert.equal(checkGuess('Love Stori', 'Love Story', 'Taylor Swift').correct, true)
  assert.equal(checkGuess("cant hold us", "Can't Hold Us", 'Macklemore').correct, true)
})
