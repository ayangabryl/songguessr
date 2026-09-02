const STREAK_KEY = 'songguessr-streak-v1'

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
  const next = readCount() + 1
  saveStreak(next)
  return next
}

export function resetStreak(): number {
  saveStreak(0)
  return 0
}
