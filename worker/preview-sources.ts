const MARKET = 'PH'

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
  return (
    resultNorm === targetNorm ||
    resultNorm.includes(targetNorm) ||
    targetNorm.includes(resultNorm)
  )
}

function artistMatches(resultArtist: string, targetArtist: string): boolean {
  const resultNorm = normalize(resultArtist)
  const targetNorm = normalize(targetArtist)
  const targetFirst = targetNorm.split(' ')[0] ?? ''
  const resultFirst = resultNorm.split(' ')[0] ?? ''
  return resultNorm.includes(targetFirst) || targetNorm.includes(resultFirst)
}

export async function fetchItunesPreview(
  title: string,
  artist: string,
  market = MARKET,
): Promise<string | null> {
  const url = new URL('https://itunes.apple.com/search')
  url.searchParams.set('term', `${artist} ${title}`)
  url.searchParams.set('entity', 'song')
  url.searchParams.set('country', market)
  url.searchParams.set('limit', '5')

  let response: Response
  try {
    response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'application/json',
      },
    })
  } catch (error) {
    console.warn(
      `[preview] iTunes network error for "${artist} ${title}": ${error instanceof Error ? error.message : String(error)}`,
    )
    return null
  }
  if (!response.ok) {
    console.warn(`[preview] iTunes ${response.status} for "${artist} ${title}"`)
    return null
  }

  const data = (await response.json()) as {
    results?: { trackName?: string; artistName?: string; previewUrl?: string }[]
  }

  for (const result of data.results ?? []) {
    if (
      titleMatches(result.trackName ?? '', title) &&
      artistMatches(result.artistName ?? '', artist) &&
      result.previewUrl
    ) {
      return result.previewUrl
    }
  }

  const fallback = data.results?.[0]?.previewUrl ?? null
  if (!fallback) {
    console.warn(
      `[preview] iTunes returned ${data.results?.length ?? 0} results without a preview for "${artist} ${title}"`,
    )
  }
  return fallback
}

export function isOfficialPreviewUrl(url: string | null | undefined): url is string {
  if (!url) return false
  const lower = url.toLowerCase()
  return !lower.includes('dzcdn.net') && !lower.includes('deezer.com')
}

export function pickPreviewSources({
  spotify = null,
  itunes = null,
}: {
  spotify?: string | null
  itunes?: string | null
} = {}): {
  previewUrl: string | null
  hookPreviewUrl?: string
  hookStartSeconds: number
} {
  const officialSpotify = isOfficialPreviewUrl(spotify) ? spotify : null
  const officialItunes = isOfficialPreviewUrl(itunes) ? itunes : null
  const introPreviewUrl = officialItunes ?? officialSpotify ?? null
  const hookPreviewUrl = officialItunes ?? officialSpotify ?? null

  if (!introPreviewUrl) {
    return {
      previewUrl: null,
      hookPreviewUrl: undefined,
      hookStartSeconds: 12,
    }
  }

  if (hookPreviewUrl && hookPreviewUrl !== introPreviewUrl) {
    return {
      previewUrl: introPreviewUrl,
      hookPreviewUrl,
      hookStartSeconds: 0,
    }
  }

  return {
    previewUrl: introPreviewUrl,
    hookPreviewUrl: undefined,
    hookStartSeconds: 12,
  }
}

export async function resolvePreviewSourcesForTrack({
  title,
  artist,
  spotifyPreviewUrl = null,
}: {
  title: string
  artist: string
  spotifyPreviewUrl?: string | null
}): Promise<{
  previewUrl: string | null
  hookPreviewUrl?: string
  hookStartSeconds: number
}> {
  const officialSpotify = isOfficialPreviewUrl(spotifyPreviewUrl) ? spotifyPreviewUrl : null
  if (officialSpotify) {
    return pickPreviewSources({ spotify: officialSpotify })
  }

  const itunes = await fetchItunesPreview(title, artist)
  return pickPreviewSources({ spotify: officialSpotify, itunes })
}
