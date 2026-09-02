#!/usr/bin/env node
/**
 * Post-deploy smoke check: admin login, public-backed Spotify search, catalog
 * page shape, and the public game API.
 *
 * Usage: node scripts/smoke-admin.mjs [searchTerm]
 */

const ADMIN_BASE = process.env.ADMIN_BASE ?? 'https://admin.songguessr.lol'
const GAME_BASE = process.env.GAME_BASE ?? 'https://songguessr.lol'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'wizard123'
const TERM = process.argv[2] ?? 'multo'

let failures = 0
function check(label, ok, detail = '') {
  if (!ok) failures += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
}

const main = async () => {
  const login = await fetch(`${ADMIN_BASE}/admin/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: ADMIN_PASSWORD }),
  })
  check('admin login', login.ok, `HTTP ${login.status}`)
  const cookie = (login.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ')

  const status = await fetch(`${ADMIN_BASE}/admin/api/status`, { headers: { Cookie: cookie } })
  const statusJson = await status.json()
  check('admin status', status.ok, `HTTP ${status.status}`)
  console.log(
    `      tracks with plays ${statusJson.playCountFilled} | missing ${statusJson.playCountMissing} | never stamped ${statusJson.playCountStale}`,
  )

  const search = await fetch(
    `${ADMIN_BASE}/admin/api/spotify/search?q=${encodeURIComponent(TERM)}`,
    { headers: { Cookie: cookie } },
  )
  const searchJson = await search.json()
  const results = searchJson.results ?? []
  check('spotify search returns results', search.ok && results.length > 0, `${results.length} results`)
  check('search used the public web player', searchJson.source === 'web-player', `source=${searchJson.source}`)
  if (searchJson.warnings?.length) console.log('      warnings:', searchJson.warnings.join(' | '))
  for (const row of results.slice(0, 5)) {
    console.log(`      - ${row.title} — ${row.artist}${row.inCatalog ? ' [in catalog]' : ''}`)
  }

  const catalog = await fetch(`${ADMIN_BASE}/admin/api/catalog?page=1&pageSize=3`, {
    headers: { Cookie: cookie },
  })
  const catalogJson = await catalog.json()
  const first = catalogJson.tracks?.[0]
  check('catalog page loads', catalog.ok && Boolean(first), `HTTP ${catalog.status}`)
  check(
    'catalog rows carry play counts',
    Boolean(first?.playCount) && Boolean(first?.playCountUpdatedAt),
    first ? `${first.title}: ${first.playCount} plays, stamped ${first.playCountUpdatedAt}` : 'no rows',
  )

  const adminHtml = await fetch(`${ADMIN_BASE}/`)
  check('admin SPA serves', adminHtml.ok, `HTTP ${adminHtml.status}`)

  const gameHtml = await fetch(`${GAME_BASE}/`)
  check('game site serves', gameHtml.ok, `HTTP ${gameHtml.status}`)

  const health = await fetch(`${GAME_BASE}/api/health`)
  check('game health API', health.ok, `HTTP ${health.status}`)

  const random = await fetch(`${GAME_BASE}/api/random?difficulty=easy`)
  const randomJson = await random.json().catch(() => null)
  check(
    'game random track API',
    random.ok && Boolean(randomJson),
    randomJson?.title ? `${randomJson.title} — ${randomJson.artist}` : `HTTP ${random.status}`,
  )

  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error('FATAL', err)
  process.exit(1)
})
