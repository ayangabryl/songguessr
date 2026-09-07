import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkMatchGuess } from './guess.ts'
import { matchStreak, type MatchEntry } from '../shared/match.ts'
test('competitive answers reject fragments, artist-only guesses and unrelated titles', () => {
  assert.equal(checkMatchGuess('love', 'Love Story', 'Taylor Swift'), false)
  assert.equal(checkMatchGuess('Taylor Swift', 'Love Story', 'Taylor Swift'), false)
  assert.equal(checkMatchGuess('Love Song', 'Love Story', 'Taylor Swift'), false)
  assert.equal(checkMatchGuess('Love Story - Taylor Swift', 'Love Story', 'Taylor Swift'), true)
  assert.equal(checkMatchGuess('Love Stroy', 'Love Story', 'Taylor Swift'), false)
  assert.equal(checkMatchGuess('Love Stori', 'Love Story', 'Taylor Swift'), true)
  assert.equal(checkMatchGuess('Hello', 'Hello', 'Adele'), true)
  assert.equal(checkMatchGuess('Hell', 'Hello', 'Adele'), false)
  assert.equal(checkMatchGuess('夜に駆ける', '夜に駆ける', 'YOASOBI'), true)
  assert.equal(checkMatchGuess("cant hold us", "Can't Hold Us", 'Macklemore'), true)
  assert.equal(checkMatchGuess("Can't Hold Us", 'Cant Hold Us', 'Macklemore'), true)
})
test('streak counts each song once and breaks on a failed song', () => {
  const entry = { history: [0, 800, 400], status: 'solved', delta: 600 } as MatchEntry
  assert.equal(matchStreak(entry, false), 3)
  assert.equal(matchStreak({...entry, history:[0,800,400,600]}, true), 3)
  assert.equal(matchStreak({...entry, status:'out',delta:0}, false), 0)
  assert.equal(matchStreak({...entry, status:'playing',delta:0}, false), 2)
})
