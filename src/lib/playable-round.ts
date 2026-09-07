import { fetchRandomRound, type Difficulty, type GameRound } from './api'
import type { CatalogFilters } from './filters'
import { probeHtmlAudio, warmHtmlPreview } from './audio-playback'
import { resolvePlaybackSource } from './playback-source'

const ATTEMPTS = 5

export async function fetchPlayableRound(
  difficulty: Difficulty,
  filters: CatalogFilters,
  exclude: { excludeTrackIds?: string[]; excludeSongKeys?: string[] } = {},
): Promise<GameRound> {
  const excludeTrackIds = [...(exclude.excludeTrackIds ?? [])]
  const excludeSongKeys = [...(exclude.excludeSongKeys ?? [])]
  let lastError: Error | undefined
  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    try {
      const round = await fetchRandomRound(difficulty, filters, {
        excludeTrackIds,
        excludeSongKeys,
      })
      const source = resolvePlaybackSource(round, 'intro')
      if (source.url && (await probeHtmlAudio(source.url))) {
        warmHtmlPreview(source.url)
        return round
      }
      excludeTrackIds.push(round.trackId)
      if (round.songKey) excludeSongKeys.push(round.songKey)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Could not load a song.')
    }
  }
  throw lastError ?? new Error('Could not find a song that plays.')
}
