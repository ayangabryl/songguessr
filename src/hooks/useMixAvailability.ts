import { useEffect, useState } from 'react'
import { fetchAvailability, type Difficulty } from '../lib/api'
import { filtersToSearchParams, type CatalogFilters } from '../lib/filters'

const levels: Difficulty[] = ['easy', 'medium', 'hard', 'expert', 'impossible']

/** A count belongs to one draft only; old responses cannot enable Apply. */
export function useMixAvailability(filters: CatalogFilters, requested: Difficulty, enabled = true) {
  const [attempt, setAttempt] = useState(0)
  const key = `${requested}:${attempt}:${filtersToSearchParams(filters)}`
  const [result, setResult] = useState({key: '', count: 0, total: 0, difficulty: requested, error: false})
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    void fetchAvailability(filters, controller.signal).then(({counts}) => {
      if (controller.signal.aborted) return
      const difficulty = counts[requested] > 0 ? requested : levels.find(level => counts[level] > 0) ?? requested
      setResult({key, count: counts[difficulty] ?? 0, total: levels.reduce((sum, level) => sum + (counts[level] ?? 0), 0), difficulty, error: false})
    }).catch(() => {
      if (!controller.signal.aborted) setResult({key, count: 0, total: 0, difficulty: requested, error: true})
    })
    return () => controller.abort()
  }, [key, filters, requested, enabled])
  const ready = enabled && result.key === key
  return {ready, total: ready ? result.total : 0, count: ready ? result.count : 0, error: ready && result.error,
    difficulty: ready ? result.difficulty : requested, retry: () => setAttempt(n => n + 1)}
}
