#!/usr/bin/env node
/**
 * Play-count / release-date backfill driver for the Songguessr catalog.
 *
 * Runs the real worker code path (`POST /admin/api/catalog/playcounts`) in a
 * resumable loop, so the numbers written to D1 come from the same enrichment
 * the cron uses rather than a parallel implementation that could drift.
 *
 * Usage:
 *   node scripts/spotify-playcounts.mjs                  backfill until complete
 *   node scripts/spotify-playcounts.mjs --limit 40       tracks per request
 *   node scripts/spotify-playcounts.mjs --rounds 5       cap the number of calls
 *   node scripts/spotify-playcounts.mjs --playlist <id>  report a playlist's
 *                                                        play-count distribution
 *
 * Env:
 *   ADMIN_BASE      default https://admin.songguessr.lol
 *   ADMIN_PASSWORD  default wizard123 (matches wrangler.jsonc vars)
 */

const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const index = args.indexOf(`--${name}`)
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback
}

const ADMIN_BASE = process.env.ADMIN_BASE ?? 'https://admin.songguessr.lol'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'wizard123'
const LIMIT = Number(flag('limit', '40'))
const MAX_ROUNDS = Number(flag('rounds', '40'))
const PLAYLIST = flag('playlist', null)

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
const FETCH_PLAYLIST_HASH = 'b39f62e9b566aa849b1780927de1450f47e02c54abf1e66e513f96e849591e41'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/* ---------------------------------------------------------------- playlist -- */

async function anonToken() {
  const res = await fetch('https://open.spotify.com/embed/track/4yzDFThA5Xd1s9aZzwyxCk', {
    headers: { 'User-Agent': UA, Accept: 'text/html' },
  })
  const html = await res.text()
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
  if (!m) throw new Error('embed page carried no __NEXT_DATA__')
  return JSON.parse(m[1]).props.pageProps.state.settings.session.accessToken
}

/** One request returns the whole playlist with play counts attached. */
async function reportPlaylist(playlistId) {
  const token = await anonToken()
  const res = await fetch('https://api-partner.spotify.com/pathfinder/v1/query', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': UA,
      Origin: 'https://open.spotify.com',
      Referer: 'https://open.spotify.com/',
    },
    body: JSON.stringify({
      operationName: 'fetchPlaylist',
      variables: { uri: `spotify:playlist:${playlistId}`, offset: 0, limit: 100 },
      extensions: { persistedQuery: { version: 1, sha256Hash: FETCH_PLAYLIST_HASH } },
    }),
  })
  if (!res.ok) throw new Error(`fetchPlaylist ${res.status}`)
  const json = await res.json()
  const playlist = json?.data?.playlistV2

  const rows = []
  for (const item of playlist?.content?.items ?? []) {
    const track = item?.itemV2?.data
    if (!track) continue
    rows.push({
      name: track.name,
      artist: (track.artists?.items ?? []).map((a) => a.profile?.name).filter(Boolean).join(', '),
      plays: Number(track.playcount ?? 0),
    })
  }
  rows.sort((a, b) => b.plays - a.plays)

  // Mirrors PLAY_COUNT_TIERS in worker/difficulty.ts.
  const tierOf = (plays) =>
    plays >= 100_000_000 ? 'easy'
    : plays >= 500_000 ? 'medium'
    : plays >= 100_000 ? 'hard'
    : plays >= 10_000 ? 'expert'
    : 'impossible'

  console.log(`${playlist?.name} — ${rows.length} tracks\n`)
  console.log('rank        plays  tier      title — artist')
  rows.forEach((r, i) => {
    console.log(
      `${String(i + 1).padStart(4)} ${String(r.plays).padStart(12)}  ${tierOf(r.plays).padEnd(9)} ${r.name} — ${r.artist}`,
    )
  })

  const counts = {}
  for (const r of rows) counts[tierOf(r.plays)] = (counts[tierOf(r.plays)] ?? 0) + 1
  console.log('\ntier counts:', JSON.stringify(counts))
  const bad = rows.filter((r) => !['easy', 'medium'].includes(tierOf(r.plays)))
  console.log(
    bad.length === 0
      ? 'OK: every track on this playlist lands easy or medium.'
      : `WARNING: ${bad.length} track(s) fall below medium: ${bad.map((b) => b.name).join(', ')}`,
  )
}

/* ---------------------------------------------------------------- backfill -- */

async function login() {
  const res = await fetch(`${ADMIN_BASE}/admin/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: ADMIN_PASSWORD }),
  })
  if (!res.ok) throw new Error(`login failed: ${res.status} ${await res.text()}`)
  const cookie = res.headers.getSetCookie?.() ?? []
  const session = cookie.map((c) => c.split(';')[0]).join('; ')
  if (!session) throw new Error('login returned no session cookie')
  return session
}

async function backfill() {
  const cookie = await login()
  console.log(`admin: ${ADMIN_BASE} | limit ${LIMIT}/round | max ${MAX_ROUNDS} rounds\n`)

  let totalPlays = 0
  let totalDates = 0
  for (let round = 1; round <= MAX_ROUNDS; round += 1) {
    const res = await fetch(`${ADMIN_BASE}/admin/api/catalog/playcounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ limit: LIMIT }),
    })
    const text = await res.text()
    if (!res.ok) {
      console.error(`round ${round}: HTTP ${res.status} ${text.slice(0, 300)}`)
      break
    }
    const json = JSON.parse(text)
    totalPlays += json.playCountFilled ?? 0
    totalDates += json.releaseDateFilled ?? 0
    const cov = json.coverage ?? {}
    console.log(
      `round ${String(round).padStart(2)}: scanned ${String(json.scanned).padStart(3)} | ` +
        `+${String(json.playCountFilled).padStart(3)} plays | +${String(json.popularityFilled ?? 0).padStart(3)} pop | ` +
        `+${String(json.releaseDateFilled).padStart(3)} dates | ` +
        `missing plays ${cov.playCountMissing ?? '?'} | missing pop ${cov.popularityMissing ?? '?'}`,
    )
    if (json.errors?.length) console.log('   errors:', json.errors.slice(0, 2).join(' | '))

    if (json.scanned === 0) {
      console.log('\nnothing left to enrich.')
      break
    }
    if (
      (cov.playCountMissing ?? 0) === 0 &&
      (cov.popularityMissing ?? 0) === 0 &&
      (cov.playCountStale ?? 0) === 0
    ) {
      console.log('\ncoverage complete: plays, popularity, and timestamps all present.')
      break
    }
    if (json.rateLimited) {
      console.log('   rate limited; backing off 10s')
      await sleep(10_000)
    } else {
      await sleep(500)
    }
  }

  console.log(`\ntotal filled this run: ${totalPlays} play counts, ${totalDates} release dates`)

  const status = await fetch(`${ADMIN_BASE}/admin/api/status`, { headers: { Cookie: cookie } })
  if (status.ok) {
    const json = await status.json()
    console.log(
      `catalog: ${json.playCountFilled} with plays | ${json.playCountMissing} without | ` +
        `${json.playCountStale ?? '?'} never stamped | ${json.releaseDateFilled} with release dates`,
    )
  }
}

const main = async () => {
  if (PLAYLIST) return reportPlaylist(PLAYLIST)
  return backfill()
}

main().catch((err) => {
  console.error('FATAL', err)
  process.exit(1)
})
