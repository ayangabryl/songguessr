const STREAK_KEY = 'songguessr-streak-v1'

/** Consecutive songs named correctly. Not a score. */
export type StreakEvent = 'win' | 'lose' | 'miss' | 'skip'

export function nextStreak(current: number, event: StreakEvent): number {
  const count = Math.max(0, Math.floor(current))
  switch (event) {
    case 'win':
      return count + 1
    case 'lose':
      return 0
    case 'miss':
    case 'skip':
      return count
    default: {
      const exhaustive: never = event
      return exhaustive
    }
  }
}

function readCount(): number {
  try {
    const raw = localStorage.getItem(STREAK_KEY)
    const value = raw ? Number(raw) : 0
    if (!Number.isFinite(value) || value <= 0) return 0
    return Math.floor(value)
  } catch {
    return 0
  }
}

export function loadStreak(): number {
  return readCount()
}

export function saveStreak(count: number) {
  try {
    localStorage.setItem(STREAK_KEY, String(Math.max(0, Math.floor(count))))
  } catch {
    // Private mode or quota: keep the in-memory count only.
  }
}

export function incrementStreak(): number {
  const next = nextStreak(readCount(), 'win')
  saveStreak(next)
  return next
}

export function resetStreak(): number {
  const next = nextStreak(readCount(), 'lose')
  saveStreak(next)
  return next
}
