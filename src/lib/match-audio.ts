export type MatchAudioState = 'idle' | 'loading' | 'playing'

/** One owner for preparation, playback and cancellation of a table clip. */
export function createMatchAudioPlayer(audio: HTMLAudioElement, callbacks: {
  state: (state: MatchAudioState) => void
  heard: () => void
  tick?: (seconds: number) => void
  error: (error: unknown) => void
}) {
  let request: AbortController | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  const stop = () => {
    request?.abort()
    request = undefined
    clearTimeout(timer)
    audio.pause()
    callbacks.state('idle')
  }
  function waitFor(event: string, signal: AbortSignal, timeoutMs = 15_000) {
    return new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timeout)
        audio.removeEventListener(event, done)
        audio.removeEventListener('error', failed)
        signal.removeEventListener('abort', aborted)
      }
      const done = () => { cleanup(); resolve() }
      const failed = () => { cleanup(); reject(audio.error ?? new Error('Audio unavailable')) }
      const aborted = () => { cleanup(); reject(new DOMException('Cancelled', 'AbortError')) }
      const timeout = setTimeout(() => { cleanup(); reject(new Error('Audio timed out')) }, timeoutMs)
      audio.addEventListener(event, done, { once: true })
      audio.addEventListener('error', failed, { once: true })
      signal.addEventListener('abort', aborted, { once: true })
      if (signal.aborted) aborted()
    })
  }
  const ended = () => stop()
  const failed = () => { const error = audio.error; stop(); callbacks.error(error) }
  audio.addEventListener('ended', ended)
  audio.addEventListener('error', failed)
  return {
    stop,
    async play(options: { start: number; duration: number; volume: number }) {
      stop()
      const current = new AbortController()
      request = current
      const { signal } = current
      callbacks.state('loading')
      try {
        if (!audio.getAttribute('src')) throw new Error('Missing song audio')
        audio.muted = false
        audio.volume = options.volume
        if (audio.error) audio.load()
        if (audio.readyState < 1) {
          const metadata = waitFor('loadedmetadata', signal)
          audio.load()
          await metadata
        }
        if (signal.aborted) return
        // Never silently seek to the end of a short/invalid source.
        if (Number.isFinite(audio.duration) && options.start >= audio.duration) throw new Error('Clip starts after the song ends')
        if (audio.seeking || Math.abs(audio.currentTime - options.start) > .015) {
          const sought = waitFor('seeked', signal)
          audio.currentTime = options.start
          await sought
        }
        if (signal.aborted) return
        await audio.play()
        // An old play promise must never pause a newer request.
        if (signal.aborted) return
        callbacks.state('playing')
        callbacks.heard()
        const endpoint = options.start + options.duration
        const tick = () => {
          if (signal.aborted) return
          callbacks.tick?.(audio.currentTime)
          const remaining = endpoint - audio.currentTime
          if (remaining <= .008 || audio.ended) { stop(); return }
          // Count decoded song time; buffering must not consume the short clip.
          timer = setTimeout(tick, Math.max(4, Math.min(25, remaining * 1000 - 8)))
        }
        tick()
      } catch (error) {
        if (signal.aborted) return
        stop()
        callbacks.error(error)
      }
    },
    dispose() {
      stop()
      audio.removeEventListener('ended', ended)
      audio.removeEventListener('error', failed)
    },
  }
}
