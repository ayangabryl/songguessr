import { isOpmSpotifyTrack, type SpotifyTrackRef } from './opm-artists'
import {
  fetchPlaylistTracks,
  OPM_PLAYLIST_ID,
  OPM_PLAYLIST_NAME,
  type PlaylistTrackSource,
} from './playlist-source'

const MARKET = 'PH'
export const OPM_CATEGORY_ID = '0JQ5DAqbMKFA1LbJas9hqy'

/** Official / known OPM-heavy playlists used when browse categories are blocked. */
export const KNOWN_OPM_PLAYLISTS: readonly { id: string; name: string }[] = [
  { id: OPM_PLAYLIST_ID, name: OPM_PLAYLIST_NAME },
]

const SEARCH_FALLBACKS = [
  { query: 'genre:opm', source: 'search-genre-opm' },
  { query: 'tag:filipino', source: 'search-tag-filipino' },
] as const

export type GenreDiscoverSource =
  | 'browse-category'
  | 'search-genre-opm'
  | 'search-tag-filipino'
  | 'known-playlists'

export type SpotifyGet = (
  path: string,
  params?: Record<string, string | number | undefined>,
) => Promise<unknown>

export interface CategoryPlaylist {
  id: string
  name: string
}

export interface DiscoverPlaylistsResult {
  playlists: CategoryPlaylist[]
  source: GenreDiscoverSource
  categoryName?: string
}

function playlistKey(id: string): string {
  return id.trim()
}

function mergePlaylists(...groups: CategoryPlaylist[][]): CategoryPlaylist[] {
  const byId = new Map<string, CategoryPlaylist>()
  for (const group of groups) {
    for (const playlist of group) {
      const id = playlistKey(playlist.id)
      if (!id || byId.has(id)) continue
      byId.set(id, { id, name: playlist.name || id })
    }
  }
  return [...byId.values()]
}

function readPlaylistItems(items: unknown): CategoryPlaylist[] {
  if (!Array.isArray(items)) return []
  const playlists: CategoryPlaylist[] = []
  for (const item of items) {
    const playlist = item as { id?: string; name?: string } | null
    if (playlist?.id) {
      playlists.push({ id: playlist.id, name: playlist.name ?? playlist.id })
    }
  }
  return playlists
}

function errorStatus(error: unknown): number | undefined {
  return (error as { status?: number }).status
}

function isDiscoverFallbackStatus(status: number | undefined): boolean {
  return status === 403 || status === 404 || status === 429
}

async function fetchBrowseCategoryPlaylists(
  spotifyGet: SpotifyGet,
  categoryId: string,
): Promise<{ playlists: CategoryPlaylist[]; categoryName?: string }> {
  let categoryName: string | undefined
  try {
    const category = (await spotifyGet(`browse/categories/${categoryId}`, {
      market: MARKET,
      country: MARKET,
    })) as { name?: string }
    categoryName = category.name
  } catch (error) {
    const status = errorStatus(error)
    if (isDiscoverFallbackStatus(status)) {
      throw error
    }
  }

  const playlists: CategoryPlaylist[] = []
  let offset = 0
  const limit = 50

  while (offset < 200) {
    const data = (await spotifyGet(`browse/categories/${categoryId}/playlists`, {
      limit,
      offset,
      market: MARKET,
      country: MARKET,
    })) as { playlists?: { items?: unknown[]; total?: number } }

    const page = readPlaylistItems(data.playlists?.items)
    playlists.push(...page)
    offset += limit
    const total = data.playlists?.total ?? playlists.length
    if (page.length === 0 || offset >= total) break
  }

  return { playlists, categoryName }
}

async function searchPlaylists(spotifyGet: SpotifyGet, query: string): Promise<CategoryPlaylist[]> {
  const data = (await spotifyGet('search', {
    q: query,
    type: 'playlist',
    market: MARKET,
    limit: 50,
  })) as { playlists?: { items?: unknown[] } }
  return readPlaylistItems(data.playlists?.items)
}

export async function fetchCategoryPlaylists(
  spotifyGet: SpotifyGet,
  categoryId = OPM_CATEGORY_ID,
): Promise<DiscoverPlaylistsResult> {
  const known = KNOWN_OPM_PLAYLISTS.map((playlist) => ({ ...playlist }))

  try {
    const browsed = await fetchBrowseCategoryPlaylists(spotifyGet, categoryId)
    if (browsed.playlists.length > 0) {
      return {
        playlists: mergePlaylists(known, browsed.playlists),
        source: 'browse-category',
        categoryName: browsed.categoryName,
      }
    }
  } catch (error) {
    const status = errorStatus(error)
    if (!isDiscoverFallbackStatus(status)) {
      throw error
    }
  }

  for (const fallback of SEARCH_FALLBACKS) {
    try {
      const searched = await searchPlaylists(spotifyGet, fallback.query)
      if (searched.length > 0) {
        return {
          playlists: mergePlaylists(known, searched),
          source: fallback.source,
        }
      }
    } catch (error) {
      const status = errorStatus(error)
      if (!isDiscoverFallbackStatus(status)) {
        throw error
      }
    }
  }

  return {
    playlists: known,
    source: 'known-playlists',
  }
}

export function isNewOpmTrack(
  track: SpotifyTrackRef | null | undefined,
  existingIds: ReadonlySet<string>,
): track is SpotifyTrackRef {
  return Boolean(track?.id && !existingIds.has(track.id) && isOpmSpotifyTrack(track))
}

export interface GenrePlaylistTracksResult {
  playlist: CategoryPlaylist
  totalTracks: number
  fetchedTracks: number
  newOpmTracks: SpotifyTrackRef[]
  source: PlaylistTrackSource
}

export async function fetchNewOpmTracksFromPlaylist(
  spotifyGet: SpotifyGet,
  playlist: CategoryPlaylist,
  existingIds: ReadonlySet<string>,
): Promise<GenrePlaylistTracksResult> {
  const result = await fetchPlaylistTracks(spotifyGet, playlist.id)
  const newOpmTracks: SpotifyTrackRef[] = []

  for (const track of result.tracks) {
    if (isNewOpmTrack(track, existingIds)) {
      newOpmTracks.push(track)
    }
  }

  return {
    playlist: {
      id: result.playlistId,
      name: result.playlistName || playlist.name,
    },
    totalTracks: result.totalTracks,
    fetchedTracks: result.tracks.length,
    newOpmTracks,
    source: result.source,
  }
}
