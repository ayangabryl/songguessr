import type { GameRound } from './api'
import type { StartMode } from './game-state'
import { audioCandidates, isUnreliableAudioUrl } from '../../shared/playable-audio.ts'

const DEFAULT_HOOK_OFFSET_SECONDS = 12

function pickPreviewOnlySource(
  round: Pick<GameRound, 'previewUrl' | 'hookPreviewUrl'>,
): { url: string | undefined; offsetSeconds: number } {
  const candidates = [round.previewUrl, round.hookPreviewUrl].filter(
    (url): url is string => !isUnreliableAudioUrl(url),
  )
  return { url: candidates[0], offsetSeconds: 0 }
}

export function hasPlayableAudio(
  round: Pick<GameRound, 'previewUrl' | 'hookPreviewUrl' | 'audioUrl' | 'introClipUrl' | 'hookClipUrl'>,
): boolean {
  return audioCandidates(round).length > 0
}

export function resolvePlaybackSource(
  round: GameRound,
  startMode: StartMode,
  options?: { previewOnly?: boolean },
) {
  if (options?.previewOnly) {
    const preview = pickPreviewOnlySource(round)
    if (preview.url) return preview
  }

  const hosted = audioCandidates(round)[0]
  if (hosted) {
    if (startMode === 'hook' && round.hookClipUrl) {
      return { url: round.hookClipUrl, offsetSeconds: 0 }
    }
    if (startMode === 'hook' && round.audioUrl && !round.hookClipUrl) {
      const hookMs = round.hookStartMs
      return {
        url: round.audioUrl,
        offsetSeconds: hookMs != null ? hookMs / 1000 : DEFAULT_HOOK_OFFSET_SECONDS,
      }
    }
    return { url: hosted.url, offsetSeconds: hosted.offset }
  }

  return { url: undefined, offsetSeconds: 0 }
}
