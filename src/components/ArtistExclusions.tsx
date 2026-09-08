import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Search, X, Minus } from 'lucide-react'
import { searchCatalogArtists, peekCatalogArtists, type CatalogArtist } from '../lib/api'
import { scrollSongOption } from '../lib/song-search-scroll'
import { ARTIST_SEARCH_LIMIT } from '../../shared/catalog-artists'

export function ArtistExclusions({ selected, onChange }: { selected: string[]; onChange: (names: string[]) => void }) {
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [hits, setHits] = useState<CatalogArtist[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  const [active, setActive] = useState(-1)
  const [notice, setNotice] = useState('')
  const selectedKeys = new Set(selected.map(name => name.toLowerCase()))
  const limitReached = selected.length >= 50

  useEffect(() => {
    if (!open) return
    let stale = false
    const cached = peekCatalogArtists(query)
    setHits(cached ?? [])
    setLoading(!cached)
    setError(false)
    setActive(-1)
    const timer = window.setTimeout(() => {
      void searchCatalogArtists(query).then(results => {
        if (stale) return
        setHits(results)
        setLoading(false)
      }).catch(() => {
        if (stale) return
        setLoading(false)
        setError(true)
      })
    }, query.trim() && !cached ? 60 : 0)
    return () => { stale = true; window.clearTimeout(timer) }
  }, [query, open, retry])

  function choose(name: string) {
    if (selectedKeys.has(name.toLowerCase()) || limitReached) return
    onChange([...selected, name])
    setNotice(`${name} excluded.`)
    setQuery('')
    setOpen(false)
    input.current?.focus()
  }
  function keyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return
    if (event.key === 'Escape' && open) {
      event.preventDefault(); event.stopPropagation(); setOpen(false); return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) { setOpen(true); return }
      const available = hits.map((hit, i) => selectedKeys.has(hit.name.toLowerCase()) ? -1 : i).filter(i => i >= 0)
      if (!available.length || limitReached) return
      const position = available.indexOf(active)
      const next = event.key === 'ArrowDown'
        ? available[(position + 1) % available.length]
        : available[position <= 0 ? available.length - 1 : position - 1]
      setActive(next)
      scrollSongOption(list.current, next)
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      if (open && active >= 0 && hits[active]) choose(hits[active].name)
    }
  }

  return <div className="artist-exclusions">
    <label className="mix-search-label" htmlFor={id}>Artists to leave out</label>
    <p className="mix-exclusion-help" id={`${id}-help`}>Search and select an artist. Their collaborations are left out too.</p>
    <div className="exclude-picker" data-open={open} onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
    }}>
      <div className="exclude-search-field">
        <Search size={18} aria-hidden="true"/>
        <input ref={input} id={id} role="combobox" aria-autocomplete="list" aria-expanded={open}
          aria-controls={open ? `${id}-list` : undefined} aria-describedby={`${id}-help`}
          aria-activedescendant={open && active >= 0 ? `${id}-option-${active}` : undefined}
          placeholder="Search artists to exclude" autoComplete="off" value={query}
          onFocus={() => setOpen(true)} onKeyDown={keyDown}
          onChange={event => { setQuery(event.target.value); setHits([]); setLoading(true); setActive(-1); setOpen(true) }}/>
        {query && <button type="button" className="exclude-clear" aria-label="Clear artist search" onClick={() => {setQuery(''); input.current?.focus()}}><X size={16}/></button>}
      </div>
      {open && <div className="exclude-results">
        <div className="exclude-results-scroll" ref={list} id={`${id}-list`} role="listbox" aria-label="Artists to exclude" aria-busy={loading}>
          {hits.map((hit, i) => {
            const excluded = selectedKeys.has(hit.name.toLowerCase())
            return <button key={hit.name} type="button" role="option" id={`${id}-option-${i}`} data-option-index={i}
              aria-selected={excluded} aria-disabled={excluded || limitReached} tabIndex={-1}
              className={active === i ? 'exclude-result is-active' : 'exclude-result'}
              onMouseDown={event => event.preventDefault()} onClick={() => choose(hit.name)}>
              <span>{hit.name}</span><small>{excluded ? 'Excluded' : <Minus size={16} aria-label="Exclude"/>}</small>
            </button>
          })}
        </div>
        <div className="exclude-search-status" role="status">
          {loading ? 'Searching artists…' : error ? <span>Couldn’t search artists. <button type="button" onClick={() => setRetry(n => n + 1)}>Try again</button></span>
            : limitReached ? '50 artists excluded. Remove one to add another.'
            : !hits.length ? 'No artists found. Try another name or spelling.'
            : hits.length >= ARTIST_SEARCH_LIMIT ? 'Showing 50 matches. Keep typing to narrow the list.'
            : query.trim() ? `${hits.length} ${hits.length === 1 ? 'artist' : 'artists'} found` : 'Popular artists · type to search the catalog'}
        </div>
      </div>}
    </div>
    {selected.length > 0 && <div className="exclude-selected" aria-label="Excluded artists">
      {selected.map(name => <button type="button" className="exclude-chip" key={name} aria-label={`Remove ${name} from exclusions`}
        onClick={() => {onChange(selected.filter(value => value !== name)); setNotice(`${name} is no longer excluded.`)}}>
        <span>{name}</span><X size={14} aria-hidden="true"/>
      </button>)}
      <button type="button" className="filter-clear-inline" onClick={() => {onChange([]); setNotice('Artist exclusions cleared.')}}>Clear artists</button>
    </div>}
    <span className="sr-only" role="status">{notice}</span>
  </div>
}
