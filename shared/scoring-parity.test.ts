import assert from 'node:assert/strict'
import { test } from 'node:test'
import { roundPoints as soloPoints } from '../src/lib/score.ts'
import { advancePlayer, alignMatchScoring, expireRound, matchRank, MATCH_STAGES, nextEntries, publicMatch, type MatchDifficulty, type MatchState } from './match.ts'

function make(difficulty: MatchDifficulty = 'easy'): MatchState {
  return {
    id: 'm', roundId: 'r', number: 1, phase: 'playing', difficulty,
    scoringVersion: 3, startsAt: 0, deadline: 90000, used: ['secret'],
    song: {id: 'secret', title: 'Secret song', artist: 'Artist', albumArt: '', audio: 'audio', offset: 0},
    entries: nextEntries([], [{id: 'a', name: 'Alice'}, {id: 'b', name: 'Bob'}], false, false),
  }
}

test('each stop earns exactly solo points across every difficulty and submission time', () => {
  for (const difficulty of ['easy', 'medium', 'hard', 'expert', 'impossible'] as const) {
    for (const [stage, solvedStage] of MATCH_STAGES.entries()) {
      for (const now of [1000, 89999]) {
        let match = make(difficulty)
        for (let i = 0; i < stage; i++) {
          match = advancePlayer(match, 'a', 'r', i, false, i % 2 === 0, 1000)
        }
        match = advancePlayer(match, 'a', 'r', stage, true, false, now)
        const expected = soloPoints({status: 'won', solvedStage, stages: MATCH_STAGES})
        assert.equal(match.entries[0].delta, expected)
        assert.equal(match.entries[0].points, 5 - stage)
        assert.equal(publicMatch(match).answer, null)
        assert.equal(advancePlayer(match, 'a', 'r', stage, true, false, now), match)
      }
    }
  }
})

test('passes, exhausted guesses and timeouts earn zero without subtracting previous wins', () => {
  for (const skip of [true, false]) {
    let match = make()
    match.entries[0].points = 9
    for (let i = 0; i < MATCH_STAGES.length; i++) match = advancePlayer(match, 'a', 'r', i, false, skip, 1000)
    const done = expireRound(match, 90000)
    assert.equal(done.entries[0].points, 9)
    assert.equal(done.entries[0].delta, soloPoints({status: 'lost', solvedStage: null, stages: MATCH_STAGES}))
    assert.equal(done.entries[1].delta, 0)
    assert.deepEqual(done.entries[0].history, [0])
  }
})

test('old matches convert totals, round deltas and archived history exactly once', () => {
  for (const version of [undefined, 2] as const) {
    const factor = version === 2 ? 1000 : 200
    const old = make()
    old.scoringVersion = version
    old.entries[0] = {...old.entries[0], points: 9 * factor, delta: 4 * factor, history: [5 * factor, 4 * factor], status: 'solved', stage: 1}
    old.entries[1].points = 8 * factor
    old.completedRounds = [{roundId: 'previous', number: 0, answer: {id: 'old', title: 'Revealed', artist: 'Artist'}, results: [{id: 'a', stage: 0, status: 'solved', lastAction: 'solved', delta: 5 * factor}]}]
    const before = structuredClone(old)
    const converted = alignMatchScoring(old)
    assert.deepEqual(old, before, 'migration must not mutate its input')
    assert.equal(converted.scoringVersion, 3)
    assert.equal(converted.entries[0].points, 9)
    assert.equal(converted.entries[0].delta, 4)
    assert.deepEqual(converted.entries[0].history, [5, 4])
    assert.equal(converted.completedRounds![0].results[0].delta, 5)
    assert.deepEqual(matchRank(converted.entries, 'a'), matchRank(old.entries, 'a'))
    assert.equal(alignMatchScoring(converted), converted)
    assert.deepEqual(alignMatchScoring(JSON.parse(JSON.stringify(converted))), converted)
    const finished = advancePlayer(converted, 'b', 'r', 0, true, false, 1000)
    assert.equal(finished.entries[1].points, 13)
    assert.equal(finished.entries[1].delta, 5)
    assert.equal(finished.phase, 'reveal')
    assert.equal(finished.completedRounds!.at(-1)!.results[1].delta, 5)
    assert.equal(nextEntries(finished.entries, finished.entries, false, true)[1].points, 13)
    assert.equal(nextEntries(finished.entries, finished.entries, false, false)[1].points, 0)
    assert.deepEqual(nextEntries(finished.entries, finished.entries, true, false)[1].history, [5])
  }
})
