import {
  isOpmArtistName,
  isOpmSpotifyTrack,
  normalizeName,
  type SpotifyTrackRef,
  UNIQUE_OPM_ARTISTS,
} from './opm-artists'

/** Philippines Top 50 — high-priority trending OPM source. */
export const OPM_PLAYLIST_ID = '37i9dQZEVXbNBz9cRCSFkY'
export const OPM_PLAYLIST_NAME = 'Top 50 - Philippines'
export const MAX_PLAYLIST_TRACKS = 20_000

const PLAYLIST_ARCHIVE_BASE =
  'https://raw.githubusercontent.com/mackorone/spotify-playlist-archive/main/playlists/pretty'

const MARKET = 'PH'

export function parseSpotifyPlaylistId(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  try {
    const url = new URL(trimmed)
    const match = url.pathname.match(/\/playlist\/([A-Za-z0-9]+)/)
    if (match?.[1]) return match[1]
  } catch {
    // Not a URL — try URI or raw ID below.
  }

  const uriMatch = trimmed.match(/^spotify:playlist:([A-Za-z0-9]+)$/i)
  if (uriMatch?.[1]) return uriMatch[1]

  if (/^[A-Za-z0-9]{10,34}$/.test(trimmed)) return trimmed

  return null
}

function playlistArchiveUrl(playlistId: string): string {
  return `${PLAYLIST_ARCHIVE_BASE}/${encodeURIComponent(playlistId)}.md`
}

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
] as const

export function isBlockedNonOpmArtist(name: string): boolean {
  return NON_OPM_BLOCKLIST.has(normalizeName(name))
}

export function looksFilipinoArtistName(name: string): boolean {
  if (!name) return false
  if (isBlockedNonOpmArtist(name)) return false
  return FILIPINO_NAME_PATTERNS.some((pattern) => pattern.test(name))
}

export function isLikelyOpmPlaylistArtist(
  name: string,
  artistMeta: { country?: string | null } = {},
): boolean {
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

export function isLikelyOpmPlaylistTrack(
  track: SpotifyTrackRef,
  artistCountries: Map<string, string | null> = new Map(),
): boolean {
  if (!track) return false
  if (isOpmSpotifyTrack(track)) return true

  const artists = track.artists ?? []
  if (artists.length === 0) return false

  return artists.every((artist) => {
    const country = artist.id ? artistCountries.get(artist.id) : undefined
    return isLikelyOpmPlaylistArtist(artist.name, { country })
  })
}

export interface PlaylistFetchResult {
  playlistId: string
  playlistName: string
  totalTracks: number
  tracks: SpotifyTrackRef[]
  source: 'spotify-api' | 'archive-fallback'
}

export async function fetchPlaylistTracks(
  spotifyGet: (
    path: string,
    params?: Record<string, string | number | undefined>,
  ) => Promise<unknown>,
  playlistId: string,
  market = MARKET,
): Promise<PlaylistFetchResult> {
  try {
    const playlist = (await spotifyGet(`playlists/${playlistId}`, {
      market,
      fields: 'name,id,tracks.total',
    })) as { name?: string; tracks?: { total?: number } }

    const tracks: SpotifyTrackRef[] = []
    let offset = 0
    const limit = 100

    while (tracks.length < MAX_PLAYLIST_TRACKS) {
      const page = (await spotifyGet(`playlists/${playlistId}/tracks`, {
        market,
        limit,
        offset,
        fields:
          'items(added_at,track(id,name,preview_url,popularity,artists(id,name),album(images,release_date)))',
      })) as { items?: { track?: SpotifyTrackRef }[] }

      const items = page.items ?? []
      if (items.length === 0) break

      for (const item of items) {
        const track = item?.track
        if (track?.id) tracks.push(track)
        if (tracks.length >= MAX_PLAYLIST_TRACKS) break
      }

      offset += items.length
      if (items.length < limit) break
    }

    return {
      playlistId,
      playlistName: playlist.name ?? (playlistId === OPM_PLAYLIST_ID ? OPM_PLAYLIST_NAME : playlistId),
      totalTracks: playlist.tracks?.total ?? tracks.length,
      tracks,
      source: 'spotify-api',
    }
  } catch (error) {
    const status = (error as { status?: number }).status
    if (status === 403 || status === 404) {
      try {
        return await fetchPlaylistFromArchive(spotifyGet, playlistId, market)
      } catch (archiveError) {
        console.warn(
          `[playlist] Archive fallback failed for ${playlistId}: ${
            archiveError instanceof Error ? archiveError.message : String(archiveError)
          }`,
        )
        throw error
      }
    }
    throw error
  }
}

function unescapeArchiveText(value: string): string {
  return value.replace(/\\([\\`*_{}\[\]()#+\-.!])/g, '$1').trim()
}

function parseArchiveTracks(text: string): SpotifyTrackRef[] {
  const tracks: SpotifyTrackRef[] = []
  const seen = new Set<string>()
  const rowPattern =
    /\|\s*\d+\s*\|\s*\[([^\]]+)\]\(https:\/\/open\.spotify\.com\/track\/([A-Za-z0-9]+)\)\s*\|\s*([^|]+)\|/g

  for (const match of text.matchAll(rowPattern)) {
    const title = unescapeArchiveText(match[1] ?? '')
    const id = match[2]
    const artistsCell = match[3] ?? ''
    if (!id || seen.has(id)) continue
    seen.add(id)

    const artists: { id?: string; name: string }[] = []
    const artistPattern = /\[([^\]]+)\]\(https:\/\/open\.spotify\.com\/artist\/([A-Za-z0-9]+)\)/g
    for (const artistMatch of artistsCell.matchAll(artistPattern)) {
      artists.push({
        id: artistMatch[2],
        name: unescapeArchiveText(artistMatch[1] ?? ''),
      })
    }

    tracks.push({
      id,
      name: title,
      artists,
    })
  }

  return tracks
}

function parseArchiveTrackIds(text: string): string[] {
  const fromRows = parseArchiveTracks(text)
    .map((track) => track.id)
    .filter((id): id is string => Boolean(id))
  if (fromRows.length > 0) return fromRows

  const ids: string[] = []
  const seen = new Set<string>()
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

async function fetchFullTracksByIds(
  spotifyGet: (
    path: string,
    params?: Record<string, string | number | undefined>,
  ) => Promise<unknown>,
  trackIds: string[],
  market = MARKET,
): Promise<SpotifyTrackRef[]> {
  const tracks: SpotifyTrackRef[] = []

  for (let index = 0; index < trackIds.length; index += 50) {
    const batch = trackIds.slice(index, index + 50)
    try {
      const data = (await spotifyGet('tracks', {
        ids: batch.join(','),
        market,
      })) as { tracks?: (SpotifyTrackRef | null)[] }

      for (const track of data.tracks ?? []) {
        if (track?.id) tracks.push(track)
      }
    } catch (error) {
      const status = (error as { status?: number }).status
      if (status === 403 || status === 404) {
        console.warn(`[playlist] Batch tracks fetch blocked (${status}); skipping remainder`)
        break
      }
      throw error
    }
  }

  return tracks
}

async function fetchPlaylistFromArchive(
  spotifyGet: (
    path: string,
    params?: Record<string, string | number | undefined>,
  ) => Promise<unknown>,
  playlistId: string,
  market = MARKET,
): Promise<PlaylistFetchResult> {
  console.warn(`[playlist] Editorial playlist ${playlistId} blocked; using archive track IDs.`)

  const response = await fetch(playlistArchiveUrl(playlistId))
  if (!response.ok) {
    throw new Error(`Archive fallback failed: ${response.status}`)
  }

  const markdown = await response.text()
  const archiveTracks = parseArchiveTracks(markdown).slice(0, MAX_PLAYLIST_TRACKS)
  const trackIds = archiveTracks.map((track) => track.id).filter((id): id is string => Boolean(id))

  let tracks: SpotifyTrackRef[] = []
  try {
    tracks = await fetchFullTracksByIds(spotifyGet, trackIds, market)
  } catch (error) {
    const status = (error as { status?: number }).status
    if (status !== 403 && status !== 404 && status !== 429) {
      throw error
    }
    console.warn('[playlist] Track hydration blocked; using archive title/artist metadata.')
  }

  if (tracks.length === 0 && archiveTracks.length > 0) {
    console.warn('[playlist] Using archive markdown metadata without Spotify track hydration.')
    tracks = archiveTracks
  }

  return {
    playlistId,
    playlistName: playlistId === OPM_PLAYLIST_ID ? OPM_PLAYLIST_NAME : playlistId,
    totalTracks: archiveTracks.length || trackIds.length,
    tracks: tracks.slice(0, MAX_PLAYLIST_TRACKS),
    source: 'archive-fallback',
  }
}

export function discoverNewOpmArtists(
  tracks: SpotifyTrackRef[],
  artistCountries: Map<string, string | null> = new Map(),
): string[] {
  const knownNormalized = new Set(UNIQUE_OPM_ARTISTS.map((name) => normalizeName(name)))
  const discovered = new Map<string, string>()

  for (const track of tracks) {
    for (const artist of track.artists ?? []) {
      const name = artist.name?.trim()
      if (!name) continue
      if (knownNormalized.has(normalizeName(name))) continue
      if (isBlockedNonOpmArtist(name)) continue
      if (!isLikelyOpmPlaylistArtist(name, { country: artistCountries.get(artist.id ?? '') })) {
        continue
      }
      discovered.set(normalizeName(name), name)
    }
  }

  return [...discovered.values()].sort((a, b) => a.localeCompare(b))
}
