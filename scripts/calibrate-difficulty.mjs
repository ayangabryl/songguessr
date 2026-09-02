#!/usr/bin/env node
/**
 * Difficulty calibration harness.
 *
 * Pulls the real scoring columns out of D1 and replays candidate tier rules
 * over them, so thresholds can be tuned against the actual catalog instead of
 * through deploy-and-look cycles. Also replays the Top 50 Philippines playlist,
 * which must land entirely in easy/medium.
 *
 * Keep the rules here in sync with worker/difficulty.ts when tuning; this is a
 * scratchpad for choosing numbers, not the source of truth.
 *
 * Usage: node scripts/calibrate-difficulty.mjs
 */

import { execFileSync } from 'node:child_process'

const CURRENT_YEAR = new Date().getUTCFullYear()
const TIERS = ['easy', 'medium', 'hard', 'expert', 'impossible']

// The SQL must be quoted explicitly: with shell:true the shell is cmd.exe,
// which otherwise splits a multi-column SELECT on its commas.
function d1(sql) {
  const out = execFileSync(
    'npx',
    ['wrangler', 'd1', 'execute', 'songguessr', '--remote', '--command', `"${sql}"`, '--json'],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, shell: true },
  )
  // wrangler prints progress lines before the JSON, and those lines can contain
  // brackets, so try each candidate start until one parses.
  for (let index = out.indexOf('['); index !== -1; index = out.indexOf('[', index + 1)) {
    try {
      const parsed = JSON.parse(out.slice(index))
      if (Array.isArray(parsed) && parsed[0]?.results) return parsed[0].results
    } catch {
      continue
    }
  }
  throw new Error(`could not parse wrangler output:\n${out.slice(0, 500)}`)
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

function baseFromPlays(plays) {
  if (plays == null || plays <= 0) return undefined
  if (plays >= 100_000_000) return 'easy'
  if (plays >= 500_000) return 'medium'
  if (plays >= 100_000) return 'hard'
  if (plays >= 10_000) return 'expert'
  return 'impossible'
}

function velocity(plays, year) {
  if (plays == null || plays <= 0 || !year) return undefined
  return plays / Math.max(1, CURRENT_YEAR - year + 1)
}

/** @param rules {{easyPop:number, promoPop:number, demotePop:number, artistPop:number, fastVelocity:number, slowVelocity:number, maxPromote:number}} */
function assign(row, rules) {
  const track = row.popularity == null ? undefined : clamp(row.popularity, 0, 100)
  const artist = row.artist_popularity == null ? undefined : clamp(row.artist_popularity, 0, 100)

  if (track != null && (track >= rules.easyPop || (track >= 60 && (artist ?? 0) >= 70))) return 'easy'

  const base = baseFromPlays(row.play_count)
  if (!base) return 'impossible'

  let steps = 0
  if (track != null) {
    if (track >= rules.promoPop) steps += 1
    else if (track <= rules.demotePop) steps -= 1
  }
  // A famous artist only lifts a song when the song itself has some heat;
  // otherwise every album filler by a big act would read as easy.
  if ((artist ?? 0) >= rules.artistPop && (track ?? 0) >= rules.artistGatePop) steps += 1
  const v = velocity(row.play_count, row.release_year)
  if (v != null) {
    if (v >= rules.fastVelocity) steps += 1
    else if (v < rules.slowVelocity) steps -= 1
  }

  const index = TIERS.indexOf(base)
  return TIERS[clamp(index - clamp(steps, -1, rules.maxPromote), 0, TIERS.length - 1)]
}

function distribution(rows, rules) {
  const counts = Object.fromEntries(TIERS.map((t) => [t, 0]))
  for (const row of rows) counts[assign(row, rules)] += 1
  return counts
}

const show = (label, counts, total) =>
  console.log(
    `${label.padEnd(28)} ` +
      TIERS.map((t) => `${t} ${String(counts[t]).padStart(3)} (${String(Math.round((counts[t] / total) * 100)).padStart(2)}%)`).join('  '),
  )

console.log('loading catalog rows from D1...')
const rows = d1(
  'SELECT id, title, artist, play_count, popularity, artist_popularity, release_year FROM tracks',
)
console.log(`${rows.length} tracks\n`)

const candidates = {
  'current (deployed)': { easyPop: 72, promoPop: 55, demotePop: 15, artistPop: 75, artistGatePop: 0, fastVelocity: 20_000_000, slowVelocity: 25_000, maxPromote: 2 },
  'tighter promote': { easyPop: 72, promoPop: 70, demotePop: 15, artistPop: 80, artistGatePop: 0, fastVelocity: 20_000_000, slowVelocity: 25_000, maxPromote: 1 },
  'artist-gated': { easyPop: 72, promoPop: 70, demotePop: 15, artistPop: 80, artistGatePop: 55, fastVelocity: 20_000_000, slowVelocity: 25_000, maxPromote: 1 },
  'strict': { easyPop: 75, promoPop: 72, demotePop: 20, artistPop: 85, artistGatePop: 60, fastVelocity: 25_000_000, slowVelocity: 30_000, maxPromote: 1 },
}

for (const [label, rules] of Object.entries(candidates)) {
  show(label, distribution(rows, rules), rows.length)
}

console.log('\n--- easy tracks with the fewest plays, per candidate ---')
for (const [label, rules] of Object.entries(candidates)) {
  const easy = rows
    .filter((r) => assign(r, rules) === 'easy')
    .sort((a, b) => (a.play_count ?? 0) - (b.play_count ?? 0))
    .slice(0, 3)
  console.log(
    `${label.padEnd(28)} ` +
      easy.map((r) => `${r.title} (${(r.play_count ?? 0).toLocaleString()} plays, pop ${r.popularity})`).join(' | '),
  )
}

// The acceptance target: every track on Spotify's Top 50 Philippines chart
// must come out easy or medium, whether or not it is already in the catalog.
const TOP_50 = '37i9dQZEVXbNBz9cRCSFkY'
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
const B62 = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
const toGid = (id) => {
  let v = 0n
  for (const ch of id) v = v * 62n + BigInt(B62.indexOf(ch))
  return v.toString(16).padStart(32, '0')
}

async function anonToken() {
  const res = await fetch('https://open.spotify.com/embed/track/4yzDFThA5Xd1s9aZzwyxCk', {
    headers: { 'User-Agent': UA, Accept: 'text/html' },
  })
  const html = await res.text()
  return JSON.parse(html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)[1]).props
    .pageProps.state.settings.session.accessToken
}

async function spclient(kind, id, token) {
  const res = await fetch(
    `https://spclient.wg.spotify.com/metadata/4/${kind}/${toGid(id)}${kind === 'track' ? '?market=from_token' : ''}`,
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'User-Agent': UA } },
  )
  return res.ok ? res.json() : null
}

console.log('\n--- Top 50 Philippines acceptance check ---')
const token = await anonToken()
const playlistRes = await fetch('https://api-partner.spotify.com/pathfinder/v1/query', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'User-Agent': UA,
  },
  body: JSON.stringify({
    operationName: 'fetchPlaylist',
    variables: { uri: `spotify:playlist:${TOP_50}`, offset: 0, limit: 50 },
    extensions: {
      persistedQuery: {
        version: 1,
        sha256Hash: 'b39f62e9b566aa849b1780927de1450f47e02c54abf1e66e513f96e849591e41',
      },
    },
  }),
})
const playlist = await playlistRes.json()
const items = playlist.data?.playlistV2?.content?.items ?? []
const chart = []
for (const entry of items) {
  const node = entry?.itemV2?.data
  const id = node?.uri?.split(':').pop()
  if (!id || !node?.playcount) continue
  const meta = await spclient('track', id, token)
  const artistGid = meta?.artist?.[0]?.gid
  const artistMeta = artistGid
    ? await fetch(`https://spclient.wg.spotify.com/metadata/4/artist/${artistGid}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'User-Agent': UA },
      }).then((r) => (r.ok ? r.json() : null))
    : null
  chart.push({
    title: node.name,
    play_count: Number(node.playcount),
    popularity: meta?.popularity ?? null,
    artist_popularity: artistMeta?.popularity ?? null,
    release_year: node.albumOfTrack?.date?.year ?? meta?.album?.date?.year ?? null,
  })
}
console.log(`${chart.length} chart tracks resolved`)
for (const [label, rules] of Object.entries(candidates)) {
  const counts = distribution(chart, rules)
  const bad = chart.filter((r) => !['easy', 'medium'].includes(assign(r, rules)))
  show(label, counts, chart.length)
  if (bad.length) {
    console.log(
      `${''.padEnd(28)} FAIL -> ${bad.map((r) => `${r.title} (${r.play_count.toLocaleString()}, pop ${r.popularity})`).join(', ')}`,
    )
  }
}
