import {
  DEFAULT_CATALOG,
  DEFAULT_COUNTRY,
  type CatalogKind,
  type CountryCode,
} from '../shared/catalog-meta'
import {
  albumArtFromSpotifyTrack,
  fetchItunesArtwork,
  fetchSpotifyOembedArtwork,
} from './album-art'
import {
  assignChartDifficulty,
  assignDifficultyFromMetrics,
  parseReleaseYear,
} from './difficulty'
import { isOpmSpotifyTrack, type SpotifyTrackRef } from './opm-artists'
import { resolvePreviewSourcesForTrack } from './preview-sources'
import type { GenreFilter, Track } from './types'

export interface BuildTrackOptions {
  country?: CountryCode
  catalog?: CatalogKind
  chartBoost?: boolean
  requireOpm?: boolean
  artistPopularity?: number
  spotifyGenres?: string[]
}

function inferGenreGroups(artist: string, title: string): GenreFilter[] {
  const haystack = `${artist} ${title}`.toLowerCase()
  const groups: GenreFilter[] = []
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

export async function buildTrackFromSpotify(
  spotifyTrack: SpotifyTrackRef,
  options: BuildTrackOptions = {},
): Promise<{ track: Track | null; reason?: string }> {
  if (!spotifyTrack.id) {
    return { track: null, reason: 'Track has no Spotify ID' }
  }

  if (options.requireOpm !== false && !isOpmSpotifyTrack(spotifyTrack)) {
    return { track: null, reason: 'Artist is not on our OPM list' }
  }

  const artist = (spotifyTrack.artists ?? []).map((item) => item.name).join(', ')
  const previews = await resolvePreviewSourcesForTrack({
    title: spotifyTrack.name ?? '',
    artist,
    spotifyPreviewUrl: spotifyTrack.preview_url ?? null,
  })

  if (!previews.previewUrl) {
    return { track: null, reason: 'No preview URL available for this track' }
  }

  const releaseDate = spotifyTrack.album?.release_date
  const releaseYear = parseReleaseYear(releaseDate)
  const popularity = spotifyTrack.popularity
  const artistPopularity = options.artistPopularity
  const albumArt =
    albumArtFromSpotifyTrack(spotifyTrack) ||
    (await fetchSpotifyOembedArtwork(spotifyTrack.id)) ||
    (await fetchItunesArtwork(spotifyTrack.name ?? '', artist)) ||
    ''

  const chartBoost = options.chartBoost === true
  const difficulty = chartBoost
    ? assignChartDifficulty({
        popularity: popularity ?? 0,
        artistPopularity,
        artistName: artist,
      })
    : assignDifficultyFromMetrics({
        popularity: popularity ?? 0,
        artistPopularity,
        releaseYear,
      })

  const track: Track = {
    id: spotifyTrack.id,
    title: spotifyTrack.name ?? 'Unknown',
    artist,
    previewUrl: previews.previewUrl,
    ...(previews.hookPreviewUrl ? { hookPreviewUrl: previews.hookPreviewUrl } : {}),
    hookStartSeconds: previews.hookStartSeconds,
    albumArt,
    difficulty,
    releaseYear,
    releaseDate: releaseDate || undefined,
    genreGroups: inferGenreGroups(artist, spotifyTrack.name ?? ''),
    spotifyGenres: options.spotifyGenres,
    popularity,
    artistPopularity: options.artistPopularity,
    durationMs: spotifyTrack.duration_ms,
    country: options.country ?? DEFAULT_COUNTRY,
    catalog: options.catalog ?? DEFAULT_CATALOG,
    chartBoost,
    ...(chartBoost ? { forceTier: difficulty } : {}),
  }

  return { track }
}
