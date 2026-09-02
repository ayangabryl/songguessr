#!/usr/bin/env node
/**
 * Clip-timer math for Spotify SDK and HTML-audio short stages.
 *
 *   node --experimental-strip-types scripts/verify-clip-timer.mjs
 */

import {
  MAX_ASSUMED_DETECTION_LAG_MS,
  assumedElapsedMs,
  clipPauseDelayMs,
  effectivePauseLeadMs,
  observePauseLatency,
  resetPauseLeadForTests,
  startClipTimer,
} from '../src/lib/clip-timer.ts'

let passed = 0
const failures = []

function expectEqual(label, actual, expected, digits = 6) {
  const ok = Math.abs(actual - expected) < 10 ** -digits || actual === expected
  if (ok) {
    passed += 1
    return
  }
  failures.push(`${label}: got ${actual}, wanted ${expected}`)
}

function expectTrue(label, value) {
  if (value) {
    passed += 1
    return
  }
  failures.push(`${label}: expected true`)
}

resetPauseLeadForTests()

// 0.01s Spotify clip: detection often arrives after audio already started.
expectEqual(
  '0.01s overrun pauses immediately',
  clipPauseDelayMs(10, assumedElapsedMs({ mediaElapsedMs: 0, detectionLagMs: 180 }), 36),
  0,
)

// 0.1s with coarse SDK position still 0 and 80ms detection lag.
expectEqual(
  '0.1s uses detection lag when SDK position is 0',
  assumedElapsedMs({ mediaElapsedMs: 0, detectionLagMs: 80 }),
  80,
)
expectEqual(
  '0.1s pause is scheduled early',
  clipPauseDelayMs(100, 80, 36),
  0,
)

// Accurate HTML currentTime: no detection lag, small lead.
expectEqual(
  'HTML 0.01s keeps a few ms when start is exact',
  clipPauseDelayMs(10, 0, 8),
  10 - effectivePauseLeadMs(10, 8),
)
expectEqual(
  'HTML 0.1s remaining uses currentTime',
  clipPauseDelayMs(100, 12, 8),
  100 - 12 - effectivePauseLeadMs(100, 8),
)

// Longer stages should not be cut in half by pause lead.
expectEqual('2s lead is the measured value', effectivePauseLeadMs(2000, 36), 36)
expectEqual('2s delay is duration minus lead', clipPauseDelayMs(2000, 0, 36), 1964)

// Detection lag is capped so a slow waitUntilPlaying cannot skip a whole clip.
expectEqual(
  'detection lag cap',
  assumedElapsedMs({ mediaElapsedMs: 0, detectionLagMs: 5000 }),
  MAX_ASSUMED_DETECTION_LAG_MS,
)

// SDK position wins once it has actually advanced.
expectEqual(
  'SDK position wins over lag',
  assumedElapsedMs({ mediaElapsedMs: 250, detectionLagMs: 80 }),
  250,
)

resetPauseLeadForTests()
const nextLead = observePauseLatency('spotify', 50)
expectTrue('measured lead stays in band', nextLead >= 8 && nextLead <= 90)
expectTrue('lead moves toward observation', nextLead > 36)

// High-res timer with a fake clock: pause fires at duration minus lead.
resetPauseLeadForTests()
let now = 0
let timeoutFn = null
let timeoutMs = -1
let ended = false
const handle = startClipTimer({
  durationMs: 100,
  alreadyElapsedMs: 0,
  pauseLeadMs: 40,
  onEnd: () => {
    ended = true
  },
  clock: {
    now: () => now,
    setTimeout: (fn, ms) => {
      timeoutFn = fn
      timeoutMs = ms
      return 1
    },
    clearTimeout: () => {
      timeoutFn = null
    },
    raf: () => 1,
    cancelRaf: () => {},
  },
})
expectEqual('timer schedules early pause', timeoutMs, clipPauseDelayMs(100, 0, 40))
timeoutFn?.()
expectTrue('timer end fires', ended)
handle.abort()

if (failures.length > 0) {
  console.error(`clip-timer: ${failures.length} failed, ${passed} passed`)
  for (const failure of failures) console.error(`  ${failure}`)
  process.exit(1)
}

console.log(`clip-timer: ${passed} passed`)
