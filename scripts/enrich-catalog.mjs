import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { resolvePreviewSourcesForTrack } from './preview-sources.mjs'

const GENRE_RULES = [
  { genre: 'hip-hop', pattern: /hip.?hop|rap|trap|skusta|flow g|hellmerry|brando|denise/i },
  { genre: 'r&b', pattern: /r&b|soul|moira|regine|gary valenciano|martin nievera|jona|morissette|kyla/i },
  { genre: 'rock', pattern: /rock|eraserheads|rivermaya|parokya|itchyworms|silent sanctuary|chicosci|hale|up dharma|kamikazee/i },
  { genre: 'dance', pattern: /dance|electro|house|edm|remix|dj/i },
  {
    genre: 'pop',
    pattern: /sb19|bini|p-pop|ben&ben|cup of joe|zack tabudlo|arthur nery|juan karlos|lola amour|hev abi|sarah geronimo|december avenue/i,
  },
]

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
    // optional
  }
}

function inferGenreGroups(artist, title) {
  const haystack = `${artist} ${title}`.toLowerCase()
  const groups = GENRE_RULES.filter((rule) => rule.pattern.test(haystack)).map((rule) => rule.genre)
  return groups.length > 0 ? [...new Set(groups)] : ['other']
}

function parseReleaseYear(releaseDate) {
  if (!releaseDate) return undefined
  const year = Number.parseInt(String(releaseDate).slice(0, 4), 10)
  return Number.isInteger(year) ? year : undefined
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
  if (!response.ok) throw new Error(`Spotify auth failed: ${response.status}`)
  const data = await response.json()
  return data.access_token
}

async function fetchTrack(token, id) {
  const response = await fetch(`https://api.spotify.com/v1/tracks/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) return null
  return response.json()
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms))
}

async function main() {
  loadEnvFile()
  const catalogPath = resolve(process.cwd(), 'data/catalog.json')
  const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'))
  const clientId = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET
  const hasSpotify = clientId && clientSecret && !clientId.includes('your_spotify')
  const token = hasSpotify ? await getSpotifyToken(clientId, clientSecret) : null

  let enriched = 0
  let dualPreview = 0
  for (const track of catalog.tracks) {
    track.genreGroups = inferGenreGroups(track.artist, track.title)

    const previews = await resolvePreviewSourcesForTrack({
      title: track.title,
      artist: track.artist,
      spotifyPreviewUrl: null,
    })

    if (previews.previewUrl) {
      track.previewUrl = previews.previewUrl
      if (previews.hookPreviewUrl) {
        track.hookPreviewUrl = previews.hookPreviewUrl
        dualPreview += 1
      } else {
        delete track.hookPreviewUrl
      }
      track.hookStartSeconds = previews.hookStartSeconds
    }

    if (token) {
      const spotifyTrack = await fetchTrack(token, track.id)
      track.releaseYear = parseReleaseYear(spotifyTrack?.album?.release_date)
      if (track.releaseYear) enriched += 1
      await sleep(120)
      continue
    }

    if (!track.releaseYear) {
      track.releaseYear = 2018
    }

    await sleep(120)
  }

  catalog.updatedAt = new Date().toISOString()
  writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8')
  console.log(
    `Enriched ${catalog.tracks.length} tracks (${enriched} release years from Spotify, ${dualPreview} dual preview sources).`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
