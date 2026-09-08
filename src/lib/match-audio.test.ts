import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createMatchAudioPlayer, type MatchAudioState } from './match-audio.ts'

class Media extends EventTarget {
  readyState = 4; duration = 30; currentTime = 0; seeking = false
  muted = true; volume = 1; paused = true; ended = false; error = null
  src = '/api/audio/test.mp3'; calls = 0
  deferred: Promise<void> | undefined
  getAttribute() { return this.src }
  load() { this.error = null }
  pause() { this.paused = true }
  play() { this.calls++; this.paused = false; return this.deferred ?? Promise.resolve() }
}
function setup() {
  const media = new Media(), states: MatchAudioState[] = [], errors: unknown[] = []
  let heard = 0
  const player = createMatchAudioPlayer(media as unknown as HTMLAudioElement, {
    state: s => states.push(s), error: e => errors.push(e), heard: () => heard++,
  })
  return { media, player, states, errors, get heard() { return heard } }
}
const clip = { start: 0, duration: .1, volume: .7 }
const flush = async () => { await Promise.resolve(); await Promise.resolve() }

test('play restores sound and buffering does not consume the clip', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const x = setup()
  await x.player.play(clip)
  assert.equal(x.media.muted, false)
  assert.equal(x.media.volume, .7)
  t.mock.timers.tick(3000)
  assert.equal(x.media.paused, false, 'no decoded time passed while buffering')
  x.media.currentTime = .101
  t.mock.timers.tick(25)
  assert.equal(x.media.paused, true)
  assert.equal(x.states.at(-1), 'idle')
  x.player.dispose()
})
test('waits for metadata and seeking before starting an offset continuation', async () => {
  const x = setup(); x.media.readyState = 0
  const pending = x.player.play({ ...clip, start: 2, duration: 6 })
  assert.equal(x.media.calls, 0)
  x.media.readyState = 4; x.media.dispatchEvent(new Event('loadedmetadata')); await flush()
  assert.equal(x.media.currentTime, 2)
  assert.equal(x.media.calls, 0)
  x.media.dispatchEvent(new Event('seeked')); await pending
  assert.equal(x.media.calls, 1); assert.equal(x.heard, 1)
  x.player.dispose()
})
test('cancel during loading cannot start late after a skip or leaving the table', async () => {
  const x = setup(); x.media.readyState = 0
  const pending = x.player.play(clip)
  x.player.stop(); x.media.dispatchEvent(new Event('loadedmetadata')); await pending
  assert.equal(x.media.calls, 0); assert.equal(x.errors.length, 0)
  x.player.dispose()
})
test('a stale play promise cannot pause or time out a newer replay', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const x = setup(); let resolve!: () => void
  x.media.deferred = new Promise<void>(r => { resolve = r })
  const old = x.player.play(clip)
  x.media.deferred = undefined
  await x.player.play({ ...clip, duration: 2 })
  resolve(); await old; t.mock.timers.tick(500)
  assert.equal(x.media.paused, false); assert.equal(x.heard, 1)
  x.player.dispose()
})
test('blocked autoplay stays retryable and never marks an unheard clip heard', async () => {
  const x = setup()
  x.media.deferred = Promise.reject(new DOMException('Gesture needed', 'NotAllowedError'))
  await x.player.play(clip)
  assert.equal(x.states.at(-1), 'idle'); assert.equal(x.heard, 0); assert.equal(x.errors.length, 1)
  x.media.deferred = undefined; await x.player.play(clip)
  assert.equal(x.states.at(-1), 'playing'); assert.equal(x.heard, 1)
  x.player.dispose()
})
test('missing audio fails immediately instead of showing false playback', async () => {
  const x = setup(); x.media.src = ''
  await x.player.play(clip)
  assert.equal(x.media.calls, 0); assert.equal(x.errors.length, 1)
  x.player.dispose()
})
test('dispose cancels clip timers and later media events', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const x = setup(); await x.player.play(clip); x.player.dispose()
  const count = x.states.length
  t.mock.timers.tick(5000); x.media.dispatchEvent(new Event('ended'))
  assert.equal(x.states.length, count)
})

test('acknowledged Skip extends running audio without pause, seek, or another play', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const x = setup(); await x.player.play({ ...clip, duration: 2 })
  x.media.currentTime = .7
  const pause = t.mock.method(x.media, 'pause')
  assert.equal(x.player.extendTo(8), true)
  assert.equal(x.media.currentTime, .7)
  assert.equal(x.media.calls, 1)
  assert.equal(pause.mock.callCount(), 0)
  x.media.currentTime = 2.1; t.mock.timers.tick(25)
  assert.equal(x.media.paused, false)
  assert.equal(x.player.extendTo(15), true)
  x.media.currentTime = 8.1; t.mock.timers.tick(25)
  assert.equal(x.media.paused, false)
  x.media.currentTime = 14.995; t.mock.timers.tick(25)
  assert.equal(x.media.paused, true)
  assert.equal(x.player.position, 15, 'resume from the exact cutoff despite the pause lead')
  assert.equal(x.player.extendTo(20), false)
  x.player.dispose()
})

test('Skip during metadata loading keeps the pending play and its extended endpoint', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const x = setup(); x.media.readyState = 0
  const pending = x.player.play({ ...clip, duration: 2 })
  assert.equal(x.player.position, 0)
  assert.equal(x.player.extendTo(8), true)
  x.media.readyState = 4; x.media.dispatchEvent(new Event('loadedmetadata')); await pending
  x.media.currentTime = 2.5; t.mock.timers.tick(25)
  assert.equal(x.media.paused, false)
  assert.equal(x.media.calls, 1)
  x.player.dispose()
})

test('paused and never-started clips report the actual cursor rather than the old limit', async () => {
  const x = setup()
  assert.equal(x.player.position, 0)
  assert.equal(x.player.extendTo(8), false)
  await x.player.play({ ...clip, duration: 8 })
  x.media.currentTime = 1.4; x.player.stop()
  assert.equal(x.player.position, 1.4)
  assert.equal(x.player.extendTo(15), false)
  await x.player.play({ ...clip, start: x.player.position, duration: 15 - x.player.position })
  assert.equal(x.media.currentTime, 1.4)
  assert.equal(x.media.paused, false)
  x.player.dispose()
})

test('a late acknowledgement resumes at the cut; no unapproved audio plays while waiting', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const x = setup(); await x.player.play({ ...clip, duration: 2 })
  x.media.currentTime = 1.995; t.mock.timers.tick(25)
  assert.equal(x.media.paused, true)
  t.mock.timers.tick(1000)
  assert.equal(x.player.position, 2)
  assert.equal(x.player.extendTo(8), false)
  await x.player.play({ ...clip, start: x.player.position, duration: 6 })
  assert.ok(Math.abs(x.media.currentTime - 2) < .015)
  assert.equal(x.media.paused, false)
  x.player.dispose()
})
