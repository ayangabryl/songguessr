import { foldSearchText, rankSearchHits } from '../../shared/search-text.ts'
import type { SearchPage, SearchResult } from './api'

export const songSearchKey = (query: string) => foldSearchText(query.slice(0, 200))

/** Bounded metadata only. Partial local suggestions never claim a complete count. */
export function createSongSearchCache(now = Date.now) {
  const pages = new Map<string, { page: SearchPage; expires: number }>()
  const known = new Map<string, { row: SearchResult; expires: number }>()
  const ttl = 60_000
  const pageKey = (query: string, offset: number) => JSON.stringify([songSearchKey(query), offset])
  return {
    get(query: string, offset = 0) {
      const key = pageKey(query, offset), entry = pages.get(key)
      if (!entry) return null
      if (entry.expires <= now()) { pages.delete(key); return null }
      pages.delete(key); pages.set(key, entry)
      return entry.page
    },
    put(query: string, offset: number, page: SearchPage) {
      const key = pageKey(query, offset), expires = now() + ttl
      pages.delete(key); pages.set(key, { page, expires })
      if (pages.size > 80) pages.delete(pages.keys().next().value!)
      for (const row of page.results) { known.delete(row.id); known.set(row.id, { row, expires }) }
      while (known.size > 400) known.delete(known.keys().next().value!)
    },
    preview(query: string): SearchPage {
      const rows = [...known.values()].filter(entry => entry.expires > now()).map(entry => entry.row)
      const results = rankSearchHits(query, rows, row => row.title, row => row.artist).slice(0, 40)
      return { results, total: results.length, nextOffset: null }
    },
  }
}

export const songSearchCache = createSongSearchCache()
