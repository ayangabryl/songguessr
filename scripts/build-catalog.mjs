import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  artistNameScore,
  isOpmSpotifyTrack,
  UNIQUE_OPM_ARTISTS,
} from './opm-artists.mjs'
import { resolvePreviewSourcesForTrack } from './preview-sources.mjs'
import { dedupeTracks } from './track-dedupe.mjs'

const MARKET = 'PH'
const SEARCH_PAGE_SIZE = 10
const MAX_SEARCH_OFFSET = 950
const MAX_PAGES_PER_ARTIST = 25
const MAX_ALBUMS_PER_ARTIST = 15
const MAX_TRACKS_PER_ALBUM = 30
const ALBUM_PAGE_SIZE = 10
const API_DELAY_MS = 750
const RATE_LIMIT_BASE_DELAY_SECONDS = 2
const RATE_LIMIT_MAX_BACKOFF_SECONDS = 300
const TRANSIENT_ERROR_MAX_ATTEMPTS = 8

function loadEnvFile() {
  const envPath = resolve(process.cwd(), '.env.local')
  try {
    const content = readFileSync(envPath, 'utf8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
      if (!process.env[key]) process.env[key] = value
    }
  } catch {
    // .env.local optional until user fills it in
  }
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms))
}

let lastRequestAt = 0
let consecutiveRateLimits = 0
let currentArtistName = null

async function throttle() {
  const elapsed = Date.now() - lastRequestAt
  if (elapsed < API_DELAY_MS) {
    await sleep(API_DELAY_MS - elapsed)
  }
  lastRequestAt = Date.now()
}

function assignDifficulty(popularity, index) {
  if (popularity >= 70) return 'easy'
  if (popularity >= 55) return 'medium'
  if (popularity >= 40) return 'hard'
  if (popularity >= 25) return 'expert'
  if (popularity > 0) return 'impossible'

  const levels = ['easy', 'medium', 'hard', 'expert', 'impossible']
  return levels[index % levels.length]
}

function inferGenreGroups(artist, title) {
  const haystack = `${artist} ${title}`.toLowerCase()
  const groups = []
  if (/hip.?hop|rap|trap|skusta|flow g|hellmerry|brando|gloc-9|loonie|abra/i.test(haystack)) {
    groups.push('hip-hop')
  }
  if (/r&b|soul|moira|regine|gary valenciano|martin nievera|jona|morissette|kyla|jay r/i.test(haystack)) {
    groups.push('r&b')
  }
  if (/rock|eraserheads|rivermaya|parokya|itchyworms|silent sanctuary|chicosci|hale|up dharma|kamikazee|bamboo|franco|sponge cola/i.test(haystack)) {
    groups.push('rock')
  }
  if (/dance|electro|house|edm|remix|dj/i.test(haystack)) groups.push('dance')
  if (/sb19|bini|p-pop|ben&ben|cup of joe|zack tabudlo|arthur nery|juan karlos|lola amour|hev abi|sarah geronimo|december avenue|bgyo|alamat/i.test(haystack)) {
    groups.push('pop')
  }
  return groups.length > 0 ? groups : ['other']
}

function parseReleaseYear(releaseDate) {
  if (!releaseDate) return undefined
  const year = Number.parseInt(String(releaseDate).slice(0, 4), 10)
  return Number.isInteger(year) ? year : undefined
}

function addTrack(trackMap, track, previews, index) {
  const { previewUrl, hookPreviewUrl, hookStartSeconds } = previews
  if (!track?.id || !previewUrl) return false
  if (!isOpmSpotifyTrack(track)) return false
  if (trackMap.has(track.id)) return false

  trackMap.set(track.id, {
    id: track.id,
    title: track.name,
    artist: track.artists.map((artist) => artist.name).join(', '),
    previewUrl,
    ...(hookPreviewUrl ? { hookPreviewUrl } : {}),
    hookStartSeconds,
    albumArt: track.album?.images?.[0]?.url ?? '',
    difficulty: assignDifficulty(track.popularity ?? 0, index),
    releaseYear: parseReleaseYear(track.album?.release_date),
    genreGroups: inferGenreGroups(
      track.artists.map((artist) => artist.name).join(', '),
      track.name,
    ),
  })
  return true
}

async function getSpotifyToken(clientId, clientSecret) {
  const body = new URLSearchParams({ grant_type: 'client_credentials' })
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })

  if (!response.ok) {
    throw new Error(`Spotify auth failed: ${response.status} ${await response.text()}`)
  }

  const data = await response.json()
  return data.access_token
}

function parseRetryAfterSeconds(response, rateLimitAttempt) {
  const header = response.headers.get('retry-after')
  if (header) {
    const seconds = Number(header)
    if (Number.isFinite(seconds) && seconds > 0) return seconds
  }
  return Math.min(
    RATE_LIMIT_MAX_BACKOFF_SECONDS,
    RATE_LIMIT_BASE_DELAY_SECONDS * (2 ** rateLimitAttempt),
  )
}

async function spotifyGet(token, path, params = {}, rateLimitAttempt = 0, transientAttempt = 0) {
  await throttle()

  const url = new URL(`https://api.spotify.com/v1/${path}`)
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value))
    }
  }

  let response
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch (error) {
    if (transientAttempt < TRANSIENT_ERROR_MAX_ATTEMPTS) {
      const waitSeconds = Math.min(60, 2 ** transientAttempt)
      console.warn(
        `Network error on ${path}, retrying in ${waitSeconds}s... (${error instanceof Error ? error.message : error})`,
      )
      await sleep(waitSeconds * 1000)
      return spotifyGet(token, path, params, rateLimitAttempt, transientAttempt + 1)
    }
    throw error
  }

  if (response.status === 429) {
    const retryAfterSeconds = parseRetryAfterSeconds(response, rateLimitAttempt)
    const backoffBonus = Math.min(60, consecutiveRateLimits * 5)
    const waitSeconds = retryAfterSeconds + backoffBonus
    consecutiveRateLimits += 1

    console.warn(`Rate limited, waiting ${waitSeconds}s... (${path})`)
    await sleep(waitSeconds * 1000)

    if (currentArtistName) {
      console.log(`Resuming artist ${currentArtistName}...`)
    }

    return spotifyGet(token, path, params, rateLimitAttempt + 1, 0)
  }

  if (response.status >= 500 && transientAttempt < TRANSIENT_ERROR_MAX_ATTEMPTS) {
    const waitSeconds = Math.min(60, 2 ** transientAttempt)
    console.warn(`Spotify server error ${response.status} on ${path}, retrying in ${waitSeconds}s...`)
    await sleep(waitSeconds * 1000)
    return spotifyGet(token, path, params, rateLimitAttempt, transientAttempt + 1)
  }

  consecutiveRateLimits = 0

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Spotify GET ${path} failed: ${response.status} ${body.slice(0, 200)}`)
  }

  return response.json()
}

async function searchArtist(token, artistName) {
  const data = await spotifyGet(token, 'search', {
    q: artistName,
    type: 'artist',
    market: MARKET,
    limit: 5,
  })

  const artists = data.artists?.items ?? []
  let bestArtist = null
  let bestScore = 0

  for (const artist of artists) {
    const score = artistNameScore(artist.name, artistName)
    if (score > bestScore) {
      bestScore = score
      bestArtist = artist
    }
  }

  return bestScore >= 60 ? bestArtist : null
}

async function fetchArtistTopTracks(token, artistId) {
  const data = await spotifyGet(token, `artists/${artistId}/top-tracks`, {
    market: MARKET,
  })
  return data.tracks ?? []
}

async function fetchFullTracks(token, trackIds) {
  const tracks = []
  for (let index = 0; index < trackIds.length; index += 50) {
    const batch = trackIds.slice(index, index + 50)
    const data = await spotifyGet(token, 'tracks', {
      ids: batch.join(','),
      market: MARKET,
    })
    for (const track of data.tracks ?? []) {
      if (track) tracks.push(track)
    }
  }
  return tracks
}

async function fetchArtistAlbumTracks(token, artistId) {
  const trackIds = new Set()

  for (let albumPage = 0; albumPage < Math.ceil(MAX_ALBUMS_PER_ARTIST / ALBUM_PAGE_SIZE); albumPage += 1) {
    const offset = albumPage * ALBUM_PAGE_SIZE
    const data = await spotifyGet(token, `artists/${artistId}/albums`, {
      include_groups: 'album,single,compilation',
      market: MARKET,
      limit: ALBUM_PAGE_SIZE,
      offset,
    })

    const albums = data.items ?? []
    if (albums.length === 0) break

    for (const album of albums) {
      for (let trackPage = 0; trackPage < Math.ceil(MAX_TRACKS_PER_ALBUM / 50); trackPage += 1) {
        const trackOffset = trackPage * 50
        const albumData = await spotifyGet(token, `albums/${album.id}/tracks`, {
          limit: 50,
          offset: trackOffset,
        })

        const items = albumData.items ?? []
        if (items.length === 0) break

        for (const track of items) {
          if (track?.id) trackIds.add(track.id)
        }

        if (items.length < 50) break
      }
    }

    if (albums.length < ALBUM_PAGE_SIZE) break
    if (offset + albums.length >= MAX_ALBUMS_PER_ARTIST) break
  }

  return fetchFullTracks(token, [...trackIds])
}

async function searchArtistTracks(token, artistName) {
  const tracks = []
  const escapedName = artistName.replace(/"/g, '\\"')

  for (let pageIndex = 0; pageIndex < MAX_PAGES_PER_ARTIST; pageIndex += 1) {
    const offset = pageIndex * SEARCH_PAGE_SIZE
    if (offset > MAX_SEARCH_OFFSET) break

    const data = await spotifyGet(token, 'search', {
      q: `artist:"${escapedName}"`,
      type: 'track',
      market: MARKET,
      limit: SEARCH_PAGE_SIZE,
      offset,
    })

    const page = data.tracks?.items ?? []
    if (page.length === 0) break

    for (const track of page) {
      if (isOpmSpotifyTrack(track)) {
        tracks.push(track)
      }
    }
  }

  return tracks
}

async function collectArtistTracks(token, artistName) {
  const trackById = new Map()

  const artist = await searchArtist(token, artistName)
  if (artist) {
    try {
      for (const track of await fetchArtistTopTracks(token, artist.id)) {
        if (isOpmSpotifyTrack(track)) {
          trackById.set(track.id, track)
        }
      }
    } catch {
      // Top tracks are optional; album + search pagination are the main sources.
    }

    for (const track of await fetchArtistAlbumTracks(token, artist.id)) {
      if (isOpmSpotifyTrack(track)) {
        trackById.set(track.id, track)
      }
    }
  }

  for (const track of await searchArtistTracks(token, artistName)) {
    trackById.set(track.id, track)
  }

  return [...trackById.values()]
}

async function resolvePreview(track) {
  const artist = track.artists.map((item) => item.name).join(', ')
  await throttle()
  return resolvePreviewSourcesForTrack({
    title: track.name,
    artist,
    spotifyPreviewUrl: track.preview_url ?? null,
  })
}

function loadCheckpoint(checkpointPath) {
  try {
    const parsed = JSON.parse(readFileSync(checkpointPath, 'utf8'))
    return new Set(Array.isArray(parsed.completedArtists) ? parsed.completedArtists : [])
  } catch {
    return new Set()
  }
}

function saveCheckpoint(checkpointPath, completedArtists) {
  writeFileSync(
    checkpointPath,
    `${JSON.stringify({ completedArtists: [...completedArtists] }, null, 2)}\n`,
    'utf8',
  )
}

function loadCatalog(outputPath) {
  try {
    const parsed = JSON.parse(readFileSync(outputPath, 'utf8'))
    return new Map((parsed.tracks ?? []).map((track) => [track.id, track]))
  } catch {
    return new Map()
  }
}

function saveCatalog(outputPath, trackMap) {
  const deduped = dedupeTracks([...trackMap.values()])
  const catalog = {
    updatedAt: new Date().toISOString(),
    tracks: deduped.sort((a, b) => a.title.localeCompare(b.title)),
  }
  writeFileSync(outputPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8')
  return catalog
}

async function main() {
  loadEnvFile()

  const forceRebuild = process.argv.includes('--force')
  const expandOnly = process.argv.includes('--expand')

  const clientId = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET

  if (!clientId || !clientSecret || clientId.includes('your_spotify')) {
    throw new Error('Add real SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET to .env.local first.')
  }

  const outputPath = resolve(process.cwd(), 'data/catalog.json')
  const checkpointPath = resolve(process.cwd(), 'data/catalog-build.checkpoint.json')
  const trackMap = loadCatalog(outputPath)
  let completedArtists = loadCheckpoint(checkpointPath)

  if (forceRebuild || expandOnly) {
    completedArtists = new Set()
  }

  console.log('Authenticating with Spotify...')
  const token = await getSpotifyToken(clientId, clientSecret)

  console.log(`Building catalogue for ${UNIQUE_OPM_ARTISTS.length} OPM artists...`)
  console.log(`Resuming with ${trackMap.size} saved tracks, ${completedArtists.size} artists done`)

  for (const artistName of UNIQUE_OPM_ARTISTS) {
    if (completedArtists.has(artistName)) {
      console.log(`  ${artistName}: skipped (checkpoint)`)
      continue
    }

    currentArtistName = artistName
    console.log(`Processing artist ${artistName}...`)

    try {
      const tracks = await collectArtistTracks(token, artistName)
      let added = 0

      for (const track of tracks) {
        const previews = await resolvePreview(track)
        if (previews.previewUrl && addTrack(trackMap, track, previews, trackMap.size)) {
          added += 1
        }
      }

      completedArtists.add(artistName)
      saveCatalog(outputPath, trackMap)
      saveCheckpoint(checkpointPath, completedArtists)
      console.log(`  ${artistName}: ${tracks.length} candidates, ${added} added (${trackMap.size} total)`)
    } catch (error) {
      saveCatalog(outputPath, trackMap)
      saveCheckpoint(checkpointPath, completedArtists)
      console.error(
        `Build paused at ${artistName} (${completedArtists.size}/${UNIQUE_OPM_ARTISTS.length} artists done). Checkpoint saved.`,
      )
      throw error
    } finally {
      currentArtistName = null
    }
  }

  const catalog = saveCatalog(outputPath, trackMap)

  const perArtist = new Map()
  for (const track of catalog.tracks) {
    const primaryArtist = track.artist.split(',')[0]?.trim() ?? track.artist
    perArtist.set(primaryArtist, (perArtist.get(primaryArtist) ?? 0) + 1)
  }

  const sortedCounts = [...perArtist.entries()].sort((left, right) => right[1] - left[1])
  console.log(`Saved ${catalog.tracks.length} OPM tracks to data/catalog.json`)
  console.log(`Artists represented: ${sortedCounts.length}`)
  console.log(
    'Top counts:',
    sortedCounts.slice(0, 10).map(([name, count]) => `${name} (${count})`).join(', '),
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(2)
})
