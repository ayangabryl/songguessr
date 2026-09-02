#!/usr/bin/env node
/**
 * Assertions for the version-aware title canonicalizer.
 *
 *   node scripts/verify-song-variants.mjs
 *
 * The repo has no test runner, so this stands in for unit tests. It covers the
 * qualifier patterns that must collapse, the titles that must survive intact,
 * and the keep-the-better-version ordering used at ingest and cleanup time.
 */

import { canonicalSongTitle, compareVariants, isSameSong, songIdentityKey } from './track-dedupe.mjs'

let passed = 0
const failures = []

function check(label, actual, expected) {
  if (actual === expected) {
    passed += 1
    return
  }
  failures.push(`${label}\n      expected: ${JSON.stringify(expected)}\n      actual:   ${JSON.stringify(actual)}`)
}

function collapses(variant, plain) {
  check(
    `collapse  ${JSON.stringify(variant)} -> ${JSON.stringify(plain)}`,
    canonicalSongTitle(variant),
    canonicalSongTitle(plain),
  )
}

function survives(title, expected) {
  check(`preserve  ${JSON.stringify(title)}`, canonicalSongTitle(title), expected)
}

console.log('--- qualifiers that must collapse onto the plain title ---')

const COLLAPSING = [
  // The reported bug.
  ['MAPA - From THE FIRST TAKE', 'MAPA'],
  ['MAPA (From THE FIRST TAKE)', 'MAPA'],
  ['MAPA - THE FIRST TAKE', 'MAPA'],
  ['MAPA [First Take]', 'MAPA'],

  // Live.
  ['Kathang Isip - Live', 'Kathang Isip'],
  ['Kathang Isip (Live)', 'Kathang Isip'],
  ['Kathang Isip - Live at the Araneta Coliseum', 'Kathang Isip'],
  ['Kathang Isip (Live from Wish 107.5 Bus)', 'Kathang Isip'],
  ['Kathang Isip - Live Version', 'Kathang Isip'],
  ['Kathang Isip (Acoustic Live Version)', 'Kathang Isip'],

  // Remaster.
  ['Anak - Remaster', 'Anak'],
  ['Anak - Remastered', 'Anak'],
  ['Anak - Remastered 2011', 'Anak'],
  ['Anak - 2011 Remaster', 'Anak'],
  ['Anak (2011 Remastered Version)', 'Anak'],

  // Acoustic family.
  ['Migraine - Acoustic', 'Migraine'],
  ['Migraine (Acoustic Version)', 'Migraine'],
  ['Migraine - Stripped', 'Migraine'],
  ['Migraine (Unplugged)', 'Migraine'],

  // Edits and versions.
  ['Buwan - Radio Edit', 'Buwan'],
  ['Buwan (Single Version)', 'Buwan'],
  ['Buwan - Album Version', 'Buwan'],
  ['Buwan (Extended)', 'Buwan'],
  ['Buwan - Extended Mix', 'Buwan'],

  // Packaging.
  ['Ere (Deluxe)', 'Ere'],
  ['Ere - Deluxe Edition', 'Ere'],
  ['Ere (Bonus Track)', 'Ere'],
  ['Ere - Reissue', 'Ere'],

  // Remix / speed edits.
  ['Uhaw - Remix', 'Uhaw'],
  ['Uhaw (Zack Tabudlo Remix)', 'Uhaw'],
  ['Uhaw - Sped Up', 'Uhaw'],
  ['Uhaw (Slowed)', 'Uhaw'],
  ['Uhaw - Nightcore', 'Uhaw'],

  // Reinterpretations.
  ['Bituing Walang Ningning (Cover)', 'Bituing Walang Ningning'],
  ['Bituing Walang Ningning - Demo', 'Bituing Walang Ningning'],
  ['Bituing Walang Ningning (Instrumental)', 'Bituing Walang Ningning'],
  ['Bituing Walang Ningning - Karaoke Version', 'Bituing Walang Ningning'],

  // Credits.
  ['Pasilyo (feat. SB19)', 'Pasilyo'],
  ['Pasilyo - feat. SB19', 'Pasilyo'],
  ['Pasilyo ft. SB19', 'Pasilyo'],
  ['Pasilyo featuring SB19', 'Pasilyo'],

  // Soundtrack attributions.
  ['Sana Maulit Muli (OST)', 'Sana Maulit Muli'],
  ['Sana Maulit Muli - From "Hello, Love, Goodbye"', 'Sana Maulit Muli'],
  ['Sana Maulit Muli (Original Soundtrack)', 'Sana Maulit Muli'],
  ['Sana Maulit Muli - Theme Song', 'Sana Maulit Muli'],

  // Stacked qualifiers.
  ['MAPA (feat. Ben&Ben) - From THE FIRST TAKE', 'MAPA'],
  ['Anak (Live) [2011 Remaster]', 'Anak'],
]

for (const [variant, plain] of COLLAPSING) collapses(variant, plain)

console.log('--- titles that must NOT be mangled ---')

// A qualifier word inside a real title, or a title that IS the qualifier.
survives('Live', 'live')
survives('Alive', 'alive')
survives('Stayin Alive', 'stayin alive')
survives('Remix', 'remix')
survives('Cover Girl', 'cover girl')
survives('Livestream', 'livestream')
survives('Diversion', 'diversion')
survives('Spider-Man Theme', 'spider man theme')
survives('Ako ay Buhay (Live)', 'ako ay buhay')

// Parentheticals that are part of the song name, not a version qualifier.
survives('Hindi Tayo Pwede (I Love You Goodbye)', 'hindi tayo pwede i love you goodbye')
survives('Kailan (Ang Tunay na Pag-ibig)', 'kailan ang tunay na pag ibig')
survives('Migraine (2019)', 'migraine 2019')

// Entirely-qualifier titles fall back to the original rather than emptying out.
survives('(Live)', 'live')
survives('(Remastered 2011)', 'remastered 2011')
survives('Live at Leeds', 'live at leeds')
survives('From the Start', 'from the start')

// Stripping must never leave a 0/1-character stub.
survives('U - Live', 'u live')
survives('7 (Remix)', '7 remix')

console.log('--- identity keys pair the MAPA variants, not unrelated songs ---')

const MAPA_STUDIO = { id: 'studio', title: 'MAPA', artist: 'SB19' }
const MAPA_FIRST_TAKE = { id: 'firsttake', title: 'MAPA - From THE FIRST TAKE', artist: 'SB19' }
const MAPA_OTHER_ARTIST = { id: 'other', title: 'MAPA', artist: 'Ben&Ben' }
const DIFFERENT_SONG = { id: 'gento', title: 'GENTO', artist: 'SB19' }

check('same song   MAPA / MAPA First Take', isSameSong(MAPA_STUDIO, MAPA_FIRST_TAKE), true)
check('diff artist MAPA SB19 / MAPA Ben&Ben', isSameSong(MAPA_STUDIO, MAPA_OTHER_ARTIST), false)
check('diff song   MAPA / GENTO', isSameSong(MAPA_STUDIO, DIFFERENT_SONG), false)
check('key shape', songIdentityKey(MAPA_FIRST_TAKE), 'sb19|mapa')

console.log('--- keep-the-better-version ordering ---')

function better(left, right) {
  return compareVariants(left, right) < 0 ? left.id : right.id
}

check(
  'higher play count wins',
  better(
    { id: 'studio', title: 'MAPA', playCount: 120_000_000 },
    { id: 'firsttake', title: 'MAPA - From THE FIRST TAKE', playCount: 9_000_000 },
  ),
  'studio',
)
check(
  'decisive variant play count wins',
  better(
    { id: 'studio', title: 'MAPA', playCount: 1_000_000 },
    { id: 'firsttake', title: 'MAPA - From THE FIRST TAKE', playCount: 40_000_000 },
  ),
  'firsttake',
)
check(
  'narrow variant lead still keeps the plain release',
  better(
    { id: 'studio', title: 'MAPA', playCount: 10_000_000 },
    { id: 'firsttake', title: 'MAPA - From THE FIRST TAKE', playCount: 10_500_000 },
  ),
  'studio',
)
check(
  'no play counts falls back to the plainer title',
  better({ id: 'studio', title: 'MAPA' }, { id: 'live', title: 'MAPA (Live)' }),
  'studio',
)
check(
  'no play counts, both plain, falls back to popularity',
  better(
    { id: 'low', title: 'MAPA', popularity: 40 },
    { id: 'high', title: 'MAPA', popularity: 71 },
  ),
  'high',
)
check(
  'only the variant has plays, plain title still wins',
  better({ id: 'studio', title: 'MAPA' }, { id: 'live', title: 'MAPA (Live)', playCount: 5_000_000 }),
  'studio',
)

console.log('')
if (failures.length > 0) {
  console.log(`FAILED ${failures.length} of ${passed + failures.length} checks:\n`)
  for (const failure of failures) console.log(`  x ${failure}\n`)
  process.exit(1)
}

console.log(`OK  ${passed} checks passed`)
