import { useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import type { SearchResult } from '../lib/api'
import type { useSongSearch } from '../hooks/useSongSearch'
import '../song-search.css'

export function SongSuggestions({ id, search, highlight, onHighlight, onSelect, scrollRef }: {
  id: string
  search: ReturnType<typeof useSongSearch>
  highlight: number
  onHighlight: (index: number) => void
  onSelect: (result: SearchResult) => void
  scrollRef: RefObject<HTMLDivElement | null>
}) {
  const panel = useRef<HTMLDivElement>(null)
  const [placement, setPlacement] = useState({ above: false, height: 340, left: 0, width: 0 })
  useLayoutEffect(() => {
    const place = (event?: Event) => {
      if (event?.target instanceof Node && panel.current?.contains(event.target)) return
      const anchor = panel.current?.parentElement?.getBoundingClientRect()
      if (!anchor) return
      const viewport = window.visualViewport
      const top = viewport?.offsetTop ?? 0
      const bottom = top + (viewport?.height ?? window.innerHeight)
      const below = bottom - anchor.bottom - 38
      const above = anchor.top - top - 38
      const openAbove = below < 300 && above > below
      const height = Math.max(80, Math.min(340, openAbove ? above : below))
      // On narrow screens use the whole transport row, so track names do not
      // get squeezed between the play and skip buttons.
      const dock = window.innerWidth < 600 ? panel.current?.closest('.transport-row, .match-controls')?.getBoundingClientRect() : null
      const left = dock ? dock.left - anchor.left : 0
      const width = dock?.width ?? anchor.width
      setPlacement(current => current.above === openAbove && current.height === height && current.left === left && current.width === width
        ? current : { above: openAbove, height, left, width })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    window.visualViewport?.addEventListener('resize', place)
    window.visualViewport?.addEventListener('scroll', place)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
      window.visualViewport?.removeEventListener('resize', place)
      window.visualViewport?.removeEventListener('scroll', place)
    }
  }, [])
  return <div ref={panel} className="song-suggestions" data-above={placement.above}
    style={{ '--song-list-height': `${placement.height}px`, left: placement.left, width: placement.width || undefined } as CSSProperties}
    onMouseDown={event => event.preventDefault()}>
    <div className="song-suggestions-scroll" ref={scrollRef}
      onScroll={event => {
        const el = event.currentTarget
        if (!search.error && el.scrollHeight - el.scrollTop - el.clientHeight < 90) void search.loadMore()
      }}>
      <div id={id} role="listbox" aria-label="Song suggestions" aria-busy={search.loading}>
        {search.results.map((result, index) => <button key={result.id} id={`${id}-${result.id}`} type="button" tabIndex={-1}
          role="option" aria-selected={highlight === index} data-option-index={index}
          onMouseMove={() => onHighlight(index)} onClick={() => onSelect(result)}>
          <span className="song-option-art" aria-hidden="true">♫{result.albumArt && <img src={result.albumArt} alt="" loading="lazy" decoding="async" onError={event => { event.currentTarget.hidden = true }} />}</span>
          <span className="song-option-copy"><strong>{result.title}</strong><small>{result.artist}</small></span>
        </button>)}
      </div>
      <div className="song-search-status" role="status" aria-live="polite">
        {search.error ? <><span>Couldn’t load songs.</span><button type="button" onClick={search.retry}>Try again</button></>
          : search.loading ? 'Finding songs…'
          : search.results.length === 0 ? 'No songs match. Try a title or artist.'
          : search.nextOffset !== null ? <button type="button" onClick={() => void search.loadMore()}>Show more · {search.results.length} of {search.total}</button>
          : `${search.total} ${search.total === 1 ? 'song' : 'songs'}`}
      </div>
    </div>
  </div>
}
