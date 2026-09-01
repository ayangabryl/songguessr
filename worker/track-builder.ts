import { isOpmSpotifyTrack, type SpotifyTrackRef } from './opm-artists'
import { resolvePreviewSourcesForTrack } from './preview-sources'
import type { Difficulty, GenreFilter, Track } from './types'

function assignDifficulty(popularity: number, index: number): Difficulty {
  if (popularity >= 70) return 'easy'
  if (popularity >= 55) return 'medium'
  if (popularity >= 40) return 'hard'
  if (popularity >= 25) return 'expert'
  if (popularity > 0) return 'impossible'

  const levels: Difficulty[] = ['easy', 'medium', 'hard', 'expert', 'impossible']
  return levels[index % levels.length]
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

function parseReleaseYear(releaseDate?: string): number | undefined {
  if (!releaseDate) return undefined
  const year = Number.parseInt(String(releaseDate).slice(0, 4), 10)
  return Number.isInteger(year) ? year : undefined
}

export async function buildTrackFromSpotify(
  spotifyTrack: SpotifyTrackRef,
  index = 0,
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

  const track: Track = {
    id: spotifyTrack.id,
    title: spotifyTrack.name ?? 'Unknown',
    artist,
    previewUrl: previews.previewUrl,
    ...(previews.hookPreviewUrl ? { hookPreviewUrl: previews.hookPreviewUrl } : {}),
    hookStartSeconds: previews.hookStartSeconds,
    albumArt: spotifyTrack.album?.images?.[0]?.url ?? '',
    difficulty: assignDifficulty(spotifyTrack.popularity ?? 0, index),
    releaseYear: parseReleaseYear(spotifyTrack.album?.release_date),
    genreGroups: inferGenreGroups(artist, spotifyTrack.name ?? ''),
  }

  return { track }
}
