import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  formatRoundDelta,
  formatRoundPoints,
  formatScoreValue,
  maxRoundPoints,
  roundPoints,
  roundScoreWhy,
  scoreScaleHint,
  sittingPoints,
  sittingTallyLabel,
} from './score.ts'
import { nextStreak } from './streak.ts'

/** Same values as DEFAULT_STAGES; keep this file free of game-state I/O. */
const defaults = [0.1, 0.5, 2, 8, 15]

test('naming at the first default stop is worth 5', () => {
  assert.equal(
    roundPoints({ status: 'won', solvedStage: 0.1, stages: defaults }),
    5,
  )
})

test('naming at later default stops counts down to 1', () => {
  assert.equal(roundPoints({ status: 'won', solvedStage: 0.5, stages: defaults }), 4)
  assert.equal(roundPoints({ status: 'won', solvedStage: 2, stages: defaults }), 3)
  assert.equal(roundPoints({ status: 'won', solvedStage: 8, stages: defaults }), 2)
  assert.equal(roundPoints({ status: 'won', solvedStage: 15, stages: defaults }), 1)
})

test('a lost song is worth 0', () => {
  assert.equal(roundPoints({ status: 'lost', solvedStage: null, stages: defaults }), 0)
  assert.equal(roundPoints({ status: 'lost', solvedStage: 0.1, stages: defaults }), 0)
})

test('the same stop is worth the same on any song pool', () => {
  const atFirst = { status: 'won' as const, solvedStage: 0.1, stages: defaults }
  assert.equal(roundPoints(atFirst), 5)
  assert.equal(roundPoints(atFirst), roundPoints(atFirst))
})

test('a shorter ruler has a smaller maximum', () => {
  assert.equal(
    roundPoints({ status: 'won', solvedStage: 0.1, stages: [0.1, 2, 15] }),
    3,
  )
})

test('an unknown stop scores 0', () => {
  assert.equal(roundPoints({ status: 'won', solvedStage: 4, stages: defaults }), 0)
  assert.equal(roundPoints({ status: 'won', solvedStage: null, stages: defaults }), 0)
})

test('unsorted stages still score from earliest to latest', () => {
  assert.equal(
    roundPoints({ status: 'won', solvedStage: 0.1, stages: [15, 0.1, 2] }),
    3,
  )
})

test('sitting points add every round, including zeros', () => {
  assert.equal(sittingPoints([5, 0, 4]), 9)
  assert.equal(sittingPoints([]), 0)
})

test('points do not read the streak', () => {
  const points = roundPoints({ status: 'won', solvedStage: 0.1, stages: defaults })
  assert.equal(points, 5)
  assert.equal(nextStreak(12, 'win'), 13)
  assert.equal(nextStreak(12, 'miss'), 12)
  assert.equal(
    roundPoints({ status: 'won', solvedStage: 0.1, stages: defaults }),
    5,
  )
})

test('won points render with a leading plus; zero is rest', () => {
  assert.equal(formatRoundPoints(5), '+5')
  assert.equal(formatRoundPoints(0), '')
})

test('the result beat writes a digit for a miss and a plus for a name', () => {
  assert.equal(formatRoundDelta(5), '+5')
  assert.equal(formatRoundDelta(0), '0')
  assert.equal(formatScoreValue(0), '0')
  assert.equal(formatScoreValue(4), '4')
})

test('a named song says the stop; a miss says no points', () => {
  assert.equal(
    roundScoreWhy({ status: 'won', solvedStage: 0.1, stages: defaults }),
    'Named at 0.1 seconds',
  )
  assert.equal(
    roundScoreWhy({ status: 'lost', solvedStage: null, stages: defaults }),
    'No points this song',
  )
})

test('the first result of a sitting can name the scale', () => {
  assert.equal(maxRoundPoints(defaults), 5)
  assert.equal(scoreScaleHint(defaults), 'Earliest stop is 5 points. Each later stop is one less.')
})

test('the bar tally is a sitting, not a table', () => {
  assert.equal(sittingTallyLabel(0), '0 points this sitting')
  assert.equal(sittingTallyLabel(1), '1 point this sitting')
  assert.equal(sittingTallyLabel(5), '5 points this sitting')
})
