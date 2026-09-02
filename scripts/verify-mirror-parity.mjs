#!/usr/bin/env node
/**
 * Guards the hand-maintained mirror: worker/track-dedupe.ts (shipped) and
 * scripts/track-dedupe.mjs (build + D1 maintenance) must canonicalize the same.
 *
 *   node --experimental-strip-types scripts/verify-mirror-parity.mjs
 */

import * as js from './track-dedupe.mjs'
import * as ts from '../worker/track-dedupe.ts'

const TITLES = [
  'MAPA',
  'MAPA - From THE FIRST TAKE',
  'MAPA (From THE FIRST TAKE)',
  'MAPA (feat. Ben&Ben) - From THE FIRST TAKE',
  'Alive',
  'Live',
  'U - Live',
  'Anak (Live) [2011 Remaster]',
  'Anak - 2011 Remaster',
  'Hindi Tayo Pwede (I Love You Goodbye)',
  'Pasilyo (feat. SB19)',
  'Sana Maulit Muli - From "Hello, Love, Goodbye"',
  'Uhaw (Zack Tabudlo Remix)',
  'Uhaw - Sped Up',
  '(Remastered 2011)',
  'Spider-Man Theme',
  'Migraine (2019)',
  'Kathang Isip (Live from Wish 107.5 Bus)',
  'Bituing Walang Ningning - Karaoke Version',
  'Ere (Bonus Track)',
]

const mismatches = []
for (const title of TITLES) {
  const fromTs = ts.canonicalSongTitle(title)
  const fromJs = js.canonicalSongTitle(title)
  if (fromTs !== fromJs) {
    mismatches.push(`${JSON.stringify(title)}  ts=${JSON.stringify(fromTs)}  js=${JSON.stringify(fromJs)}`)
  }
}

const PAIRS = [
  [{ id: 'a', title: 'MAPA', playCount: 120_000_000 }, { id: 'b', title: 'MAPA - From THE FIRST TAKE', playCount: 9_000_000 }],
  [{ id: 'a', title: 'MAPA', playCount: 1_000_000 }, { id: 'b', title: 'MAPA (Live)', playCount: 40_000_000 }],
  [{ id: 'a', title: 'MAPA' }, { id: 'b', title: 'MAPA (Live)' }],
]

for (const [left, right] of PAIRS) {
  const fromTs = Math.sign(ts.compareVariants(left, right))
  const fromJs = Math.sign(js.compareVariants(left, right))
  if (fromTs !== fromJs) {
    mismatches.push(`compareVariants ${left.title} vs ${right.title}  ts=${fromTs}  js=${fromJs}`)
  }
}

if (mismatches.length > 0) {
  console.log(`MIRROR DRIFT (${mismatches.length}):`)
  for (const line of mismatches) console.log(`  x ${line}`)
  process.exit(1)
}

console.log(`OK  worker/track-dedupe.ts and scripts/track-dedupe.mjs agree on ${TITLES.length} titles and ${PAIRS.length} orderings`)
