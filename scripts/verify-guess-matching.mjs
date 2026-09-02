#!/usr/bin/env node
/**
 * Assertions for the free-text answer checker in worker/guess.ts.
 *
 *   node --experimental-strip-types scripts/verify-guess-matching.mjs
 *
 * The track-id path lives in worker/index.ts and needs D1, so it is verified
 * against the deployed API instead. This covers everything a player can type.
 */

import { checkGuess } from '../worker/guess.ts'

let passed = 0
const failures = []

function expect(label, guess, title, artist, shouldBeCorrect) {
  const { correct } = checkGuess(guess, title, artist)
  if (correct === shouldBeCorrect) {
    passed += 1
    return
  }
  failures.push(`${label}: guess ${JSON.stringify(guess)} vs ${JSON.stringify(`${title} - ${artist}`)} -> ${correct}, wanted ${shouldBeCorrect}`)
}

function accepts(guess, title, artist) {
  expect('accept', guess, title, artist, true)
}

function rejects(guess, title, artist) {
  expect('reject', guess, title, artist, false)
}

// The reported bug, in both directions.
accepts('MAPA - From THE FIRST TAKE', 'MAPA', 'SB19')
accepts('MAPA', 'MAPA - From THE FIRST TAKE', 'SB19')
accepts('MAPA (From THE FIRST TAKE)', 'MAPA', 'SB19')
accepts('mapa from the first take', 'MAPA', 'SB19')

// The autocomplete writes "<title> - <artist>" into the box before submit.
accepts('MAPA - From THE FIRST TAKE - SB19', 'MAPA', 'SB19')
accepts('MAPA - SB19', 'MAPA - From THE FIRST TAKE', 'SB19')

// Other variant shapes on real catalogue entries.
accepts('GENTO - From THE FIRST TAKE', 'GENTO', 'SB19')
accepts('GENTO', 'GENTO - From THE FIRST TAKE', 'SB19')
accepts('Love Goes', 'Love Goes - EDM Version', 'SB19')
accepts('Love Goes - EDM Version', 'Love Goes', 'SB19')
accepts('Time (Live)', 'Time', 'SB19')
accepts('Kathang Isip - Acoustic', 'Kathang Isip', 'Ben&Ben')
accepts('Anak (2011 Remaster)', 'Anak', 'Freddie Aguilar')

// Plain correct answers must keep working.
accepts('MAPA', 'MAPA', 'SB19')
accepts('mapa', 'MAPA', 'SB19')

// Wrong songs must still be wrong.
rejects('GENTO', 'MAPA', 'SB19')
rejects('Kathang Isip', 'MAPA', 'SB19')
rejects('GENTO - From THE FIRST TAKE', 'MAPA', 'SB19')

// An all-stopword guess must not sneak through the token path.
rejects('the', 'MAPA', 'SB19')
rejects('a the an', 'MAPA', 'SB19')

console.log('')
if (failures.length > 0) {
  console.log(`FAILED ${failures.length} of ${passed + failures.length} checks:`)
  for (const failure of failures) console.log(`  x ${failure}`)
  process.exit(1)
}

console.log(`OK  ${passed} guess-matching checks passed`)
