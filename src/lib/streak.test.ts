import assert from 'node:assert/strict'
import { test } from 'node:test'
import { nextStreak } from './streak.ts'

test('a named song adds one to the streak', () => {
  assert.equal(nextStreak(0, 'win'), 1)
  assert.equal(nextStreak(4, 'win'), 5)
})

test('losing the round clears the streak', () => {
  assert.equal(nextStreak(5, 'lose'), 0)
  assert.equal(nextStreak(0, 'lose'), 0)
})

test('a miss or skip mid-round does not change the streak', () => {
  assert.equal(nextStreak(3, 'miss'), 3)
  assert.equal(nextStreak(3, 'skip'), 3)
})
