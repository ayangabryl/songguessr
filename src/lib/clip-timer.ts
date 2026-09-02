export const MIN_PAUSE_LEAD_MS = 8
export const MAX_PAUSE_LEAD_MS = 90
export const DEFAULT_SPOTIFY_PAUSE_LEAD_MS = 36
export const DEFAULT_HTML_PAUSE_LEAD_MS = 8
export const MAX_ASSUMED_DETECTION_LAG_MS = 400

let spotifyPauseLeadMs = DEFAULT_SPOTIFY_PAUSE_LEAD_MS
let htmlPauseLeadMs = DEFAULT_HTML_PAUSE_LEAD_MS

export interface ClipTimerClock {
  now: () => number
  setTimeout: (fn: () => void, ms: number) => number
  clearTimeout: (id: number) => void
  raf: (fn: () => void) => number
  cancelRaf: (id: number) => void
}

export interface ClipTimerHandle {
  abort: () => void
}

export interface StartClipTimerOptions {
  durationMs: number
  alreadyElapsedMs?: number
  pauseLeadMs: number
  getMediaElapsedMs?: () => number
  onTick?: (elapsedMs: number) => void
  onEnd: () => void
  clock?: ClipTimerClock
}

function browserClock(): ClipTimerClock {
  return {
    now: () => performance.now(),
    setTimeout: (fn, ms) => window.setTimeout(fn, ms),
    clearTimeout: (id) => window.clearTimeout(id),
    raf: (fn) => window.requestAnimationFrame(fn),
    cancelRaf: (id) => window.cancelAnimationFrame(id),
  }
}

export function getSpotifyPauseLeadMs(): number {
  return spotifyPauseLeadMs
}

export function getHtmlPauseLeadMs(): number {
  return htmlPauseLeadMs
}

export function resetPauseLeadForTests(): void {
  spotifyPauseLeadMs = DEFAULT_SPOTIFY_PAUSE_LEAD_MS
  htmlPauseLeadMs = DEFAULT_HTML_PAUSE_LEAD_MS
}

/** Keep pause-lead inside a measured band so short clips are not guessed wildly. */
export function observePauseLatency(kind: 'spotify' | 'html', observedMs: number): number {
  const clamped = Math.min(MAX_PAUSE_LEAD_MS, Math.max(MIN_PAUSE_LEAD_MS, observedMs))
  if (kind === 'spotify') {
    spotifyPauseLeadMs = spotifyPauseLeadMs * 0.72 + clamped * 0.28
    return spotifyPauseLeadMs
  }
  htmlPauseLeadMs = htmlPauseLeadMs * 0.72 + clamped * 0.28
  return htmlPauseLeadMs
}

export function effectivePauseLeadMs(durationMs: number, pauseLeadMs: number): number {
  if (durationMs <= 0) return 0
  return Math.min(Math.max(0, pauseLeadMs), durationMs * 0.45)
}

export function clipPauseDelayMs(
  durationMs: number,
  alreadyElapsedMs: number,
  pauseLeadMs: number,
): number {
  const lead = effectivePauseLeadMs(durationMs, pauseLeadMs)
  return Math.max(0, durationMs - Math.max(0, alreadyElapsedMs) - lead)
}

/**
 * SDK position is coarse and often still 0 when audio has already started.
 * If position has not advanced, treat capped detection lag as elapsed audio.
 */
export function assumedElapsedMs(options: {
  mediaElapsedMs: number
  detectionLagMs: number
  maxAssumedMs?: number
}): number {
  const media = Math.max(0, options.mediaElapsedMs)
  if (media >= 25) return media
  const lag = Math.min(options.maxAssumedMs ?? MAX_ASSUMED_DETECTION_LAG_MS, Math.max(0, options.detectionLagMs))
  return Math.max(media, lag)
}

export function startClipTimer(options: StartClipTimerOptions): ClipTimerHandle {
  const clock = options.clock ?? browserClock()
  const durationMs = Math.max(0, options.durationMs)
  const alreadyElapsedMs = Math.max(0, options.alreadyElapsedMs ?? 0)
  const pauseLeadMs = effectivePauseLeadMs(durationMs, options.pauseLeadMs)
  const startedAt = clock.now()
  const delayMs = clipPauseDelayMs(durationMs, alreadyElapsedMs, options.pauseLeadMs)

  let ended = false
  let rafId = 0
  let timeoutId = 0

  const readElapsed = (): number => {
    const wall = alreadyElapsedMs + Math.max(0, clock.now() - startedAt)
    const media = options.getMediaElapsedMs?.()
    const elapsed = media == null ? wall : Math.max(wall, media)
    return Math.min(durationMs, elapsed)
  }

  const finish = () => {
    if (ended) return
    ended = true
    clock.clearTimeout(timeoutId)
    clock.cancelRaf(rafId)
    options.onTick?.(durationMs)
    options.onEnd()
  }

  const tick = () => {
    if (ended) return
    const elapsed = readElapsed()
    options.onTick?.(elapsed)
    if (elapsed >= durationMs - pauseLeadMs) {
      finish()
      return
    }
    rafId = clock.raf(tick)
  }

  timeoutId = clock.setTimeout(finish, delayMs)
  rafId = clock.raf(tick)

  return {
    abort: () => {
      if (ended) return
      ended = true
      clock.clearTimeout(timeoutId)
      clock.cancelRaf(rafId)
    },
  }
}
