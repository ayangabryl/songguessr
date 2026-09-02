import { getHtmlPauseLeadMs, observePauseLatency, startClipTimer, type ClipTimerHandle } from './clip-timer'

const SEEK_TOLERANCE_SECONDS = 0.05
const METADATA_TIMEOUT_MS = 15_000
const SEEK_TIMEOUT_MS = 1_500
const warmedPreviewUrls = new Set<string>()
const warmAudioElements = new Map<string, HTMLAudioElement>()

export function audioSrcMatches(audio: HTMLAudioElement, url: string): boolean {
  if (!url) return false
  if (!audio.src) return false
  try {
    return audio.src === new URL(url, window.location.href).href
  } catch {
    return audio.src === url
  }
}

/** Decode/warm a preview so the next clip can start without a network wait. */
export function warmHtmlPreview(url: string | undefined): void {
  if (!url || warmedPreviewUrls.has(url)) return
  warmedPreviewUrls.add(url)

  const audio = new Audio()
  audio.preload = 'auto'
  audio.src = url
  audio.load()
  warmAudioElements.set(url, audio)

  if (warmAudioElements.size > 6) {
    const oldest = warmAudioElements.keys().next().value
    if (oldest) warmAudioElements.delete(oldest)
  }
}

export function startTimedHtmlClip(
  audio: HTMLAudioElement,
  options: {
    startSeconds: number
    durationSeconds: number
    onTick?: (elapsedSeconds: number) => void
    onEnd: () => void
  },
): ClipTimerHandle {
  const startSeconds = options.startSeconds
  const durationMs = Math.max(0, options.durationSeconds * 1000)
  const alreadyElapsedMs = Math.max(0, (audio.currentTime - startSeconds) * 1000)
  let finished = false

  const halt = () => {
    if (finished) return
    finished = true
    const pauseStartedAt = performance.now()
    audio.pause()
    observePauseLatency('html', performance.now() - pauseStartedAt)
    options.onEnd()
  }

  const timer = startClipTimer({
    durationMs,
    alreadyElapsedMs,
    pauseLeadMs: getHtmlPauseLeadMs(),
    getMediaElapsedMs: () => Math.max(0, (audio.currentTime - startSeconds) * 1000),
    onTick: (elapsedMs) => options.onTick?.(elapsedMs / 1000),
    onEnd: halt,
  })

  return {
    abort: () => {
      timer.abort()
      if (finished) return
      finished = true
      audio.pause()
    },
  }
}

export async function waitForAudioMetadata(audio: HTMLAudioElement): Promise<void> {
  if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) return

  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup()
      reject(new Error('Audio metadata timed out.'))
    }, METADATA_TIMEOUT_MS)

    const onLoaded = () => {
      cleanup()
      resolve()
    }

    const onError = () => {
      cleanup()
      reject(new Error('Audio could not be loaded.'))
    }

    const cleanup = () => {
      window.clearTimeout(timeout)
      audio.removeEventListener('loadedmetadata', onLoaded)
      audio.removeEventListener('error', onError)
    }

    audio.addEventListener('loadedmetadata', onLoaded, { once: true })
    audio.addEventListener('error', onError, { once: true })
    audio.load()
  })
}

export async function seekAudio(audio: HTMLAudioElement, time: number, force = false): Promise<void> {
  const target = Math.max(0, time)
  if (
    !force &&
    !audio.seeking &&
    Math.abs(audio.currentTime - target) < SEEK_TOLERANCE_SECONDS
  ) {
    return
  }

  await new Promise<void>((resolve) => {
    let timeout: number | undefined

    const finish = () => {
      if (timeout !== undefined) window.clearTimeout(timeout)
      audio.removeEventListener('seeked', finish)
      audio.removeEventListener('error', finish)
      resolve()
    }

    timeout = window.setTimeout(finish, SEEK_TIMEOUT_MS)
    audio.addEventListener('seeked', finish, { once: true })
    audio.addEventListener('error', finish, { once: true })
    audio.currentTime = target
  })
}

export function clampPlaybackStart(
  startSeconds: number,
  duration: number,
): number {
  if (!Number.isFinite(duration) || duration <= 0) return Math.max(0, startSeconds)
  return Math.min(Math.max(0, startSeconds), Math.max(0, duration - 0.05))
}
