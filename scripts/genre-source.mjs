import { isOpmSpotifyTrack } from './opm-artists.mjs'
import {
  fetchPlaylistTracks,
  OPM_PLAYLIST_ID,
  OPM_PLAYLIST_NAME,
  spotifyGet,
} from './fetch-playlist-tracks.mjs'

const MARKET = 'PH'
export const OPM_CATEGORY_ID = '0JQ5DAqbMKFA1LbJas9hqy'

export const KNOWN_OPM_PLAYLISTS = [{ id: OPM_PLAYLIST_ID, name: OPM_PLAYLIST_NAME }]

const SEARCH_FALLBACKS = [
  { query: 'genre:opm', source: 'search-genre-opm' },
  { query: 'tag:filipino', source: 'search-tag-filipino' },
]

function mergePlaylists(...groups) {
  const byId = new Map()
  for (const group of groups) {
    for (const playlist of group) {
      const id = playlist?.id?.trim()
      if (!id || byId.has(id)) continue
      byId.set(id, { id, name: playlist.name || id })
    }
  }
  return [...byId.values()]
}

function readPlaylistItems(items) {
  if (!Array.isArray(items)) return []
  return items
    .filter((item) => item?.id)
    .map((item) => ({ id: item.id, name: item.name ?? item.id }))
}

function errorStatus(error) {
  return error?.status
}

function isDiscoverFallbackStatus(status) {
  return status === 403 || status === 404 || status === 429
}

async function fetchBrowseCategoryPlaylists(spotifyGet, categoryId) {
  let categoryName
  try {
    const category = await spotifyGet(`browse/categories/${categoryId}`, {
      market: MARKET,
      country: MARKET,
    })
    categoryName = category.name
  } catch (error) {
    const status = errorStatus(error)
    if (isDiscoverFallbackStatus(status)) throw error
  }

  const playlists = []
  let offset = 0
  const limit = 50

  while (offset < 200) {
    const data = await spotifyGet(`browse/categories/${categoryId}/playlists`, {
      limit,
      offset,
      market: MARKET,
      country: MARKET,
    })
    const page = readPlaylistItems(data.playlists?.items)
    playlists.push(...page)
    offset += limit
    const total = data.playlists?.total ?? playlists.length
    if (page.length === 0 || offset >= total) break
  }

  return { playlists, categoryName }
}

async function searchPlaylists(spotifyGet, query) {
  const data = await spotifyGet('search', {
    q: query,
    type: 'playlist',
    market: MARKET,
    limit: 50,
  })
  return readPlaylistItems(data.playlists?.items)
}

export async function fetchCategoryPlaylists(token, categoryId = OPM_CATEGORY_ID) {
  const get = (path, params) => spotifyGet(token, path, params)
  const known = KNOWN_OPM_PLAYLISTS.map((playlist) => ({ ...playlist }))

  try {
    const browsed = await fetchBrowseCategoryPlaylists(get, categoryId)
    if (browsed.playlists.length > 0) {
      return {
        playlists: mergePlaylists(known, browsed.playlists),
        source: 'browse-category',
        categoryName: browsed.categoryName,
      }
    }
  } catch (error) {
    const status = errorStatus(error)
    if (!isDiscoverFallbackStatus(status)) throw error
  }

  for (const fallback of SEARCH_FALLBACKS) {
    try {
      const searched = await searchPlaylists(get, fallback.query)
      if (searched.length > 0) {
        return {
          playlists: mergePlaylists(known, searched),
          source: fallback.source,
        }
      }
    } catch (error) {
      const status = errorStatus(error)
      if (!isDiscoverFallbackStatus(status)) throw error
    }
  }

  return {
    playlists: known,
    source: 'known-playlists',
  }
}

export function isNewOpmTrack(track, existingIds) {
  return Boolean(track?.id && !existingIds.has(track.id) && isOpmSpotifyTrack(track))
}

export async function fetchNewOpmTracksFromPlaylist(token, playlist, existingIds) {
  const result = await fetchPlaylistTracks(token, playlist.id)
  const newOpmTracks = result.tracks.filter((track) => isNewOpmTrack(track, existingIds))

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
