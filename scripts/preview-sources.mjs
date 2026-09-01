const MARKET = 'PH'

export function normalize(value) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function titleMatches(resultTitle, targetTitle) {
  const resultNorm = normalize(resultTitle)
  const targetNorm = normalize(targetTitle)
  return (
    resultNorm === targetNorm ||
    resultNorm.includes(targetNorm) ||
    targetNorm.includes(resultNorm)
  )
}

function artistMatches(resultArtist, targetArtist) {
  const resultNorm = normalize(resultArtist)
  const targetNorm = normalize(targetArtist)
  const targetFirst = targetNorm.split(' ')[0] ?? ''
  const resultFirst = resultNorm.split(' ')[0] ?? ''
  return resultNorm.includes(targetFirst) || targetNorm.includes(resultFirst)
}

export async function fetchItunesPreview(title, artist, market = MARKET) {
  const url = new URL('https://itunes.apple.com/search')
  url.searchParams.set('term', `${artist} ${title}`)
  url.searchParams.set('entity', 'song')
  url.searchParams.set('country', market)
  url.searchParams.set('limit', '5')

  const response = await fetch(url)
  if (!response.ok) return null

  const data = await response.json()

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

export async function fetchDeezerPreview(title, artist) {
  const url = new URL('https://api.deezer.com/search')
  url.searchParams.set('q', `${artist} ${title}`)
  url.searchParams.set('limit', '5')

  const response = await fetch(url)
  if (!response.ok) return null

  const data = await response.json()

  for (const result of data.data ?? []) {
    if (
      titleMatches(result.title ?? '', title) &&
      artistMatches(result.artist?.name ?? '', artist) &&
      result.preview
    ) {
      return result.preview
    }
  }

  return data.data?.[0]?.preview ?? null
}

/**
 * Pick intro vs hook preview URLs from store-provided 30s clips.
 * Deezer previews often start nearer the song intro; iTunes/Spotify clips
 * are frequently chorus excerpts. When only one clip exists, hook mode
 * falls back to a fixed offset inside that clip.
 */
export function pickPreviewSources({ spotify = null, itunes = null, deezer = null } = {}) {
  const introPreviewUrl = deezer ?? spotify ?? itunes ?? null
  const hookPreviewUrl = itunes ?? spotify ?? deezer ?? null

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

export async function resolvePreviewSourcesForTrack({ title, artist, spotifyPreviewUrl = null }) {
  const [itunes, deezer] = await Promise.all([
    fetchItunesPreview(title, artist),
    fetchDeezerPreview(title, artist),
  ])

  return pickPreviewSources({
    spotify: spotifyPreviewUrl,
    itunes,
    deezer,
  })
}
