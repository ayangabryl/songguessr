import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  advancePlayer,
  expireRound,
  publicMatch,
  parseMatchCommand,
  type MatchState,
} from './match.ts'
const make = (): MatchState => ({
  id: 'match',
  roundId: 'round',
  number: 1,
  phase: 'playing',
  difficulty: 'easy',
  startsAt: 1000,
  deadline: 91000,
  used: ['secret'],
  song: {
    id: 'secret',
    title: 'Answer',
    artist: 'Artist',
    albumArt: 'cover',
    audio: 'audio',
    offset: 0,
  },
  entries: ['alice', 'bob'].map((id) => ({
    id,
    name: id,
    stage: 0,
    status: 'playing',
    lastAction: 'ready',
    points: 0,
    delta: 0,
    history: [],
  })),
})
test('same song, independent stages, no premature reveal', () => {
  let m = make()
  m = advancePlayer(m, 'alice', 'round', 0, false, true, 2000)
  assert.equal(m.entries[0].stage, 1)
  assert.equal(m.entries[1].stage, 0)
  m = advancePlayer(m, 'bob', 'round', 0, true, false, 2000)
  assert.equal(m.entries[1].points, 1000)
  assert.equal(publicMatch(m).answer, null)
  assert(!JSON.stringify(publicMatch(m)).includes('secret'))
  m = advancePlayer(m, 'alice', 'round', 1, true, false, 3000)
  assert.equal(m.phase, 'reveal')
  assert.equal(m.entries[0].points, 800)
  assert.equal(publicMatch(m).answer?.title, 'Answer')
})
test('stale stages, round IDs and duplicate guesses cannot award or skip twice', () => {
  const m = make()
  assert.equal(advancePlayer(m, 'alice', 'old', 0, true, false, 2000), m)
  assert.equal(advancePlayer(m, 'alice', 'round', 1, true, false, 2000), m)
  const solved = advancePlayer(m, 'alice', 'round', 0, true, false, 2000)
  assert.equal(
    advancePlayer(solved, 'alice', 'round', 0, true, false, 2001),
    solved,
  )
  const skipped = advancePlayer(m, 'alice', 'round', 0, false, true, 2000)
  assert.equal(
    advancePlayer(skipped, 'alice', 'round', 0, false, true, 2001),
    skipped,
  )
})
test('deadline resolves disconnected players once, keeps earned points', () => {
  const solved = advancePlayer(make(), 'alice', 'round', 0, true, false, 2000)
  const expired = expireRound(solved, 91000)
  assert.equal(expired.phase, 'reveal')
  assert.equal(expired.entries[0].points, 1000)
  assert.equal(expired.entries[1].status, 'out')
  assert.deepEqual(expired.entries[1].history, [0])
  assert.equal(expireRound(expired, 92000), expired)
})
test('countdown blocks commands and final song finishes the match', () => {
  const m = make()
  assert.equal(advancePlayer(m, 'alice', 'round', 0, true, false, 500), m)
  m.number = 10
  assert.equal(expireRound(m, 91000).phase, 'finished')
})
test('pass at the final stop ends only that player’s turn', () => {
  let m = make()
  for (let stage = 0; stage < 5; stage++)
    m = advancePlayer(m, 'alice', 'round', stage, false, true, 2000)
  assert.equal(m.entries[0].status, 'out')
  assert.equal(m.phase, 'playing')
  assert.equal(m.entries[1].stage, 0)
})
test('wire parser rejects forged points and malformed commands', () => {
  for (const command of [
    { type: 'score', delta: 1000 },
    { type: 'match-start', difficulty: 'fake' },
    { type: 'match-guess', roundId: 'round', stage: -1, guess: 'answer' },
    { type: 'match-guess', roundId: 'round', stage: 0, guess: '' },
    { type: 'match-skip', roundId: 'round', stage: 99 },
  ])
    assert.equal(parseMatchCommand(JSON.stringify(command)), null)
  assert.equal(parseMatchCommand('{'), null)
  assert.deepEqual(
    parseMatchCommand(
      JSON.stringify({ type: 'match-skip', roundId: 'round', stage: 1 }),
    ),
    { type: 'match-skip', roundId: 'round', stage: 1 },
  )
})

test('auto difficulty covers all five levels twice in a ten-song match', async () => {
  const { roundDifficulty } = await import('./match.ts')
  const levels = Array.from({ length: 10 }, (_, i) =>
    roundDifficulty('mixed', i + 1),
  )
  for (const level of ['easy', 'medium', 'hard', 'expert', 'impossible'])
    assert.equal(levels.filter((x) => x === level).length, 2)
  assert.equal(roundDifficulty('hard', 8), 'hard')
})
test('custom length and every-player readiness are authoritative', async () => {
  const { finishRound, readyForNext, everyoneReady } = await import(
    './match.ts'
  )
  let m = finishRound({
    ...make(),
    length: 5,
    number: 5,
    entries: make().entries.map((p) => ({ ...p, status: 'out' })),
  })
  assert.equal(m.phase, 'finished')
  m = readyForNext(m, 'alice', m.roundId)
  assert.equal(everyoneReady(m, ['alice', 'bob']), false)
  assert.equal(everyoneReady(m, ['alice']), true)
  assert.equal(everyoneReady(m, []), false)
  assert.equal(
    everyoneReady(readyForNext(m, 'bob', 'stale'), ['alice', 'bob']),
    false,
  )
  assert.equal(
    everyoneReady(readyForNext(m, 'bob', m.roundId), ['alice', 'bob']),
    true,
  )
  assert.equal(
    parseMatchCommand(
      JSON.stringify({ type: 'match-start', difficulty: 'mixed', length: 100 }),
    ),
    null,
  )
})
test('rematches explicitly reset or carry points, but always clear readiness and round history', async () => {
  const { nextEntries } = await import('./match.ts')
  const before = make().entries.map((p) => ({
    ...p,
    points: 1800,
    ready: true,
    history: [1000, 800],
  }))
  assert.equal(nextEntries(before, before, false, false)[0].points, 0)
  const carried = nextEntries(before, before, false, true)[0]
  assert.equal(carried.points, 1800)
  assert.equal(carried.ready, false)
  assert.deepEqual(carried.history, [])
  assert.deepEqual(
    nextEntries(before, before, true, false)[0].history,
    [1000, 800],
  )
})
test('correct guesses publish an achievement time without revealing the answer',()=>{
 const m=advancePlayer(make(),'alice','round',0,true,false,2000)
 assert.equal(m.entries[0].solvedAt,2000)
 assert.equal(publicMatch(m).answer,null)
 assert.equal(advancePlayer(m,'alice','round',0,true,false,3000).entries[0].solvedAt,2000)
})
test('host filters are allowlisted and preserved in start commands', () => {
 const start = parseMatchCommand(JSON.stringify({type:'match-start',difficulty:'mixed',filters:{era:'2010s',genre:'pop',country:'PH'}}))
 assert.equal(start?.type, 'match-start')
 if (start?.type === 'match-start') assert.deepEqual(start.filters,{era:'2010s',genre:'pop',country:'PH'})
 assert.equal(parseMatchCommand(JSON.stringify({type:'match-start',difficulty:'easy',filters:{genre:'injected'}})),null)
 assert.equal(parseMatchCommand(JSON.stringify({type:'match-start',difficulty:'easy',filters:[]})),null)
})
