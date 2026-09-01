import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  isOpmArtistName,
  isOpmSpotifyTrack,
  normalizeName,
  UNIQUE_OPM_ARTISTS,
} from './opm-artists.mjs'

/** Philippines Top 50 — high-priority trending OPM source. */
export const OPM_PLAYLIST_ID = '37i9dQZEVXbNBz9cRCSFkY'
export const OPM_PLAYLIST_NAME = 'Top 50 - Philippines'

/** Fallback when Spotify blocks editorial playlist access (client credentials). */
const PLAYLIST_ARCHIVE_BASES = [
  'https://raw.githubusercontent.com/mackorone/spotify-playlist-archive/main/playlists/pretty',
  'https://raw.githubusercontent.com/mackorone/spotify-playlist-archive-2/main/playlists/pretty',
]
const PRIVATE_PLAYLIST_ERROR =
  'This playlist is private or blocked by Spotify. Try a public user playlist.'
const EMBED_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

const MARKET = 'PH'
const API_DELAY_MS = 750

/** International acts that chart on PH Top 50 but are not OPM. */
const NON_OPM_BLOCKLIST = new Set(
  [
    'Taylor Swift',
    'Olivia Dean',
    'Daniel Caesar',
    'sombr',
    'The Script',
    'Maroon 5',
    'Justin Bieber',
    'Billie Eilish',
    'Kehlani',
    'Madison Beer',
    'Tyla',
    'Djo',
    'KATSEYE',
    'The Goo Goo Dolls',
    'She & Him',
    'SIENNA SPIRO',
    'Black Eyed Peas',
    'Ed Sheeran',
    'The Weeknd',
    'Drake',
    'Ariana Grande',
    'Bruno Mars',
    'Coldplay',
    'Imagine Dragons',
    'OneRepublic',
    'Dua Lipa',
    'Post Malone',
    'BTS',
    'BLACKPINK',
    'NewJeans',
    'TWICE',
    'Stray Kids',
    'SEVENTEEN',
    'ENHYPEN',
    'Jung Kook',
    'Lisa',
    'Jay Chou',
    'JJ Lin',
    'G.E.M.',
    'IU',
    'aespa',
    'IVE',
    'LE SSERAFIM',
  ].map((name) => normalizeName(name)),
)

/** Filipino surname / name patterns common in OPM artists. */
const FILIPINO_NAME_PATTERNS = [
  /\bdela\s/i,
  /\bde\s+los\s/i,
  /\bde\s+la\s/i,
  /\bsantos\b/i,
  /\breyes\b/i,
  /\bcruz\b/i,
  /\bgarcia\b/i,
  /\bfernandez\b/i,
  /\brivera\b/i,
  /\bflores\b/i,
  /\bcastillo\b/i,
  /\bdomingo\b/i,
  /\bvaldez\b/i,
  /\bvelasquez\b/i,
  /\bgeronimo\b/i,
  /\bconstantino\b/i,
  /\btandingan\b/i,
  /\bnery\b/i,
  /\btabudlo\b/i,
  /\bmonterde\b/i,
  /\bdionela\b/i,
  /\bdilaw\b/i,
  /\bnobita\b/i,
  /\badie\b/i,
  /\bmaki\b/i,
  /\bben&ben\b/i,
  /\bbini\b/i,
  /\bsb19\b/i,
  /\bbgyo\b/i,
  /\balamat\b/i,
  /\bvxon\b/i,
  /\bgloc-?9\b/i,
  /\bskusta\b/i,
  /\bflow\s*g\b/i,
  /\bshanti\s*dope\b/i,
  /\bmoira\b/i,
  /\beraserheads\b/i,
  /\brivermaya\b/i,
  /\bparokya\b/i,
  /\bdecember\s*avenue\b/i,
  /\bfitterkarma\b/i,
  /\bsoapdish\b/i,
  /\bnateman\b/i,
  /\bmagnus\s*haven\b/i,
  /\bearl\s*agustin\b/i,
  /\ble\s*john\b/i,
  /\bla\s*mave\b/i,
]

/** Artists confirmed Filipino from PH editorial playlists (manual review). */
export const PLAYLIST_OPM_ARTISTS = [
  'fitterkarma',
  'Soapdish',
  'Le John',
  'La Mave',
  'Nateman',
  'Magnus Haven',
  'Earl Agustin',
  'nicole',
  'Kiyo',
  'Janine',
  'Gat Putch',
  'Louie Grammz',
  "Mi'Kel",
  'Jolianne',
  'Halik Sobrang Diin',
]

export function isBlockedNonOpmArtist(name) {
  const normalized = normalizeName(name)
  return NON_OPM_BLOCKLIST.has(normalized)
}

export function looksFilipinoArtistName(name) {
  if (!name || typeof name !== 'string') return false
  if (isBlockedNonOpmArtist(name)) return false
  return FILIPINO_NAME_PATTERNS.some((pattern) => pattern.test(name))
}

export function isLikelyOpmPlaylistArtist(name, artistMeta = {}) {
  if (!name) return false
  if (isOpmArtistName(name)) return true
  if (isBlockedNonOpmArtist(name)) return false
  if (PLAYLIST_OPM_ARTISTS.some((allowed) => normalizeName(allowed) === normalizeName(name))) {
    return true
  }
  if (artistMeta.country === 'PH') return true
  if (looksFilipinoArtistName(name)) return true
  return false
}

export function isLikelyOpmPlaylistTrack(track, artistCountries = new Map()) {
  if (!track) return false
  if (isOpmSpotifyTrack(track)) return true

  const artists = track.artists ?? []
  if (artists.length === 0) return false

  return artists.every((artist) => {
    const country = artist.id ? artistCountries.get(artist.id) : undefined
    return isLikelyOpmPlaylistArtist(artist.name, { country })
  })
}

export function loadEnvFile() {
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
    // .env.local optional
  }
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms))
}

let lastRequestAt = 0

async function throttle() {
  const elapsed = Date.now() - lastRequestAt
  if (elapsed < API_DELAY_MS) {
    await sleep(API_DELAY_MS - elapsed)
  }
  lastRequestAt = Date.now()
}

export async function getSpotifyToken(clientId, clientSecret, refreshToken) {
  const body = refreshToken
    ? new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken })
    : new URLSearchParams({ grant_type: 'client_credentials' })
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

export async function spotifyGet(token, path, params = {}) {
  await throttle()

  const url = new URL(`https://api.spotify.com/v1/${path}`)
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value))
    }
  }

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (response.status === 429) {
    const retryAfter = Number(response.headers.get('retry-after') ?? 5)
    console.warn(`Rate limited on ${path}, waiting ${retryAfter}s...`)
    await sleep(retryAfter * 1000)
    return spotifyGet(token, path, params)
  }

  if (!response.ok) {
    const body = await response.text()
    const error = new Error(`Spotify GET ${path} failed: ${response.status} ${body.slice(0, 200)}`)
    error.status = response.status
    throw error
  }

  return response.json()
}

async function fetchFullTracks(token, trackIds, market = MARKET) {
  const tracks = []
  const uniqueIds = [...new Set(trackIds.filter(Boolean))]

  for (let index = 0; index < uniqueIds.length; index += 50) {
    const batch = uniqueIds.slice(index, index + 50)
    const data = await spotifyGet(token, 'tracks', {
      ids: batch.join(','),
      market,
    })
    for (const track of data.tracks ?? []) {
      if (track?.id) tracks.push(track)
    }
  }

  return tracks
}

function unescapeArchiveText(value) {
  return value.replace(/\\([\\`*_{}\[\]()#+\-.!])/g, '$1').trim()
}

function parseArchiveTracks(text) {
  const tracks = []
  const seen = new Set()
  const rowPattern =
    /\|\s*\d+\s*\|\s*\[([^\]]+)\]\(https:\/\/open\.spotify\.com\/track\/([A-Za-z0-9]+)\)\s*\|\s*([^|]+)\|/g

  for (const match of text.matchAll(rowPattern)) {
    const title = unescapeArchiveText(match[1] ?? '')
    const id = match[2]
    const artistsCell = match[3] ?? ''
    if (!id || seen.has(id)) continue
    seen.add(id)

    const artists = []
    const artistPattern = /\[([^\]]+)\]\(https:\/\/open\.spotify\.com\/artist\/([A-Za-z0-9]+)\)/g
    for (const artistMatch of artistsCell.matchAll(artistPattern)) {
      artists.push({
        id: artistMatch[2],
        name: unescapeArchiveText(artistMatch[1] ?? ''),
      })
    }

    tracks.push({ id, name: title, artists })
  }

  return tracks
}

function parseArchiveTrackIds(text) {
  const fromRows = parseArchiveTracks(text).map((track) => track.id).filter(Boolean)
  if (fromRows.length > 0) return fromRows

  const ids = []
  const seen = new Set()
  const pattern = /open\.spotify\.com\/track\/([A-Za-z0-9]+)/g

  for (const match of text.matchAll(pattern)) {
    const id = match[1]
    if (!seen.has(id)) {
      seen.add(id)
      ids.push(id)
    }
  }

  return ids
}

function parseSubtitleArtists(subtitle) {
  return String(subtitle ?? '')
    .replace(/\u00a0/g, ' ')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => ({ name }))
}

function mergeTrackMetadata(stubs, hydrated) {
  if (hydrated.length === 0) return stubs
  const byId = new Map(hydrated.filter((track) => track.id).map((track) => [track.id, track]))
  return stubs.map((stub) => {
    const full = stub.id ? byId.get(stub.id) : undefined
    if (!full) return stub
    return {
      ...full,
      preview_url: full.preview_url ?? stub.preview_url ?? null,
      name: full.name || stub.name,
      artists: full.artists?.length ? full.artists : stub.artists,
    }
  })
}

async function hydrateTrackRefs(token, stubs, market = MARKET) {
  const trackIds = stubs.map((track) => track.id).filter(Boolean)
  let hydrated = []
  try {
    hydrated = await fetchFullTracks(token, trackIds, market)
  } catch (error) {
    if (error.status !== 403 && error.status !== 404 && error.status !== 429) {
      throw error
    }
    console.warn('Track hydration blocked; using fallback title/artist metadata.')
  }

  if (hydrated.length === 0 && stubs.length > 0) {
    console.warn('Using fallback metadata without Spotify track hydration.')
    return stubs
  }

  return mergeTrackMetadata(stubs, hydrated)
}

async function fetchArchiveMarkdown(playlistId) {
  const statuses = []
  for (const base of PLAYLIST_ARCHIVE_BASES) {
    const url = `${base}/${encodeURIComponent(playlistId)}.md`
    const response = await fetch(url)
    if (response.ok) return response.text()
    statuses.push(String(response.status))
  }
  throw new Error(`Archive fallback failed: ${statuses.join(', ') || 'no sources'}`)
}

async function fetchPlaylistFromArchive(token, playlistId, market = MARKET) {
  console.warn(`Editorial playlist ${playlistId} blocked; using archive track IDs.`)

  const markdown = await fetchArchiveMarkdown(playlistId)
  const archiveTracks = parseArchiveTracks(markdown)
  if (archiveTracks.length === 0) {
    const fallbackIds = parseArchiveTrackIds(markdown)
    if (fallbackIds.length === 0) {
      throw new Error('Archive fallback failed: no tracks')
    }
    archiveTracks.push(...fallbackIds.map((id) => ({ id, name: '', artists: [] })))
  }

  const heading = markdown.match(/^###\s*\[([^\]]+)\]/m)
  const archiveName = heading?.[1] ? unescapeArchiveText(heading[1]) : ''

  return {
    playlistId,
    playlistName: archiveName || (playlistId === OPM_PLAYLIST_ID ? OPM_PLAYLIST_NAME : playlistId),
    totalTracks: archiveTracks.length,
    tracks: await hydrateTrackRefs(token, archiveTracks, market),
    source: 'archive-fallback',
  }
}

function parseEmbedTracks(entity) {
  const tracks = []
  const seen = new Set()
  for (const item of entity?.trackList ?? []) {
    const id = item.uri?.match(/spotify:track:([A-Za-z0-9]+)/)?.[1]
    if (!id || seen.has(id)) continue
    seen.add(id)
    tracks.push({
      id,
      name: item.title ?? '',
      preview_url: item.audioPreview?.url ?? null,
      artists: parseSubtitleArtists(item.subtitle ?? ''),
    })
  }
  return tracks
}

async function fetchPlaylistFromEmbed(token, playlistId, market = MARKET) {
  console.warn(`Trying public embed snapshot for ${playlistId}.`)

  const response = await fetch(
    `https://open.spotify.com/embed/playlist/${encodeURIComponent(playlistId)}`,
    {
      headers: {
        'User-Agent': EMBED_USER_AGENT,
        Accept: 'text/html',
      },
    },
  )
  if (!response.ok) {
    throw new Error(`Embed fallback failed: ${response.status}`)
  }

  const html = await response.text()
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
  if (!match?.[1]) {
    throw new Error('Embed fallback failed: missing playlist data')
  }

  const data = JSON.parse(match[1])
  const entity = data?.props?.pageProps?.state?.data?.entity
  const embedTracks = parseEmbedTracks(entity)
  if (embedTracks.length === 0) {
    throw new Error('Embed fallback failed: no tracks')
  }

  return {
    playlistId,
    playlistName:
      entity?.name?.trim() ||
      entity?.title?.trim() ||
      (playlistId === OPM_PLAYLIST_ID ? OPM_PLAYLIST_NAME : playlistId),
    totalTracks: embedTracks.length,
    tracks: await hydrateTrackRefs(token, embedTracks, market),
    source: 'embed-fallback',
  }
}

async function fetchPlaylistViaPublicFallbacks(token, playlistId, market = MARKET) {
  try {
    return await fetchPlaylistFromEmbed(token, playlistId, market)
  } catch (embedError) {
    console.warn(
      `Embed fallback failed for ${playlistId}: ${
        embedError instanceof Error ? embedError.message : String(embedError)
      }`,
    )
  }

  try {
    return await fetchPlaylistFromArchive(token, playlistId, market)
  } catch (archiveError) {
    console.warn(
      `Archive fallback failed for ${playlistId}: ${
        archiveError instanceof Error ? archiveError.message : String(archiveError)
      }`,
    )
  }

  const error = new Error(PRIVATE_PLAYLIST_ERROR)
  error.status = 404
  throw error
}

/**
 * Paginate all tracks from a Spotify playlist.
 * Falls back to public embed, then archive, when editorial playlists are forbidden (403/404).
 */
export async function fetchPlaylistTracks(token, playlistId, market = MARKET) {
  try {
    const playlist = await spotifyGet(token, `playlists/${playlistId}`, {
      market,
      fields: 'name,id,tracks.total',
    })

    const tracks = []
    let offset = 0
    const limit = 100

    while (true) {
      const page = await spotifyGet(token, `playlists/${playlistId}/tracks`, {
        market,
        limit,
        offset,
        fields:
          'items(added_at,track(id,name,preview_url,popularity,artists(id,name),album(images,release_date)))',
      })

      const items = page.items ?? []
      if (items.length === 0) break

      for (const item of items) {
        const track = item?.track
        if (track?.id) tracks.push(track)
      }

      offset += items.length
      if (items.length < limit) break
    }

    return {
      playlistId,
      playlistName: playlist.name ?? OPM_PLAYLIST_NAME,
      totalTracks: playlist.tracks?.total ?? tracks.length,
      tracks,
      source: 'spotify-api',
    }
  } catch (error) {
    if (error.status === 403 || error.status === 404) {
      return fetchPlaylistViaPublicFallbacks(token, playlistId, market)
    }
    throw error
  }
}

export async function fetchArtistCountries(token, artistIds) {
  const countries = new Map()
  const uniqueIds = [...new Set(artistIds.filter(Boolean))]

  for (let index = 0; index < uniqueIds.length; index += 50) {
    const batch = uniqueIds.slice(index, index + 50)
    const data = await spotifyGet(token, 'artists', { ids: batch.join(',') })
    for (const artist of data.artists ?? []) {
      if (artist?.id) {
        countries.set(artist.id, artist.country ?? null)
      }
    }
  }

  return countries
}

export function discoverNewOpmArtists(tracks, artistCountries = new Map()) {
  const knownNormalized = new Set(UNIQUE_OPM_ARTISTS.map((name) => normalizeName(name)))
  const discovered = new Map()

  for (const track of tracks) {
    for (const artist of track.artists ?? []) {
      const name = artist.name?.trim()
      if (!name) continue
      if (knownNormalized.has(normalizeName(name))) continue
      if (isBlockedNonOpmArtist(name)) continue
      if (!isLikelyOpmPlaylistArtist(name, { country: artistCountries.get(artist.id) })) {
        continue
      }
      discovered.set(normalizeName(name), name)
    }
  }

  return [...discovered.values()].sort((a, b) => a.localeCompare(b))
}

async function main() {
  loadEnvFile()

  const clientId = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('Add SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET to .env.local')
  }

  const rawInput = process.argv[2] ?? OPM_PLAYLIST_ID
  const playlistId = rawInput.includes('playlist') || rawInput.includes('?')
    ? (rawInput.match(/playlist\/([A-Za-z0-9]+)/)?.[1] ?? rawInput.split(/[?#]/)[0])
    : rawInput
  const token = await getSpotifyToken(
    clientId,
    clientSecret,
    process.env.SPOTIFY_REFRESH_TOKEN,
  )

  console.log(`Fetching playlist ${playlistId}...`)
  const result = await fetchPlaylistTracks(token, playlistId)
  const { playlistName, totalTracks, tracks, source } = result
  console.log(
    `Playlist: "${playlistName}" (${totalTracks} tracks reported, ${tracks.length} fetched, source: ${source})`,
  )

  const artistIds = tracks.flatMap((track) => (track.artists ?? []).map((a) => a.id))
  const artistCountries = await fetchArtistCountries(token, artistIds)

  const opmTracks = tracks.filter((track) => isLikelyOpmPlaylistTrack(track, artistCountries))
  const allowlistTracks = tracks.filter((track) => isOpmSpotifyTrack(track))
  const newArtists = discoverNewOpmArtists(tracks, artistCountries)

  console.log(`\nOPM tracks (allowlist): ${allowlistTracks.length}`)
  console.log(`OPM tracks (with heuristics): ${opmTracks.length}`)
  console.log(`Non-OPM filtered out: ${tracks.length - opmTracks.length}`)

  if (newArtists.length > 0) {
    console.log(`\nNew Filipino artists to add (${newArtists.length}):`)
    for (const name of newArtists) {
      console.log(`  - ${name}`)
    }
  } else {
    console.log('\nNo new Filipino artists discovered.')
  }

  const nonOpmSample = tracks
    .filter((track) => !isLikelyOpmPlaylistTrack(track, artistCountries))
    .slice(0, 15)
    .map((track) => `${track.name} — ${(track.artists ?? []).map((a) => a.name).join(', ')}`)

  if (nonOpmSample.length > 0) {
    console.log('\nFiltered out (sample):')
    for (const line of nonOpmSample) {
      console.log(`  - ${line}`)
    }
  }

  const opmSample = opmTracks.slice(0, 10).map(
    (track) => `${track.name} — ${(track.artists ?? []).map((a) => a.name).join(', ')}`,
  )
  if (opmSample.length > 0) {
    console.log('\nOPM tracks (sample):')
    for (const line of opmSample) {
      console.log(`  - ${line}`)
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error)
    process.exit(2)
  })
}
