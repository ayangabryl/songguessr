import { useCallback, useEffect, useRef, useState } from 'react'
import { searchTracks, type SearchPage } from '../lib/api'

const EMPTY: SearchPage = { results: [], total: 0, nextOffset: null }

/** Both game modes share cancellation, pagination and recoverable failures. */
export function useSongSearch(query: string, enabled = true) {
  const key = enabled ? query.trim() : ''
  const [state, setState] = useState({ key: '', page: EMPTY, loading: false, error: false })
  const request = useRef<AbortController | null>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    request.current = controller
    if (!key) return () => controller.abort()
    const timer = setTimeout(() => {
      setState({ key, page: EMPTY, loading: true, error: false })
      searchTracks(key, 0, controller.signal).then(page => {
        if (!controller.signal.aborted) setState({ key, page, loading: false, error: false })
      }).catch(() => {
        if (!controller.signal.aborted) setState({ key, page: EMPTY, loading: false, error: true })
      })
    }, 180)
    return () => { clearTimeout(timer); controller.abort() }
  }, [key, attempt])

  const busy = useRef(false)
  const loadMore = useCallback(async () => {
    const controller = request.current
    if (busy.current || state.loading || state.key !== key || state.page.nextOffset === null || !controller || controller.signal.aborted) return
    busy.current = true
    setState(current => ({ ...current, loading: true, error: false }))
    try {
      const next = await searchTracks(key, state.page.nextOffset, controller.signal)
      if (!controller.signal.aborted) setState(current => {
        const ids = new Set(current.page.results.map(row => row.id))
        return { key, page: { ...next, results: [...current.page.results, ...next.results.filter(row => !ids.has(row.id))] }, loading: false, error: false }
      })
    } catch {
      if (!controller.signal.aborted) setState(current => ({ ...current, loading: false, error: true }))
    } finally { busy.current = false }
  }, [key, state])

  const current = state.key === key && key ? state : { key, page: EMPTY, loading: Boolean(key), error: false }
  return {
    ...current.page, loading: current.loading, error: current.error, loadMore,
    retry: () => current.page.nextOffset !== null ? void loadMore() : setAttempt(value => value + 1),
  }
}
