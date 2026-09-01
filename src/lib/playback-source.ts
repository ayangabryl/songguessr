import type { GameRound } from './api'
import type { StartMode } from './game-state'

const DEFAULT_HOOK_OFFSET_SECONDS = 12

/** Deezer CDN tokens often 403 when played outside deezer.com. */
function isReliablePreviewUrl(url: string | undefined): url is string {
  return Boolean(url && !url.includes('dzcdn.net'))
}

function pickPreviewOnlySource(
  round: Pick<GameRound, 'previewUrl' | 'hookPreviewUrl'>,
): { url: string | undefined; offsetSeconds: number } {
  const candidates = [round.previewUrl, round.hookPreviewUrl].filter(Boolean) as string[]
  const url = candidates.find(isReliablePreviewUrl) ?? candidates[0]
  return { url, offsetSeconds: 0 }
}

export function hasPlayableAudio(
  round: Pick<GameRound, 'previewUrl' | 'hookPreviewUrl' | 'audioUrl' | 'introClipUrl' | 'hookClipUrl'>,
): boolean {
  return Boolean(
    round.audioUrl ||
      round.introClipUrl ||
      round.hookClipUrl ||
      round.previewUrl ||
      round.hookPreviewUrl,
  )
}

export function resolvePlaybackSource(
  round: GameRound,
  startMode: StartMode,
  options?: { previewOnly?: boolean },
) {
  if (options?.previewOnly) {
    return pickPreviewOnlySource(round)
  }

  const hasHostedAudio = Boolean(round.audioUrl || round.introClipUrl || round.hookClipUrl)

  if (hasHostedAudio) {
    if (startMode === 'hook') {
      if (round.hookClipUrl) {
        return { url: round.hookClipUrl, offsetSeconds: 0 }
      }
      if (round.audioUrl) {
        const hookMs = round.hookStartMs
        const offsetSeconds =
          hookMs != null ? hookMs / 1000 : DEFAULT_HOOK_OFFSET_SECONDS
        return { url: round.audioUrl, offsetSeconds }
      }
    } else {
      if (round.introClipUrl) {
        return { url: round.introClipUrl, offsetSeconds: 0 }
      }
      if (round.audioUrl) {
        const startMs = round.startAtMs ?? 0
        return { url: round.audioUrl, offsetSeconds: startMs / 1000 }
      }
    }
  }

  const usesSeparateHookClip =
    startMode === 'hook' &&
    Boolean(round.hookPreviewUrl) &&
    round.hookPreviewUrl !== round.previewUrl

  const url =
    startMode === 'hook' && round.hookPreviewUrl ? round.hookPreviewUrl : round.previewUrl

  const offsetSeconds =
    startMode === 'intro'
      ? 0
      : usesSeparateHookClip
        ? 0
        : round.hookStartSeconds ?? DEFAULT_HOOK_OFFSET_SECONDS

  return { url, offsetSeconds }
}
