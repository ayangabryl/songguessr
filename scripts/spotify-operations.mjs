#!/usr/bin/env node
/**
 * Re-harvests Spotify's pathfinder persisted-query hashes from the live web
 * player, and verifies the search operations still work with an anonymous
 * embed token.
 *
 * Run this when `worker/spotify-public-stats.ts` starts returning nothing:
 * Spotify rotates these hashes whenever it ships a new player build, and the
 * gateway rejects raw GraphQL documents ("Missing extensions in the request"),
 * so the hash cannot be avoided or guessed.
 *
 * How the hashes are found: the player registers persisted queries as
 * positional constructor calls — new X("searchTracks","query","<sha256>",null)
 * — inside lazily-loaded webpack chunks named `${chunkName || chunkId}.${hash}.js`,
 * and both the name map and the hash map live in the entry bundle's
 * `u.u = e => ...` chunk-URL template.
 *
 * Every operation found is written to tmp-spotify-operations.json.
 *
 * Usage: node scripts/spotify-operations.mjs [searchTerm]
 */

import { writeFile } from 'node:fs/promises'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
const CDN = 'https://open.spotifycdn.com/cdn/build/web-player/'
const QUERY = process.argv[2] ?? 'multo'

async function text(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA } })
    return res.ok ? await res.text() : null
  } catch {
    return null
  }
}

async function anonToken() {
  const html = await text('https://open.spotify.com/embed/track/4yzDFThA5Xd1s9aZzwyxCk')
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
  return JSON.parse(m[1]).props.pageProps.state.settings.session.accessToken
}

async function entryBundleUrl() {
  const html = await text(`https://open.spotify.com/search/${encodeURIComponent(QUERY)}`)
  const m = html?.match(/https:\/\/open\.spotifycdn\.com\/cdn\/build\/web-player\/web-player\.[0-9a-f]+\.js/)
  return m?.[0] ?? `${CDN}web-player.c2d8ecd0.js`
}

/** Parse `{1328:"xpui-pip-mini-player",...}` style maps out of the u.u template. */
function parseMap(segment) {
  const map = new Map()
  for (const m of segment.matchAll(/(\d{1,5}):"([^"]+)"/g)) map.set(m[1], m[2])
  return map
}

function chunkFilenames(entry) {
  const start = entry.indexOf('.u=e=>')
  if (start < 0) return []
  const template = entry.slice(start, start + 12000)
  // template: ""+(({names})[e]||e)+"."+({hashes})[e]+".js"
  const objects = [...template.matchAll(/\{(?:\d{1,5}:"[^"]+",){3,}\d{1,5}:"[^"]+"\}/g)].map((m) => m[0])
  if (objects.length < 2) return []
  const names = parseMap(objects[0])
  const hashes = parseMap(objects[1])
  const files = []
  for (const [id, hash] of hashes) files.push(`${names.get(id) ?? id}.${hash}.js`)
  return files
}

/** new X("operationName","query","<64hex>",null) */
function extractOperations(source, into) {
  for (const m of source.matchAll(/"([A-Za-z][A-Za-z0-9_]{2,60})"\s*,\s*"(?:query|mutation|subscription)"\s*,\s*"([0-9a-f]{64})"/g)) {
    if (!into.has(m[1])) into.set(m[1], m[2])
  }
}

async function pathfinder(token, operationName, variables, sha256Hash) {
  const res = await fetch('https://api-partner.spotify.com/pathfinder/v1/query', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': UA,
      Origin: 'https://open.spotify.com',
      Referer: 'https://open.spotify.com/',
      'App-Platform': 'WebPlayer',
    },
    body: JSON.stringify({
      operationName,
      variables,
      extensions: { persistedQuery: { version: 1, sha256Hash } },
    }),
  })
  return { status: res.status, text: await res.text() }
}

function variablesFor(name) {
  if (/^searchTracks$/i.test(name)) {
    return { searchTerm: QUERY, offset: 0, limit: 20, numberOfTopResults: 5, includeAudiobooks: true }
  }
  return {
    searchTerm: QUERY,
    offset: 0,
    limit: 10,
    numberOfTopResults: 5,
    includeAudiobooks: true,
    includeArtistHasConcertsField: false,
    includePreReleases: true,
    includeLocalConcertsField: false,
    includeAuthors: false,
  }
}

const main = async () => {
  const token = await anonToken()
  const entryUrl = await entryBundleUrl()
  const entry = await text(entryUrl)
  console.log('entry:', entryUrl, '| bytes:', entry.length)

  const files = chunkFilenames(entry)
  console.log('chunks resolved from u.u template:', files.length)
  const searchChunk = files.find((f) => f.startsWith('xpui-routes-search.'))
  console.log('search chunk:', searchChunk ?? 'NOT FOUND')

  const operations = new Map()
  extractOperations(entry, operations)

  let ok = 0
  let missing = 0
  for (let i = 0; i < files.length; i += 16) {
    const batch = files.slice(i, i + 16)
    const sources = await Promise.all(batch.map((f) => text(CDN + f)))
    for (const source of sources) {
      if (!source) {
        missing += 1
        continue
      }
      ok += 1
      extractOperations(source, operations)
    }
    process.stdout.write(`  ${Math.min(i + 16, files.length)}/${files.length} ok=${ok} 404=${missing}\r`)
  }
  console.log(`\ndownloaded ${ok} chunks (${missing} missing) | operations harvested: ${operations.size}`)
  await writeFile('tmp-spotify-operations.json', JSON.stringify(Object.fromEntries([...operations].sort()), null, 2))

  const searchOps = [...operations.entries()].filter(([n]) => /search/i.test(n))
  console.log('\nsearch operations discovered:')
  for (const [n, h] of searchOps) console.log(' ', n, h)
  if (searchOps.length === 0) return

  console.log('\n--- calling each with the anonymous embed token ---')
  for (const [name, hash] of searchOps) {
    const out = await pathfinder(token, name, variablesFor(name), hash)
    let tracks = 0
    let note = ''
    try {
      const json = JSON.parse(out.text)
      tracks = (JSON.stringify(json).match(/"__typename":"Track"/g) ?? []).length
      if (json.errors) note = `errors: ${JSON.stringify(json.errors).slice(0, 160)}`
    } catch {
      note = out.text.slice(0, 140)
    }
    console.log(`${tracks > 0 ? 'PASS' : 'FAIL'}  ${name} status=${out.status} trackNodes=${tracks} ${note}`)
    if (tracks > 0) {
      console.log('  *** USABLE ***', name, hash)
      await writeFile('tmp-search-response.json', out.text)
      const json = JSON.parse(out.text)
      const items = json.data?.searchV2?.tracksV2?.items ?? []
      console.log('  tracksV2 items:', items.length, '| totalCount:', json.data?.searchV2?.tracksV2?.totalCount)
      for (const item of items.slice(0, 6)) {
        const t = item?.item?.data
        if (!t) continue
        console.log(
          '   -', t.uri, '|', t.name, '|',
          (t.artists?.items ?? []).map((a) => a.profile?.name).join(', '),
          '| plays:', t.playcount ?? 'n/a',
          '| album:', t.albumOfTrack?.name ?? 'n/a',
        )
      }
    }
  }
}

main().catch((err) => {
  console.error('FATAL', err)
  process.exit(1)
})
