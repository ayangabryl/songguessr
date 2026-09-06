import assert from 'node:assert/strict'
// Run against a local development server: MATCH_TEST_ORIGIN=http://127.0.0.1:3017 node scripts/test-match.mjs
const origin = process.env.MATCH_TEST_ORIGIN ?? 'http://127.0.0.1:3000'
if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname))
  throw Error('Use a local test server')
const { code } = await (
  await fetch(origin + '/api/sitting', { method: 'POST' })
).json()
const connect = async (
  name,
  id = crypto.randomUUID(),
  token = crypto.randomUUID(),
) => {
  const ws = new WebSocket(
    origin.replace('http', 'ws') +
      `/api/sitting/${code}/ws?` +
      new URLSearchParams({ playerId: id, name, token }),
  )
  const client = {
    ws,
    id,
    token,
    state: null,
    loadCommand: null,
    loadRetries: 0,
    send: (payload) => {
      const command = JSON.parse(payload)
      if (command.type === 'match-start' || command.type === 'match-next') {
        client.loadCommand = payload
        client.loadRetries = 0
      }
      ws.send(payload)
    },
    wait: async (predicate) => {
      for (let i = 0; i < 900; i++) {
        if (client.state && predicate(client.state)) return client.state
        await new Promise((r) => setTimeout(r, 50))
      }
      throw Error(
        'Timed out ' +
          name +
          ' state ' +
          JSON.stringify({
            host: client.state?.hostId,
            players: client.state?.players,
            phase: client.state?.match?.phase,
            number: client.state?.match?.number,
          }),
      )
    },
  }
  ws.onmessage = (e) => {
    const data = JSON.parse(e.data)
    if (data.type === 'state') client.state = data
    else if (data.type === 'match-error') {
      console.log(data.message)
      if (client.loadCommand && client.loadRetries++ < 2) {
        // Exercise the same safe retry available to the host after a catalog outage.
        setTimeout(() => ws.send(client.loadCommand), 500)
      }
    }
  }
  await client.wait((s) => s.players.some((p) => p.id === id))
  return client
}
const alice = await connect('QA Alice'),
  bob = await connect('QA Bob')
alice.send(JSON.stringify({ type: 'match-start', difficulty: 'easy' }))
await alice.wait((s) => s.match?.phase === 'playing')
await bob.wait((s) => s.match?.phase === 'playing')
assert.equal(alice.state.match.roundId, bob.state.match.roundId)
assert.equal(alice.state.match.audio, bob.state.match.audio)
assert.equal(alice.state.match.answer, null)
const roundId = alice.state.match.roundId
await new Promise((r) =>
  setTimeout(r, Math.max(0, alice.state.match.startsAt - Date.now() + 100)),
)
alice.send(JSON.stringify({ type: 'score', delta: 6 }))
alice.send(JSON.stringify({ type: 'match-skip', roundId, stage: 0 }))
alice.send(JSON.stringify({ type: 'match-skip', roundId, stage: 0 }))
await alice.wait(
  (s) => s.match.entries.find((p) => p.id === alice.id).stage === 1,
)
assert.equal(alice.state.match.entries.find((p) => p.id === bob.id).stage, 0)
assert.equal(alice.state.match.entries.find((p) => p.id === alice.id).points, 0)
for (let stage = 1; stage < 5; stage++) {
  alice.send(JSON.stringify({ type: 'match-skip', roundId, stage }))
  await alice.wait((s) => {
    const p = s.match.entries.find((p) => p.id === alice.id)
    return stage === 4 ? p.status === 'out' : p.stage === stage + 1
  })
}
assert.equal(alice.state.match.phase, 'playing')
assert.equal(alice.state.match.answer, null)
for (let stage = 0; stage < 5; stage++) {
  bob.send(JSON.stringify({ type: 'match-skip', roundId, stage }))
  await bob.wait((s) => {
    const p = s.match.entries.find((p) => p.id === bob.id)
    return stage === 4 ? p.status === 'out' : p.stage === stage + 1
  })
}
await alice.wait((s) => s.match.phase === 'reveal')
assert(alice.state.match.answer.title)
bob.send(JSON.stringify({ type: 'match-next', roundId }))
await new Promise((r) => setTimeout(r, 200))
assert.equal(bob.state.match.roundId, roundId)
alice.send(JSON.stringify({ type: 'match-next', roundId }))
await alice.wait((s) => s.match.number === 2)
assert.equal(alice.state.match.entries[0].history.length, 1)
alice.send(JSON.stringify({ type: 'match-skip', roundId, stage: 0 }))
await new Promise((r) => setTimeout(r, 100))
assert.equal(alice.state.match.entries[0].stage, 0)
// Reconnect the second seat without resetting its progress.
bob.ws.close()
await new Promise((r) => setTimeout(r, 100))
const rejoined = await connect('QA Bob', bob.id, bob.token)
assert.equal(rejoined.state.match.number, 2)
for (let number = 2; number <= 10; number++) {
  await alice.wait((s) => s.match.number === number)
  const current = alice.state.match
  await new Promise((r) =>
    setTimeout(r, Math.max(0, current.startsAt - Date.now() + 50)),
  )
  for (const client of [alice, rejoined]) {
    for (let stage = 0; stage < 5; stage++) {
      client.send(
        JSON.stringify({ type: 'match-skip', roundId: current.roundId, stage }),
      )
      await client.wait((s) => {
        const p = s.match.entries.find((p) => p.id === client.id)
        return stage === 4 ? p.status === 'out' : p.stage === stage + 1
      })
    }
  }
  await alice.wait((s) => s.match.phase !== 'playing')
  assert.equal(alice.state.match.entries[0].history.length, number)
  if (number < 10)
    rejoined.send(
      JSON.stringify({ type: 'match-next', roundId: current.roundId }),
    )
  if (number < 10)
    alice.send(JSON.stringify({ type: 'match-next', roundId: current.roundId }))
}
assert.equal(alice.state.match.phase, 'finished')
rejoined.send(
  JSON.stringify({ type: 'match-next', roundId: alice.state.match.roundId }),
)
alice.send(
  JSON.stringify({ type: 'match-next', roundId: alice.state.match.roundId }),
)
await alice.wait((s) => s.match.number === 1 && s.match.phase === 'playing')
assert.equal(alice.state.match.entries[0].history.length, 0)
assert.equal(alice.state.match.entries[0].points, 0)
alice.ws.close()
rejoined.ws.close()
console.log(
  'PASS: reconnect, all ten rounds, final standings and rematch reset',
)
console.log(
  'PASS: shared song, private stages, duplicate/forged score rejection, shared reveal, everyone-ready next, stale-round rejection',
)
