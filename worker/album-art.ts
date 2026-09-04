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

export interface SpotifyOembed {
  title?: string
  authorName?: string
  thumbnailUrl?: string
}

export async function fetchSpotifyOembed(trackId: string): Promise<SpotifyOembed | null> {
  if (!trackId) return null
  try {
    const url = `https://open.spotify.com/oembed?url=${encodeURIComponent(
      `https://open.spotify.com/track/${trackId}`,
    )}`
    const response = await fetch(url)
    if (!response.ok) return null
    const data = (await response.json()) as {
      title?: string
      author_name?: string
      thumbnail_url?: string
    }
    const thumb = data.thumbnail_url?.trim()
    return {
      title: data.title?.trim() || undefined,
      authorName: data.author_name?.trim() || undefined,
      thumbnailUrl: thumb ? thumb.replace('ab67616d00001e02', 'ab67616d0000b273') : undefined,
    }
  } catch (error) {
    console.warn(
      `[album-art] oEmbed failed for ${trackId}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
    return null
  }
}

export async function fetchSpotifyOembedArtwork(trackId: string): Promise<string | null> {
  const oembed = await fetchSpotifyOembed(trackId)
  return oembed?.thumbnailUrl ?? null
}

/** Spotify artist profile files. Album covers are `ab67616d`; iTunes is never a face. */
export function isSpotifyArtistPortrait(url: string | null | undefined): boolean {
  return Boolean(url && /ab676161/i.test(url))
}

function pickArtistPortrait(urls: Array<string | null | undefined>): string | null {
  for (const url of urls) {
    const trimmed = url?.trim()
    if (trimmed && isSpotifyArtistPortrait(trimmed)) return trimmed
  }
  return null
}

export async function fetchSpotifyArtistOembed(artistId: string): Promise<string | null> {
  if (!/^[0-9A-Za-z]{22}$/.test(artistId)) return null
  try {
    const url = `https://open.spotify.com/oembed?url=${encodeURIComponent(
      `https://open.spotify.com/artist/${artistId}`,
    )}`
    const response = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': ITUNES_USER_AGENT },
    })
    if (!response.ok) return null
    const data = (await response.json()) as { thumbnail_url?: string }
    return pickArtistPortrait([data.thumbnail_url])
  } catch {
    return null
  }
}

/** Public embed page, same path as listen counts. No Web API key. */
export async function fetchSpotifyArtistEmbedImage(artistId: string): Promise<string | null> {
  if (!/^[0-9A-Za-z]{22}$/.test(artistId)) return null
  try {
    const response = await fetch(`https://open.spotify.com/embed/artist/${encodeURIComponent(artistId)}`, {
      headers: { Accept: 'text/html', 'User-Agent': ITUNES_USER_AGENT },
    })
    if (!response.ok) return null
    const html = await response.text()
    const next = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
    if (next?.[1]) {
      try {
        const data = JSON.parse(next[1]) as {
          props?: {
            pageProps?: {
              state?: {
                data?: {
                  entity?: {
                    visualIdentity?: {
                      image?: Array<{ url?: string; maxHeight?: number; maxWidth?: number }>
                    }
                  }
                }
              }
            }
          }
        }
        const images = data.props?.pageProps?.state?.data?.entity?.visualIdentity?.image ?? []
        const ranked = [...images].sort((left, right) => {
          const leftSize = Math.max(left.maxHeight ?? 0, left.maxWidth ?? 0)
          const rightSize = Math.max(right.maxHeight ?? 0, right.maxWidth ?? 0)
          return rightSize - leftSize
        })
        const fromIdentity = pickArtistPortrait(ranked.map((image) => image.url))
        if (fromIdentity) return fromIdentity
      } catch {
        // Fall through to URL harvest.
      }
    }
    const harvested = [
      ...html.matchAll(
        /https:\/\/(?:i\.scdn\.co|image-cdn-[a-z0-9-]+\.spotifycdn\.com)\/image\/ab676161[0-9a-f]+/gi,
      ),
    ].map((match) => match[0])
    return pickArtistPortrait(harvested)
  } catch {
    return null
  }
}

export async function fetchItunesArtistArtwork(artist: string, market = MARKET): Promise<string | null> {
  const term = artist.trim()
  if (!term) return null
  try {
    const url = new URL('https://itunes.apple.com/search')
    url.searchParams.set('term', term)
    url.searchParams.set('entity', 'album')
    url.searchParams.set('attribute', 'artistTerm')
    url.searchParams.set('country', market)
    url.searchParams.set('limit', '1')
    const response = await fetch(url.toString(), {
      headers: { 'User-Agent': ITUNES_USER_AGENT, Accept: 'application/json' },
    })
    if (!response.ok) return null
    const data = (await response.json()) as { results?: Array<{ artworkUrl100?: string }> }
    const art = data.results?.[0]?.artworkUrl100?.trim()
    return art ? upgradeItunesArtwork(art) : null
  } catch {
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
