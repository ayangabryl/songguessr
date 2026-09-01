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

const PLAYLIST_ARCHIVE_BASES = [
  'https://raw.githubusercontent.com/mackorone/spotify-playlist-archive/main/playlists/pretty',
  'https://raw.githubusercontent.com/mackorone/spotify-playlist-archive-2/main/playlists/pretty',
] as const

const MARKET = 'PH'
const EMBED_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

export const PRIVATE_PLAYLIST_ERROR =
  'This playlist is private or blocked by Spotify. Try a public user playlist.'

export type PlaylistTrackSource = 'spotify-api' | 'archive-fallback' | 'embed-fallback'

type SpotifyGet = (
  path: string,
  params?: Record<string, string | number | undefined>,
) => Promise<unknown>

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

  const withoutQuery = trimmed.split(/[?#]/)[0] ?? trimmed

  const uriMatch = withoutQuery.match(/^spotify:playlist:([A-Za-z0-9]+)$/i)
  if (uriMatch?.[1]) return uriMatch[1]

  if (/^[A-Za-z0-9]{10,34}$/.test(withoutQuery)) return withoutQuery

  return null
}

function playlistArchiveUrls(playlistId: string): string[] {
  const file = `${encodeURIComponent(playlistId)}.md`
  return PLAYLIST_ARCHIVE_BASES.map((base) => `${base}/${file}`)
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
  source: PlaylistTrackSource
}

export async function fetchPlaylistTracks(
  spotifyGet: SpotifyGet,
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
      return fetchPlaylistViaPublicFallbacks(spotifyGet, playlistId, market)
    }
    throw error
  }
}

async function fetchPlaylistViaPublicFallbacks(
  spotifyGet: SpotifyGet,
  playlistId: string,
  market = MARKET,
): Promise<PlaylistFetchResult> {
  try {
    return await fetchPlaylistFromEmbed(spotifyGet, playlistId, market)
  } catch (embedError) {
    console.warn(
      `[playlist] Embed fallback failed for ${playlistId}: ${
        embedError instanceof Error ? embedError.message : String(embedError)
      }`,
    )
  }

  try {
    return await fetchPlaylistFromArchive(spotifyGet, playlistId, market)
  } catch (archiveError) {
    console.warn(
      `[playlist] Archive fallback failed for ${playlistId}: ${
        archiveError instanceof Error ? archiveError.message : String(archiveError)
      }`,
    )
  }

  throw Object.assign(new Error(PRIVATE_PLAYLIST_ERROR), { status: 404 })
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

function parseSubtitleArtists(subtitle: string): { name: string }[] {
  return subtitle
    .replace(/\u00a0/g, ' ')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => ({ name }))
}

function parseArchivePlaylistName(markdown: string): string | null {
  const heading = markdown.match(/^###\s*\[([^\]]+)\]/m)
  if (!heading?.[1]) return null
  const name = unescapeArchiveText(heading[1])
  return name || null
}

function mergeTrackMetadata(
  stubs: SpotifyTrackRef[],
  hydrated: SpotifyTrackRef[],
): SpotifyTrackRef[] {
  if (hydrated.length === 0) return stubs
  const byId = new Map(
    hydrated
      .filter((track): track is SpotifyTrackRef & { id: string } => Boolean(track.id))
      .map((track) => [track.id, track]),
  )

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

async function fetchOembedPlaylistName(playlistId: string): Promise<string | null> {
  try {
    const url = `https://open.spotify.com/oembed?url=${encodeURIComponent(
      `https://open.spotify.com/playlist/${playlistId}`,
    )}`
    const response = await fetch(url)
    if (!response.ok) return null
    const data = (await response.json()) as { title?: string }
    return data.title?.trim() || null
  } catch {
    return null
  }
}

async function resolvePlaylistDisplayName(
  playlistId: string,
  candidates: Array<string | null | undefined>,
): Promise<string> {
  for (const candidate of candidates) {
    const name = candidate?.trim()
    if (name) return name
  }
  if (playlistId === OPM_PLAYLIST_ID) return OPM_PLAYLIST_NAME
  return (await fetchOembedPlaylistName(playlistId)) ?? playlistId
}

async function hydrateTrackRefs(
  spotifyGet: SpotifyGet,
  stubs: SpotifyTrackRef[],
  market = MARKET,
): Promise<SpotifyTrackRef[]> {
  const trackIds = stubs.map((track) => track.id).filter((id): id is string => Boolean(id))
  let hydrated: SpotifyTrackRef[] = []
  try {
    hydrated = await fetchFullTracksByIds(spotifyGet, trackIds, market)
  } catch (error) {
    const status = (error as { status?: number }).status
    if (status !== 403 && status !== 404 && status !== 429) {
      throw error
    }
    console.warn('[playlist] Track hydration blocked; using fallback title/artist metadata.')
  }

  if (hydrated.length === 0 && stubs.length > 0) {
    console.warn('[playlist] Using fallback metadata without Spotify track hydration.')
    return stubs
  }

  return mergeTrackMetadata(stubs, hydrated)
}

async function fetchFullTracksByIds(
  spotifyGet: SpotifyGet,
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

async function fetchArchiveMarkdown(playlistId: string): Promise<string> {
  const statuses: string[] = []
  for (const url of playlistArchiveUrls(playlistId)) {
    const response = await fetch(url)
    if (response.ok) return response.text()
    statuses.push(`${response.status}`)
  }
  throw new Error(`Archive fallback failed: ${statuses.join(', ') || 'no sources'}`)
}

async function fetchPlaylistFromArchive(
  spotifyGet: SpotifyGet,
  playlistId: string,
  market = MARKET,
): Promise<PlaylistFetchResult> {
  console.warn(`[playlist] Editorial playlist ${playlistId} blocked; using archive track IDs.`)

  const markdown = await fetchArchiveMarkdown(playlistId)
  const archiveTracks = parseArchiveTracks(markdown).slice(0, MAX_PLAYLIST_TRACKS)
  if (archiveTracks.length === 0) {
    const fallbackIds = parseArchiveTrackIds(markdown).slice(0, MAX_PLAYLIST_TRACKS)
    if (fallbackIds.length === 0) {
      throw new Error('Archive fallback failed: no tracks')
    }
    archiveTracks.push(...fallbackIds.map((id) => ({ id, name: '', artists: [] })))
  }

  const tracks = await hydrateTrackRefs(spotifyGet, archiveTracks, market)

  return {
    playlistId,
    playlistName: await resolvePlaylistDisplayName(playlistId, [
      parseArchivePlaylistName(markdown),
    ]),
    totalTracks: archiveTracks.length,
    tracks: tracks.slice(0, MAX_PLAYLIST_TRACKS),
    source: 'archive-fallback',
  }
}

interface EmbedTrackItem {
  uri?: string
  title?: string
  subtitle?: string
  audioPreview?: { url?: string }
}

interface EmbedEntity {
  name?: string
  title?: string
  trackList?: EmbedTrackItem[]
}

function parseEmbedTracks(entity: EmbedEntity | undefined): SpotifyTrackRef[] {
  const tracks: SpotifyTrackRef[] = []
  const seen = new Set<string>()

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

async function fetchPlaylistFromEmbed(
  spotifyGet: SpotifyGet,
  playlistId: string,
  market = MARKET,
): Promise<PlaylistFetchResult> {
  console.warn(`[playlist] Trying public embed snapshot for ${playlistId}.`)

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

  let entity: EmbedEntity | undefined
  try {
    const data = JSON.parse(match[1]) as {
      props?: { pageProps?: { state?: { data?: { entity?: EmbedEntity } } } }
    }
    entity = data.props?.pageProps?.state?.data?.entity
  } catch {
    throw new Error('Embed fallback failed: invalid playlist data')
  }

  const embedTracks = parseEmbedTracks(entity).slice(0, MAX_PLAYLIST_TRACKS)
  if (embedTracks.length === 0) {
    throw new Error('Embed fallback failed: no tracks')
  }

  const tracks = await hydrateTrackRefs(spotifyGet, embedTracks, market)

  return {
    playlistId,
    playlistName: await resolvePlaylistDisplayName(playlistId, [entity?.name, entity?.title]),
    totalTracks: embedTracks.length,
    tracks: tracks.slice(0, MAX_PLAYLIST_TRACKS),
    source: 'embed-fallback',
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
