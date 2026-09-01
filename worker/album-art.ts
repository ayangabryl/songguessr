import type { SpotifyTrackRef } from './opm-artists'

const MARKET = 'PH'
export const TRACK_HYDRATE_BATCH = 50

const ITUNES_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

export type SpotifyGet = (
  path: string,
  params?: Record<string, string | number | undefined>,
) => Promise<unknown>

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function titleMatches(resultTitle: string, targetTitle: string): boolean {
  const resultNorm = normalize(resultTitle)
  const targetNorm = normalize(targetTitle)
  if (!resultNorm || !targetNorm) return false
  return (
    resultNorm === targetNorm ||
    resultNorm.includes(targetNorm) ||
    targetNorm.includes(resultNorm)
  )
}

function artistMatches(resultArtist: string, targetArtist: string): boolean {
  const resultNorm = normalize(resultArtist)
  const targetNorm = normalize(targetArtist)
  if (!resultNorm || !targetNorm) return false
  const targetFirst = targetNorm.split(' ')[0] ?? ''
  const resultFirst = resultNorm.split(' ')[0] ?? ''
  return resultNorm.includes(targetFirst) || targetNorm.includes(resultFirst)
}

export function albumArtFromSpotifyTrack(track: SpotifyTrackRef | null | undefined): string {
  for (const image of track?.album?.images ?? []) {
    if (image?.url) return image.url
  }
  return ''
}

export function attachAlbumArt(track: SpotifyTrackRef, albumArt: string): SpotifyTrackRef {
  if (!albumArt || albumArtFromSpotifyTrack(track)) return track
  return {
    ...track,
    album: {
      ...track.album,
      images: [{ url: albumArt }, ...(track.album?.images ?? [])],
    },
  }
}

export function upgradeItunesArtwork(url: string): string {
  return url.replace(/\d+x\d+bb/g, '600x600bb').replace(/\/\d+x\d+(?=[^/]*$)/, '/600x600')
}

export async function fetchSpotifyOembedArtwork(trackId: string): Promise<string | null> {
  if (!trackId) return null
  try {
    const url = `https://open.spotify.com/oembed?url=${encodeURIComponent(
      `https://open.spotify.com/track/${trackId}`,
    )}`
    const response = await fetch(url)
    if (!response.ok) return null
    const data = (await response.json()) as { thumbnail_url?: string }
    const thumb = data.thumbnail_url?.trim()
    if (!thumb) return null
    return thumb.replace('ab67616d00001e02', 'ab67616d0000b273')
  } catch (error) {
    console.warn(
      `[album-art] oEmbed failed for ${trackId}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
    return null
  }
}

export async function fetchItunesArtwork(
  title: string,
  artist: string,
  market = MARKET,
): Promise<string | null> {
  const term = `${artist} ${title}`.trim()
  if (!term) return null

  const url = new URL('https://itunes.apple.com/search')
  url.searchParams.set('term', term)
  url.searchParams.set('entity', 'song')
  url.searchParams.set('country', market)
  url.searchParams.set('limit', '5')

  let response: Response
  try {
    response = await fetch(url, {
      headers: {
        'User-Agent': ITUNES_USER_AGENT,
        Accept: 'application/json',
      },
    })
  } catch (error) {
    console.warn(
      `[album-art] iTunes network error for "${artist} ${title}": ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
    return null
  }

  if (!response.ok) {
    console.warn(`[album-art] iTunes ${response.status} for "${artist} ${title}"`)
    return null
  }

  const data = (await response.json()) as {
    results?: { trackName?: string; artistName?: string; artworkUrl100?: string }[]
  }

  for (const result of data.results ?? []) {
    if (
      titleMatches(result.trackName ?? '', title) &&
      artistMatches(result.artistName ?? '', artist) &&
      result.artworkUrl100
    ) {
      return upgradeItunesArtwork(result.artworkUrl100)
    }
  }

  const fallback = data.results?.[0]?.artworkUrl100
  return fallback ? upgradeItunesArtwork(fallback) : null
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function fetchSpotifyTracksByIds(
  spotifyGet: SpotifyGet,
  trackIds: string[],
  market = MARKET,
): Promise<SpotifyTrackRef[]> {
  const tracks: SpotifyTrackRef[] = []
  const retryIds: string[] = []

  for (let index = 0; index < trackIds.length; index += TRACK_HYDRATE_BATCH) {
    const batch = trackIds.slice(index, index + TRACK_HYDRATE_BATCH)
    try {
      const data = (await spotifyGet('tracks', {
        ids: batch.join(','),
        market,
      })) as { tracks?: (SpotifyTrackRef | null)[] }

      const found = new Set<string>()
      for (const track of data.tracks ?? []) {
        if (track?.id) {
          tracks.push(track)
          found.add(track.id)
        }
      }
      for (const id of batch) {
        if (!found.has(id)) retryIds.push(id)
      }
    } catch (error) {
      const status = (error as { status?: number }).status
      if (status === 403 || status === 404 || status === 429) {
        console.warn(`[album-art] Batch GET /tracks?ids= blocked (${status}); trying one by one`)
        retryIds.push(...batch)
        continue
      }
      throw error
    }
  }

  for (const id of retryIds) {
    try {
      const track = (await spotifyGet(`tracks/${id}`, { market })) as SpotifyTrackRef | null
      if (track?.id) tracks.push(track)
      await sleep(150)
    } catch (error) {
      const status = (error as { status?: number }).status
      if (status === 429) {
        console.warn('[album-art] GET /tracks/{id} rate limited; remaining IDs use iTunes fallback')
        break
      }
      if (status === 403 || status === 404) {
        console.warn(`[album-art] GET /tracks/${id} blocked (${status})`)
        continue
      }
      throw error
    }
  }

  return tracks
}

function mergeHydratedTrack(stub: SpotifyTrackRef, full: SpotifyTrackRef): SpotifyTrackRef {
  return {
    ...full,
    preview_url: full.preview_url ?? stub.preview_url ?? null,
    name: full.name || stub.name,
    artists: full.artists?.length ? full.artists : stub.artists,
    album: {
      ...stub.album,
      ...full.album,
      images: full.album?.images?.length ? full.album.images : stub.album?.images,
      release_date: full.album?.release_date ?? stub.album?.release_date,
    },
  }
}

export async function hydrateTrackRefsWithAlbumArt(
  spotifyGet: SpotifyGet,
  stubs: SpotifyTrackRef[],
  market = MARKET,
): Promise<SpotifyTrackRef[]> {
  const trackIds = stubs.map((track) => track.id).filter((id): id is string => Boolean(id))
  let hydrated: SpotifyTrackRef[] = []

  try {
    hydrated = await fetchSpotifyTracksByIds(spotifyGet, trackIds, market)
  } catch (error) {
    const status = (error as { status?: number }).status
    if (status !== 403 && status !== 404 && status !== 429) {
      throw error
    }
    console.warn('[album-art] Spotify track hydration blocked; trying iTunes artwork')
  }

  const byId = new Map(
    hydrated
      .filter((track): track is SpotifyTrackRef & { id: string } => Boolean(track.id))
      .map((track) => [track.id, track]),
  )

  const merged = stubs.map((stub) => {
    const full = stub.id ? byId.get(stub.id) : undefined
    return full ? mergeHydratedTrack(stub, full) : stub
  })

  const result: SpotifyTrackRef[] = []
  for (const track of merged) {
    if (albumArtFromSpotifyTrack(track)) {
      result.push(track)
      continue
    }

    const artist = (track.artists ?? []).map((item) => item.name).join(', ')
    const oembedArt = track.id ? await fetchSpotifyOembedArtwork(track.id) : null
    const artwork =
      oembedArt || (await fetchItunesArtwork(track.name ?? '', artist, market))
    result.push(artwork ? attachAlbumArt(track, artwork) : track)
  }

  return result
}
