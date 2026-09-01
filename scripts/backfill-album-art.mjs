#!/usr/bin/env node
/**
 * Backfill empty albumArt on the R2 catalog (and D1 if seeded).
 *
 *   node scripts/backfill-album-art.mjs
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = process.cwd()
const BUCKET = 'songguessr'
const R2_KEY = 'catalog/catalog.json'
const MARKET = 'PH'
const BATCH = 50
const LOCAL_CATALOG = resolve(ROOT, 'catalog-prod-check.json')
const ENV_PATH = resolve(ROOT, '.env.local')

function loadDotEnv(path) {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim()
    if (key && process.env[key] === undefined) process.env[key] = value
  }
}

function runWrangler(args, options = {}) {
  console.log(`$ npx wrangler ${args.join(' ')}`)
  return execFileSync('npx', ['wrangler', ...args], {
    cwd: ROOT,
    shell: process.platform === 'win32',
    encoding: 'utf8',
    stdio: options.stdio ?? 'inherit',
  })
}

function upgradeItunesArtwork(url) {
  return url.replace(/\d+x\d+bb/g, '600x600bb').replace(/\/\d+x\d+(?=[^/]*$)/, '/600x600')
}

function normalize(value) {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function fetchSpotifyOembedArtwork(trackId) {
  if (!trackId) return ''
  try {
    const url = `https://open.spotify.com/oembed?url=${encodeURIComponent(
      `https://open.spotify.com/track/${trackId}`,
    )}`
    const response = await fetch(url)
    if (!response.ok) return ''
    const data = await response.json()
    const thumb = data.thumbnail_url?.trim()
    if (!thumb) return ''
    return thumb.replace('ab67616d00001e02', 'ab67616d0000b273')
  } catch {
    return ''
  }
}

async function fetchItunesArtwork(title, artist) {
  const term = `${artist} ${title}`.trim()
  if (!term) return ''
  const url = new URL('https://itunes.apple.com/search')
  url.searchParams.set('term', term)
  url.searchParams.set('entity', 'song')
  url.searchParams.set('country', MARKET)
  url.searchParams.set('limit', '5')

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'application/json',
      },
    })
    if (!response.ok) return ''
    const data = await response.json()
    const results = data.results ?? []
    const targetTitle = normalize(title)
    const targetArtist = normalize(artist)
    for (const result of results) {
      const resultTitle = normalize(result.trackName ?? '')
      const resultArtist = normalize(result.artistName ?? '')
      const titleOk =
        resultTitle &&
        targetTitle &&
        (resultTitle === targetTitle || resultTitle.includes(targetTitle) || targetTitle.includes(resultTitle))
      const artistOk =
        resultArtist &&
        targetArtist &&
        (resultArtist.includes(targetArtist.split(' ')[0] ?? '') ||
          targetArtist.includes(resultArtist.split(' ')[0] ?? ''))
      if (titleOk && artistOk && result.artworkUrl100) {
        return upgradeItunesArtwork(result.artworkUrl100)
      }
    }
    return results[0]?.artworkUrl100 ? upgradeItunesArtwork(results[0].artworkUrl100) : ''
  } catch {
    return ''
  }
}

async function getToken(clientId, clientSecret) {
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'client_credentials' }),
  })
  if (!response.ok) {
    throw new Error(`Spotify auth failed: ${response.status} ${await response.text()}`)
  }
  const data = await response.json()
  return data.access_token
}

async function spotifyGet(token, path, params = {}) {
  const url = new URL(`https://api.spotify.com/v1/${path}`)
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value))
  }
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!response.ok) {
    const error = new Error(`Spotify GET ${path} failed: ${response.status}`)
    error.status = response.status
    throw error
  }
  return response.json()
}

function albumArtFromTrack(track) {
  for (const image of track?.album?.images ?? []) {
    if (image?.url) return image.url
  }
  return ''
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function hydrateIds(token, ids) {
  const byId = new Map()
  const retryIds = []

  for (let index = 0; index < ids.length; index += BATCH) {
    const batch = ids.slice(index, index + BATCH)
    try {
      const data = await spotifyGet(token, 'tracks', { ids: batch.join(','), market: MARKET })
      const found = new Set()
      for (const track of data.tracks ?? []) {
        if (track?.id) {
          byId.set(track.id, track)
          found.add(track.id)
        }
      }
      for (const id of batch) {
        if (!found.has(id)) retryIds.push(id)
      }
    } catch (error) {
      if (error.status === 403 || error.status === 404 || error.status === 429) {
        console.warn(`Batch /tracks?ids= blocked (${error.status}); trying one by one`)
        retryIds.push(...batch)
        continue
      }
      throw error
    }
  }

  for (const id of retryIds) {
    try {
      const track = await spotifyGet(token, `tracks/${id}`, { market: MARKET })
      if (track?.id) byId.set(track.id, track)
      await sleep(200)
    } catch (error) {
      if (error.status === 429) {
        console.warn('GET /tracks/{id} rate limited; remaining IDs use iTunes fallback')
        break
      }
      if (error.status === 403 || error.status === 404) {
        console.warn(`GET /tracks/${id} blocked (${error.status})`)
        continue
      }
      throw error
    }
  }

  return byId
}

function loadCatalog() {
  if (existsSync(LOCAL_CATALOG)) {
    return JSON.parse(readFileSync(LOCAL_CATALOG, 'utf8'))
  }
  runWrangler(['r2', 'object', 'get', `${BUCKET}/${R2_KEY}`, '--remote', '--file', LOCAL_CATALOG])
  return JSON.parse(readFileSync(LOCAL_CATALOG, 'utf8'))
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`
}

async function main() {
  loadDotEnv(ENV_PATH)
  const clientId = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET are required')
  }

  const catalog = loadCatalog()
  const missing = (catalog.tracks ?? []).filter((track) => track.id && !track.albumArt)
  console.log(`Catalog tracks: ${catalog.tracks?.length ?? 0}`)
  console.log(`Missing albumArt: ${missing.length}`)
  if (missing.length === 0) {
    console.log('Nothing to backfill')
    return
  }

  const token = await getToken(clientId, clientSecret)
  const hydrated = await hydrateIds(
    token,
    missing.map((track) => track.id),
  )

  let backfilled = 0
  let itunesFilled = 0
  let oembedFilled = 0
  const patches = []

  for (const track of missing) {
    let albumArt = albumArtFromTrack(hydrated.get(track.id))
    if (!albumArt) {
      albumArt = await fetchSpotifyOembedArtwork(track.id)
      if (albumArt) oembedFilled += 1
      await sleep(80)
    }
    if (!albumArt) {
      albumArt = await fetchItunesArtwork(track.title ?? '', track.artist ?? '')
      if (albumArt) itunesFilled += 1
      await sleep(80)
    }
    if (!albumArt) continue
    track.albumArt = albumArt
    patches.push({ id: track.id, albumArt })
    backfilled += 1
  }

  catalog.updatedAt = new Date().toISOString()
  writeFileSync(LOCAL_CATALOG, `${JSON.stringify(catalog)}\n`, 'utf8')
  runWrangler([
    'r2',
    'object',
    'put',
    `${BUCKET}/${R2_KEY}`,
    '--file',
    LOCAL_CATALOG,
    '--remote',
    '--content-type',
    'application/json',
  ])

  const stillMissing = (catalog.tracks ?? []).filter((track) => !track.albumArt).length
  console.log(
    `Backfilled: ${backfilled} (oEmbed: ${oembedFilled}, iTunes: ${itunesFilled})`,
  )
  console.log(`Still missing: ${stillMissing}`)

  if (patches.length === 0) return

  const sqlPath = resolve(ROOT, 'backfill-album-art.sql')
  const statements = patches.map(
    (patch) =>
      `UPDATE tracks SET album_art = ${sqlString(patch.albumArt)}, updated_at = ${sqlString(catalog.updatedAt)} WHERE id = ${sqlString(patch.id)} AND (album_art IS NULL OR album_art = '');`,
  )
  writeFileSync(sqlPath, `${statements.join('\n')}\n`, 'utf8')
  try {
    runWrangler(['d1', 'execute', 'songguessr', '--remote', '--file', sqlPath, '--yes'])
    console.log('Wrote album art to D1')
  } catch (error) {
    console.warn(`D1 update skipped: ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    if (existsSync(sqlPath)) unlinkSync(sqlPath)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
