import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { searchTracks, type SearchPage } from '../lib/api'
import { getSongSearchCache, songSearchKey } from '../lib/song-search-cache'

const EMPTY: SearchPage = { results: [], total: 0, nextOffset: null }

/** Both game modes share cancellation, pagination and recoverable failures. */
export function useSongSearch(query: string, enabled = true, playlistId?:string) {
  const needle=enabled?songSearchKey(query):''
  const key=needle?JSON.stringify([playlistId??'',needle]):''
  const cache=useMemo(()=>getSongSearchCache(playlistId),[playlistId])
  const [state, setState] = useState({ key: '', page: EMPTY, loading: false, error: false })
  const request = useRef<AbortController | null>(null)
  const [attempt, setAttempt] = useState(0)
  const immediate = useMemo(() => {
    const cached = key ? cache.get(needle) : null
    return { page: cached ?? (key ? cache.preview(needle) : EMPTY), complete: Boolean(cached) }
  }, [key,needle,cache])
  useEffect(() => {
    const controller = new AbortController()
    request.current = controller
    if (!key) return () => controller.abort()
    if (immediate.complete) {
      setState({ key, page: immediate.page, loading: false, error: false })
      return () => controller.abort()
    }
    const timer = setTimeout(() => {
      setState({ key, page: immediate.page, loading: true, error: false })
      searchTracks(needle, 0, controller.signal, playlistId).then(page => {
        if (!controller.signal.aborted) setState({ key, page, loading: false, error: false })
      }).catch(() => {
        if (!controller.signal.aborted) setState({ key, page: immediate.page, loading: false, error: true })
      })
    }, 60)
    return () => { clearTimeout(timer); controller.abort() }
  }, [key, needle, playlistId, attempt, immediate])

  const busy = useRef(false)
  const loadMore = useCallback(async () => {
    const controller = request.current
    if (busy.current || state.loading || state.key !== key || state.page.nextOffset === null || !controller || controller.signal.aborted) return
    busy.current = true
    setState(current => ({ ...current, loading: true, error: false }))
    try {
      const next = await searchTracks(needle, state.page.nextOffset, controller.signal, playlistId)
      if (!controller.signal.aborted) setState(current => {
        const ids = new Set(current.page.results.map(row => row.id))
        return { key, page: { ...next, results: [...current.page.results, ...next.results.filter(row => !ids.has(row.id))] }, loading: false, error: false }
      })
    } catch {
      if (!controller.signal.aborted) setState(current => ({ ...current, loading: false, error: true }))
    } finally { busy.current = false }
  }, [key, needle, playlistId, state])

  const current = state.key === key && key ? state : { key, page: immediate.page, loading: Boolean(key) && !immediate.complete, error: false }
  return {
    ...current.page, loading: current.loading, error: current.error, loadMore,
    retry: () => current.page.nextOffset !== null ? void loadMore() : setAttempt(value => value + 1),
  }
}
