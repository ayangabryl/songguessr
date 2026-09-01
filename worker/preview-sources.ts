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

  const response = await fetch(url)
  if (!response.ok) return null

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

  return data.results?.[0]?.previewUrl ?? null
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
  const introPreviewUrl = itunes ?? spotify ?? null
  const hookPreviewUrl = itunes ?? spotify ?? null

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
  if (spotifyPreviewUrl) {
    return pickPreviewSources({ spotify: spotifyPreviewUrl })
  }

  const itunes = await fetchItunesPreview(title, artist)
  return pickPreviewSources({ spotify: spotifyPreviewUrl, itunes })
}
