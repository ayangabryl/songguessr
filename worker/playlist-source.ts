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

const PLAYLIST_ARCHIVE_URL =
  'https://raw.githubusercontent.com/mackorone/spotify-playlist-archive/main/playlists/pretty/37i9dQZEVXbNBz9cRCSFkY.md'

const MARKET = 'PH'

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

    while (true) {
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
    const status = (error as { status?: number }).status
    if (playlistId === OPM_PLAYLIST_ID && (status === 403 || status === 404)) {
      return fetchPlaylistFromArchive(spotifyGet, market)
    }
    throw error
  }
}

function parseArchiveTrackIds(text: string): string[] {
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
    const data = (await spotifyGet('tracks', {
      ids: batch.join(','),
      market,
    })) as { tracks?: (SpotifyTrackRef | null)[] }

    for (const track of data.tracks ?? []) {
      if (track?.id) tracks.push(track)
    }
  }

  return tracks
}

async function fetchPlaylistFromArchive(
  spotifyGet: (
    path: string,
    params?: Record<string, string | number | undefined>,
  ) => Promise<unknown>,
  market = MARKET,
): Promise<PlaylistFetchResult> {
  console.warn('[playlist] Editorial playlist blocked; using archive track IDs.')

  const response = await fetch(PLAYLIST_ARCHIVE_URL)
  if (!response.ok) {
    throw new Error(`Archive fallback failed: ${response.status}`)
  }

  const trackIds = parseArchiveTrackIds(await response.text())
  const tracks = await fetchFullTracksByIds(spotifyGet, trackIds, market)

  return {
    playlistId: OPM_PLAYLIST_ID,
    playlistName: OPM_PLAYLIST_NAME,
    totalTracks: trackIds.length,
    tracks,
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
