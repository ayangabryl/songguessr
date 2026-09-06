import assert from 'node:assert/strict'
const origin = process.env.MATCH_TEST_ORIGIN ?? 'http://127.0.0.1:3017'
if (!['localhost', '127.0.0.1'].includes(new URL(origin).hostname))
  throw Error('Use a local test server')
const { code } = await (
  await fetch(origin + '/api/sitting', { method: 'POST' })
).json()
async function connect(name) {
  const id = crypto.randomUUID(),
    ws = new WebSocket(
      origin.replace('http', 'ws') +
        `/api/sitting/${code}/ws?` +
        new URLSearchParams({ playerId: id, name, token: crypto.randomUUID() }),
    )
  const c = {
    id,
    ws,
    state: null,
    async wait(test) {
      for (let i = 0; i < 100; i++) {
        if (c.state && test(c.state)) return
        await new Promise((r) => setTimeout(r, 50))
      }
      throw Error('No expected room update')
    },
  }
  ws.onmessage = (e) => {
    const s = JSON.parse(e.data)
    if (s.type === 'state') c.state = s
  }
  await c.wait((s) => s.players.some((p) => p.id === id))
  return c
}
const a = await connect('Pet test A'),
  b = await connect('Pet test B')
try {
  b.ws.send(
    JSON.stringify({
      type: 'pet-profile',
      name: 'Music buddy',
      appearance: {
        headgear: 'daisy',
        clothing: 'scarf',
        eyewear: 'round',
        accessoryColor: 'rose',
        scale: 99,
      },
    }),
  )
  await a.wait(
    (s) =>
      s.players.find((p) => p.id === b.id)?.appearance?.eyewear === 'round',
  )
  const peer = a.state.players.find((p) => p.id === b.id)
  assert.equal(peer.name, 'Music buddy')
  assert.equal(peer.appearance.scale, undefined)
  a.ws.send(JSON.stringify({ type: 'pet-greet', target: b.id }))
  await b.wait(
    (s) => s.players.find((p) => p.id === b.id)?.greeting?.from === a.id,
  )
  const time = b.state.players.find((p) => p.id === b.id).greeting.at
  a.ws.send(JSON.stringify({ type: 'pet-greet', target: b.id }))
  await new Promise((r) => setTimeout(r, 150))
  assert.equal(b.state.players.find((p) => p.id === b.id).greeting.at, time)
  console.log(
    'PASS: appearance sharing, name updates, greetings and greeting cooldown',
  )
} finally {
  a.ws.close()
  b.ws.close()
}
