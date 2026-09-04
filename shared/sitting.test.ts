import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  applySittingEvent,
  emptySitting,
  filterPlayers,
  isPlayerId,
  makeSittingCode,
  MAX_SCORE_DELTA,
  MAX_SITTING_PLAYERS,
  normalizeSittingCode,
  parseSittingName,
  rankDelta,
  rankPlayers,
  sittingErrorMessage,
} from './sitting.ts'

function sitting(code = 'ABCD') {
  return emptySitting(code)
}

test('makeSittingCode uses the unambiguous alphabet', () => {
  const code = makeSittingCode(new Uint8Array([0, 1, 2, 3]))
  assert.equal(code.length, 4)
  assert.match(code, /^[ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/)
})

test('normalizeSittingCode accepts spaced lowercase and rejects junk', () => {
  assert.equal(normalizeSittingCode('ab cd'), 'ABCD')
  assert.equal(normalizeSittingCode('ab-cd'), 'ABCD')
  assert.equal(normalizeSittingCode('ABC'), null)
  assert.equal(normalizeSittingCode('ABCI'), null)
  assert.equal(normalizeSittingCode(''), null)
})

test('parseSittingName trims and rejects empty, short, and long', () => {
  assert.deepEqual(parseSittingName('  Ayan  '), { ok: true, name: 'Ayan' })
  assert.deepEqual(parseSittingName('   '), { ok: false, error: 'empty-name' })
  assert.deepEqual(parseSittingName('A'), { ok: false, error: 'name-too-short' })
  assert.deepEqual(parseSittingName('a'.repeat(25)), { ok: false, error: 'name-too-long' })
})

test('first join becomes host at opening points', () => {
  const result = applySittingEvent(sitting(), {
    type: 'join',
    id: 'player-one-id',
    name: 'Ayan',
    at: 1,
    openingPoints: 7,
  })
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.state.hostId, 'player-one-id')
  assert.equal(result.state.players[0]?.points, 7)
  assert.equal(result.state.players[0]?.connected, true)
})

test('second join is on the board, not host', () => {
  let state = sitting()
  const first = applySittingEvent(state, {
    type: 'join',
    id: 'player-one-id',
    name: 'Ayan',
    at: 1,
  })
  assert.equal(first.ok, true)
  if (!first.ok) return
  const second = applySittingEvent(first.state, {
    type: 'join',
    id: 'player-two-id',
    name: 'Nica',
    at: 2,
  })
  assert.equal(second.ok, true)
  if (!second.ok) return
  assert.equal(second.state.hostId, 'player-one-id')
  assert.equal(second.state.players.length, 2)
})

test('duplicate names get a suffix', () => {
  let state = sitting()
  const first = applySittingEvent(state, {
    type: 'join',
    id: 'player-one-id',
    name: 'Ayan',
    at: 1,
  })
  assert.equal(first.ok, true)
  if (!first.ok) return
  const second = applySittingEvent(first.state, {
    type: 'join',
    id: 'player-two-id',
    name: 'Ayan',
    at: 2,
  })
  assert.equal(second.ok, true)
  if (!second.ok) return
  assert.equal(second.state.players[1]?.name, 'Ayan 2')
})

test('a ninth connected player is rejected', () => {
  let state = sitting()
  for (let i = 0; i < MAX_SITTING_PLAYERS; i += 1) {
    const result = applySittingEvent(state, {
      type: 'join',
      id: `player-${i}-xxxx`,
      name: `P${i}`,
      at: i,
    })
    assert.equal(result.ok, true)
    if (!result.ok) return
    state = result.state
  }
  const extra = applySittingEvent(state, {
    type: 'join',
    id: 'player-extra-id',
    name: 'Extra',
    at: 99,
  })
  assert.deepEqual(extra, { ok: false, error: 'room-full' })
})

test('reconnect of an existing id is allowed when the room is full', () => {
  let state = sitting()
  for (let i = 0; i < MAX_SITTING_PLAYERS; i += 1) {
    const result = applySittingEvent(state, {
      type: 'join',
      id: `player-${i}-xxxx`,
      name: `P${i}`,
      at: i,
    })
    assert.equal(result.ok, true)
    if (!result.ok) return
    state = result.state
  }
  const dropped = applySittingEvent(state, { type: 'disconnect', id: 'player-0-xxxx' })
  assert.equal(dropped.ok, true)
  if (!dropped.ok) return
  const again = applySittingEvent(dropped.state, {
    type: 'join',
    id: 'player-0-xxxx',
    name: 'P0',
    at: 100,
  })
  assert.equal(again.ok, true)
  if (!again.ok) return
  assert.equal(again.state.players.find((player) => player.id === 'player-0-xxxx')?.connected, true)
})

test('score ranks higher points first and earlier join on a tie', () => {
  let state = sitting()
  const a = applySittingEvent(state, { type: 'join', id: 'player-a-xxxx', name: 'Ann', at: 1 })
  assert.equal(a.ok, true)
  if (!a.ok) return
  const b = applySittingEvent(a.state, { type: 'join', id: 'player-b-xxxx', name: 'Bea', at: 2 })
  assert.equal(b.ok, true)
  if (!b.ok) return
  const scored = applySittingEvent(b.state, { type: 'score', id: 'player-b-xxxx', delta: 5 })
  assert.equal(scored.ok, true)
  if (!scored.ok) return
  const ranked = rankPlayers(scored.state.players)
  assert.equal(ranked[0]?.id, 'player-b-xxxx')
  assert.equal(ranked[0]?.rank, 1)
  assert.equal(ranked[1]?.rank, 2)
})

test('rankDelta is how many places you moved up', () => {
  const previous = [
    { id: 'ann', rank: 1 },
    { id: 'bea', rank: 2 },
  ]
  const next = [
    { id: 'bea', rank: 1 },
    { id: 'ann', rank: 2 },
  ]
  assert.equal(rankDelta(previous, next, 'bea'), 1)
  assert.equal(rankDelta(previous, next, 'ann'), -1)
  assert.equal(rankDelta(previous, previous, 'bea'), 0)
  assert.equal(rankDelta(previous, next, 'missing'), 0)
})

test('bad score delta is rejected and unknown players cannot score', () => {
  const joined = applySittingEvent(sitting(), {
    type: 'join',
    id: 'player-one-id',
    name: 'Ayan',
    at: 1,
  })
  assert.equal(joined.ok, true)
  if (!joined.ok) return
  assert.deepEqual(applySittingEvent(joined.state, { type: 'score', id: 'player-one-id', delta: -1 }), {
    ok: false,
    error: 'bad-delta',
  })
  assert.deepEqual(
    applySittingEvent(joined.state, { type: 'score', id: 'player-one-id', delta: MAX_SCORE_DELTA + 1 }),
    { ok: false, error: 'bad-delta' },
  )
  assert.deepEqual(applySittingEvent(joined.state, { type: 'score', id: 'missing-player', delta: 1 }), {
    ok: false,
    error: 'unknown-player',
  })
})

test('leave removes the row and passes host to the earliest remaining', () => {
  const first = applySittingEvent(sitting(), {
    type: 'join',
    id: 'player-one-id',
    name: 'Ayan',
    at: 1,
  })
  assert.equal(first.ok, true)
  if (!first.ok) return
  const second = applySittingEvent(first.state, {
    type: 'join',
    id: 'player-two-id',
    name: 'Nica',
    at: 2,
  })
  assert.equal(second.ok, true)
  if (!second.ok) return
  const left = applySittingEvent(second.state, { type: 'leave', id: 'player-one-id' })
  assert.equal(left.ok, true)
  if (!left.ok) return
  assert.equal(left.state.players.length, 1)
  assert.equal(left.state.hostId, 'player-two-id')
})

test('disconnect keeps the row and search filters names', () => {
  const first = applySittingEvent(sitting(), {
    type: 'join',
    id: 'player-one-id',
    name: 'Ayan',
    at: 1,
  })
  assert.equal(first.ok, true)
  if (!first.ok) return
  const second = applySittingEvent(first.state, {
    type: 'join',
    id: 'player-two-id',
    name: 'Nica',
    at: 2,
  })
  assert.equal(second.ok, true)
  if (!second.ok) return
  const dropped = applySittingEvent(second.state, { type: 'disconnect', id: 'player-two-id' })
  assert.equal(dropped.ok, true)
  if (!dropped.ok) return
  assert.equal(dropped.state.players.length, 2)
  assert.equal(dropped.state.players.find((player) => player.id === 'player-two-id')?.connected, false)
  assert.equal(filterPlayers(dropped.state.players, 'nic').length, 1)
  assert.equal(filterPlayers(dropped.state.players, 'zzz').length, 0)
})

test('player ids and error copy cover the machine codes', () => {
  assert.equal(isPlayerId('player-one-id'), true)
  assert.equal(isPlayerId('short'), false)
  assert.equal(sittingErrorMessage('room-full'), 'This table is full (8).')
  assert.equal(sittingErrorMessage('not-found'), 'That code is not a table.')
})
