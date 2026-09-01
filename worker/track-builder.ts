import {
  albumArtFromSpotifyTrack,
  fetchItunesArtwork,
  fetchSpotifyOembedArtwork,
} from './album-art'
import { assignDifficultyFromMetrics, parseReleaseYear } from './difficulty'
import { isOpmSpotifyTrack, type SpotifyTrackRef } from './opm-artists'
import { resolvePreviewSourcesForTrack } from './preview-sources'
import type { GenreFilter, Track } from './types'

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
): Promise<{ track: Track | null; reason?: string }> {
  if (!spotifyTrack.id) {
    return { track: null, reason: 'Track has no Spotify ID' }
  }

  if (!isOpmSpotifyTrack(spotifyTrack)) {
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

  const releaseYear = parseReleaseYear(spotifyTrack.album?.release_date)
  const popularity = spotifyTrack.popularity ?? 0
  const albumArt =
    albumArtFromSpotifyTrack(spotifyTrack) ||
    (await fetchSpotifyOembedArtwork(spotifyTrack.id)) ||
    (await fetchItunesArtwork(spotifyTrack.name ?? '', artist)) ||
    ''

  const track: Track = {
    id: spotifyTrack.id,
    title: spotifyTrack.name ?? 'Unknown',
    artist,
    previewUrl: previews.previewUrl,
    ...(previews.hookPreviewUrl ? { hookPreviewUrl: previews.hookPreviewUrl } : {}),
    hookStartSeconds: previews.hookStartSeconds,
    albumArt,
    difficulty: assignDifficultyFromMetrics({ popularity, releaseYear }),
    releaseYear,
    genreGroups: inferGenreGroups(artist, spotifyTrack.name ?? ''),
    popularity,
    durationMs: spotifyTrack.duration_ms,
  }

  return { track }
}
