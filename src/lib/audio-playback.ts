const SEEK_TOLERANCE_SECONDS = 0.05
const METADATA_TIMEOUT_MS = 15_000
const SEEK_TIMEOUT_MS = 1_500

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
