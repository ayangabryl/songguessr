import assert from 'node:assert/strict'
import { test } from 'node:test'
import { startClipTimer, type ClipTimerClock } from './clip-timer.ts'

function fakeClock() {
  let now = 0, id = 0
  const jobs = new Map<number, { at: number; fn: () => void }>()
  const schedule = (fn: () => void, ms: number) => {
    jobs.set(++id, { at: now + ms, fn }); return id
  }
  const clock: ClipTimerClock = {
    now: () => now, setTimeout: schedule, clearTimeout: id => { jobs.delete(id) },
    raf: fn => schedule(fn, 16), cancelRaf: id => { jobs.delete(id) },
  }
  return { clock, advance(ms: number) {
    const end = now + ms
    for (;;) {
      const next = [...jobs].sort((a, b) => a[1].at - b[1].at)[0]
      if (!next || next[1].at > end) break
      now = next[1].at; jobs.delete(next[0]); next[1].fn()
    }
    now = end
  }, get jobs() { return jobs.size } }
}

test('extending a playing clip preserves its clock and cancels the old cutoff', () => {
  const c = fakeClock(); let ended = 0, progress = 0
  const clip = startClipTimer({ clock: c.clock, durationMs: 2000, pauseLeadMs: 8,
    onTick: value => { progress = value }, onEnd: () => ended++ })
  c.advance(500)
  assert.equal(clip.extend(8000), true)
  c.advance(1600)
  assert.equal(ended, 0)
  assert.ok(progress >= 2000 && progress < 2200, 'no jump to the old endpoint or reset to zero')
  assert.equal(clip.extend(15000), true)
  c.advance(6000)
  assert.equal(ended, 0, 'second extension also cancels the prior cutoff')
  c.advance(6892)
  assert.equal(ended, 1)
  assert.equal(progress, 15000)
  assert.equal(c.jobs, 0)
  assert.equal(clip.extend(30000), false, 'a finished clip must be resumed explicitly')
})

test('buffering does not consume a media-clock clip before or after Skip', () => {
  const c = fakeClock(); let media = 500, ended = 0
  const clip = startClipTimer({ clock: c.clock, durationMs: 2000, pauseLeadMs: 8,
    mediaClockOnly: true, getMediaElapsedMs: () => media, onEnd: () => ended++ })
  c.advance(5000)
  assert.equal(ended, 0)
  clip.extend(8000)
  media = 2100; c.advance(8000)
  assert.equal(ended, 0)
  media = 7992; c.advance(16)
  assert.equal(ended, 1)
  assert.equal(c.jobs, 0)
})

test('coarse Spotify positions retain the wall-clock cutoff after extending', () => {
  const c = fakeClock(); let ended = 0
  const clip = startClipTimer({ clock: c.clock, durationMs: 2000, alreadyElapsedMs: 100,
    pauseLeadMs: 36, getMediaElapsedMs: () => 0, onEnd: () => ended++ })
  c.advance(500); clip.extend(8000); c.advance(7363)
  assert.equal(ended, 0)
  c.advance(1)
  assert.equal(ended, 1)
})

test('invalid extensions cannot shorten a clip and cancellation prevents late callbacks', () => {
  const c = fakeClock(); let ended = 0
  const clip = startClipTimer({ clock: c.clock, durationMs: 2000, pauseLeadMs: 8, onEnd: () => ended++ })
  for (const value of [1000, 2000, NaN, Infinity]) assert.equal(clip.extend(value), false)
  clip.abort()
  assert.equal(clip.extend(8000), false)
  c.advance(10000)
  assert.equal(ended, 0)
  assert.equal(c.jobs, 0)
})

test('HTML audio that ends before the unlocked limit cleans up its timer', async t => {
  const { startTimedHtmlClip } = await import('./audio-playback.ts')
  const c = fakeClock()
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    setTimeout: c.clock.setTimeout, clearTimeout: c.clock.clearTimeout,
    requestAnimationFrame: c.clock.raf, cancelAnimationFrame: c.clock.cancelRaf,
  } })
  t.after(() => {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow)
    else Reflect.deleteProperty(globalThis, 'window')
  })
  const audio = Object.assign(new EventTarget(), { currentTime: 0, pause: () => {} })
  let ended = 0
  const clip = startTimedHtmlClip(audio as unknown as HTMLAudioElement, {
    startSeconds: 0, durationSeconds: 2, onEnd: () => ended++,
  })
  assert.equal(clip.extend(8000), true)
  audio.currentTime = 3; audio.dispatchEvent(new Event('ended'))
  assert.equal(ended, 1)
  assert.equal(clip.extend(15000), false)
  assert.equal(c.jobs, 0)
  c.advance(20000)
  assert.equal(ended, 1)
})
