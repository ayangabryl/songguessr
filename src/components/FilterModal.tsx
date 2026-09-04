import { useEffect, useMemo, useState } from 'react'
import { CountryFlag } from '../../shared/country-flag'
import { NotoEmoji } from '../../shared/noto-emoji'
import { countryDisplayName } from '../../shared/iso-countries'
import {
  ERA_LABELS,
  ERA_OPTIONS,
  GENRE_LABELS,
  GENRE_OPTIONS,
  type CatalogKind,
  type CountryCode,
  type EraFilter,
  type GenreFilter,
} from '../lib/filters'
import { fetchCatalogArtists, peekCatalogArtists } from '../lib/api'
import { DIFFICULTY_LABELS } from '../lib/game-state'
import type { CatalogArtist, CatalogCollection, CatalogRegion, Difficulty } from '../lib/api'

function singerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((part) => part.charAt(0).toUpperCase()).join('') || '?'
}

function singerFaceUrl(url?: string | null): string | null {
  if (!url) return null
  if (!/^https:\/\//i.test(url)) return null
  return url
}

function singersMatching(artists: CatalogArtist[], query: string): CatalogArtist[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return artists
  return artists.filter((hit) => hit.name.toLowerCase().includes(needle))
}

interface FilterModalProps {
  variant?: 'desk' | 'sheet'
  open: boolean
  difficulty: Difficulty
  draftEras: EraFilter[]
  draftGenres: GenreFilter[]
  draftCountries: CountryCode[]
  draftCollections: CatalogKind[]
  draftArtists: string[]
  regions: CatalogRegion[]
  collections: CatalogCollection[]
  previewCount: number
  previewReady?: boolean
  onClose: () => void
  onToggleEra: (era: EraFilter) => void
  onToggleGenre: (genre: GenreFilter) => void
  onToggleRegion: (country: CountryCode) => void
  onToggleCollection: (id: CatalogKind) => void
  onToggleArtist: (name: string) => void
  onRemoveArtist: (name: string) => void
  onClearEras: () => void
  onClearGenres: () => void
  onClearRegions: () => void
  onClearCollections: () => void
  onClearAll: () => void
  onApply: () => void
}

export function FilterModal({
  variant = 'sheet',
  open,
  difficulty,
  draftEras,
  draftGenres,
  draftCountries,
  draftCollections,
  draftArtists,
  regions,
  collections,
  previewCount,
  previewReady = true,
  onClose,
  onToggleEra,
  onToggleGenre,
  onToggleRegion,
  onToggleCollection,
  onToggleArtist,
  onRemoveArtist,
  onClearEras,
  onClearGenres,
  onClearRegions,
  onClearCollections,
  onClearAll,
  onApply,
}: FilterModalProps) {
  const [countryQuery, setCountryQuery] = useState('')
  const [singerQuery, setSingerQuery] = useState('')
  const [singerHits, setSingerHits] = useState<CatalogArtist[]>(() => peekCatalogArtists('') ?? [])
  const [showSingerWait, setShowSingerWait] = useState(false)
  const [singerLookup, setSingerLookup] = useState(false)

  useEffect(() => {
    if (!open) {
      setCountryQuery('')
      setSingerQuery('')
      setShowSingerWait(false)
      setSingerLookup(false)
      return
    }

    if (variant !== 'sheet') return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose, variant])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const exact = peekCatalogArtists(singerQuery)
    const popular = peekCatalogArtists('') ?? []
    const immediate = exact ?? singersMatching(popular, singerQuery)
    const lookingUp = Boolean(singerQuery.trim() && immediate.length === 0 && !exact)
    setSingerLookup(lookingUp)
    if (immediate.length > 0 || singerQuery.trim()) {
      setSingerHits(immediate)
      if (!lookingUp) setShowSingerWait(false)
    }

    let waitTimer: number | null = null
    if (immediate.length === 0) {
      waitTimer = window.setTimeout(() => {
        if (!cancelled) setShowSingerWait(true)
      }, 300)
    }

    const debounce = singerQuery.trim() ? 140 : 0
    const timer = window.setTimeout(() => {
      void fetchCatalogArtists(singerQuery).then((hits) => {
        if (cancelled) return
        setSingerHits(hits)
        setShowSingerWait(false)
        setSingerLookup(false)
      })
    }, debounce)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
      if (waitTimer !== null) window.clearTimeout(waitTimer)
    }
  }, [open, singerQuery])

  const visibleCountries = useMemo(() => {
    const listed = regions.filter((region) => (region.count ?? 0) > 0)
    const normalized = countryQuery.trim().toLowerCase()
    const filtered = normalized
      ? listed.filter((region) => {
          const name = region.label || countryDisplayName(region.country)
          return (
            name.toLowerCase().includes(normalized) ||
            region.country.toLowerCase().includes(normalized)
          )
        })
      : listed
    return [...filtered].sort((left, right) => {
      if (left.country === 'GLOBAL') return -1
      if (right.country === 'GLOBAL') return 1
      return (left.label || countryDisplayName(left.country)).localeCompare(
        right.label || countryDisplayName(right.country),
      )
    })
  }, [regions, countryQuery])

  const selectedArtistKeys = useMemo(
    () => new Set(draftArtists.map((name) => name.toLowerCase())),
    [draftArtists],
  )
  const displayedSingers = useMemo(() => {
    const rows = [...singerHits]
    for (const name of [...draftArtists].reverse()) {
      if (!rows.some((hit) => hit.name.toLowerCase() === name.toLowerCase())) {
        rows.unshift({ name })
      }
    }
    return rows
  }, [singerHits, draftArtists])

  if (!open) return null

  const hasDraftFilters =
    draftEras.length > 0 ||
    draftGenres.length > 0 ||
    draftCountries.length > 0 ||
    draftCollections.length > 0 ||
    draftArtists.length > 0
  const showCountrySearch = regions.filter((region) => (region.count ?? 0) > 0).length > 8
  const emptyPreview = previewReady && previewCount === 0
  const isDesk = variant === 'desk'

  function chooseSinger(name: string) {
    const already = selectedArtistKeys.has(name.toLowerCase())
    onToggleArtist(name)
    if (!already) setSingerQuery('')
  }

  const panel = (
    <>
        <div className="mix-sheet-head">
        <header className="settings-sheet-head">
          <h2 id="filter-title">Mix</h2>
          {isDesk ? null : (
            <button type="button" className="icon-btn sheet-close" onClick={onClose} aria-label="Close mix">
              ×
            </button>
          )}
        </header>

        <p className="filter-count-line">
          {previewReady
            ? `${previewCount} ${previewCount === 1 ? 'song' : 'songs'} in ${DIFFICULTY_LABELS[difficulty]}`
            : 'Counting songs…'}
          {isDesk && hasDraftFilters ? (
            <button type="button" className="filter-clear-inline" onClick={onClearAll}>
              Clear mix
            </button>
          ) : null}
        </p>
        </div>

        <div className="mix-sheet-body">
        <p className="filter-helper">
          {draftArtists.length > 0
            ? `${draftArtists.length === 1 ? '1 singer' : `${draftArtists.length} singers`} in this mix. Search another name to add more.`
            : 'Add as many singers as you like. Search anyone in the catalogue.'}
        </p>

        {hasDraftFilters ? (
          <div className="mix-selected" aria-label="Selected mix">
            {draftArtists.map((name) => (
              <button
                key={`artist-${name}`}
                type="button"
                className="mix-chip is-on"
                onClick={() => onRemoveArtist(name)}
              >
                {name} ×
              </button>
            ))}
            {draftCollections.map((id) => {
              const collection = collections.find((item) => item.id === id)
              return (
                <button
                  key={`col-${id}`}
                  type="button"
                  className="mix-chip is-on"
                  onClick={() => onToggleCollection(id)}
                >
                  {collection?.name ?? id} ×
                </button>
              )
            })}
            {draftEras.map((era) => (
              <button key={`era-${era}`} type="button" className="mix-chip is-on" onClick={() => onToggleEra(era)}>
                {ERA_LABELS[era]} ×
              </button>
            ))}
            {draftGenres.map((genre) => (
              <button
                key={`genre-${genre}`}
                type="button"
                className="mix-chip is-on"
                onClick={() => onToggleGenre(genre)}
              >
                {GENRE_LABELS[genre]} ×
              </button>
            ))}
            {draftCountries.map((country) => (
              <button
                key={`country-${country}`}
                type="button"
                className="mix-chip is-on"
                onClick={() => onToggleRegion(country)}
              >
                {countryDisplayName(country)} ×
              </button>
            ))}
          </div>
        ) : null}

        <fieldset className="filter-group">
          <legend>Collection</legend>
          <div className="filter-options mix-collections">
            <button
              type="button"
              className={draftCollections.length === 0 ? 'selected' : ''}
              aria-pressed={draftCollections.length === 0}
              onClick={onClearCollections}
            >
              All
            </button>
            {collections.map((collection) => {
              const selected = draftCollections.includes(collection.id)
              return (
                <button
                  key={collection.id}
                  type="button"
                  className={selected ? 'selected' : ''}
                  aria-pressed={selected}
                  onClick={() => onToggleCollection(collection.id)}
                >
                  {collection.emoji ? (
                    <NotoEmoji emoji={collection.emoji} className="filter-flag" title={collection.name} />
                  ) : null}
                  <span>{collection.name}</span>
                </button>
              )
            })}
          </div>
        </fieldset>

        <div className="mix-singer-block">
        <label className="mix-search">
          <span className="mix-search-label">Singer</span>
          <input
            type="search"
            className="filter-region-search mix-search-input"
            value={singerQuery}
            onChange={(event) => setSingerQuery(event.target.value)}
            placeholder="Type a name"
            aria-label="Search a singer"
            autoComplete="off"
            enterKeyHint="search"
          />
        </label>

        <div
          className="mix-singers"
          role="listbox"
          aria-label="Singers"
          aria-busy={showSingerWait || singerLookup}
        >
          {showSingerWait && displayedSingers.length === 0 ? (
            <div className="mix-singer-skel" aria-hidden="true">
              <div className="mix-singer mix-singer-skel-row">
                <span className="mix-singer-face is-fallback" />
                <span className="mix-singer-skel-bar" />
              </div>
              <div className="mix-singer mix-singer-skel-row">
                <span className="mix-singer-face is-fallback" />
                <span className="mix-singer-skel-bar" />
              </div>
              <div className="mix-singer mix-singer-skel-row">
                <span className="mix-singer-face is-fallback" />
                <span className="mix-singer-skel-bar" />
              </div>
              <div className="mix-singer mix-singer-skel-row">
                <span className="mix-singer-face is-fallback" />
                <span className="mix-singer-skel-bar" />
              </div>
            </div>
          ) : null}
          {!showSingerWait && !singerLookup && displayedSingers.length === 0 ? (
            <p className="filter-empty" role="status">
              {singerQuery.trim()
                ? 'No singer by that name. Try another spelling.'
                : 'No singers yet. Type a name.'}
            </p>
          ) : (
            displayedSingers.map((hit) => {
              const selected = selectedArtistKeys.has(hit.name.toLowerCase())
              const face = singerFaceUrl(hit.imageUrl)
              return (
                <button
                  key={hit.name}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={selected ? 'mix-singer is-on' : 'mix-singer'}
                  onClick={() => chooseSinger(hit.name)}
                >
                  {face ? (
                    <img className="mix-singer-face" src={face} alt="" width={40} height={40} />
                  ) : (
                    <span className="mix-singer-face is-fallback" aria-hidden="true">
                      {singerInitials(hit.name)}
                    </span>
                  )}
                  <span className="mix-singer-name">{hit.name}</span>
                  {selected ? <span className="mix-singer-mark">In mix</span> : null}
                </button>
              )
            })
          )}
        </div>
        </div>

        <fieldset className="filter-group">
          <legend>Era</legend>
          <div className="filter-options">
            <button
              type="button"
              className={draftEras.length === 0 ? 'selected' : ''}
              aria-pressed={draftEras.length === 0}
              onClick={onClearEras}
            >
              {ERA_LABELS.all}
            </button>
            {ERA_OPTIONS.map((era) => (
              <button
                key={era}
                type="button"
                className={draftEras.includes(era) ? 'selected' : ''}
                aria-pressed={draftEras.includes(era)}
                onClick={() => onToggleEra(era)}
              >
                {ERA_LABELS[era]}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="filter-group">
          <legend>Genre</legend>
          <div className="filter-options">
            <button
              type="button"
              className={draftGenres.length === 0 ? 'selected' : ''}
              aria-pressed={draftGenres.length === 0}
              onClick={onClearGenres}
            >
              {GENRE_LABELS.all}
            </button>
            {GENRE_OPTIONS.map((genre) => (
              <button
                key={genre}
                type="button"
                className={draftGenres.includes(genre) ? 'selected' : ''}
                aria-pressed={draftGenres.includes(genre)}
                onClick={() => onToggleGenre(genre)}
              >
                {GENRE_LABELS[genre]}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="filter-group">
          <legend>Country</legend>
          {showCountrySearch ? (
            <input
              type="search"
              className="filter-region-search"
              value={countryQuery}
              onChange={(event) => setCountryQuery(event.target.value)}
              placeholder="Search countries"
              aria-label="Search countries"
            />
          ) : null}
          <div className="filter-options">
            <button
              type="button"
              className={draftCountries.length === 0 ? 'selected' : ''}
              aria-pressed={draftCountries.length === 0}
              onClick={onClearRegions}
            >
              All
            </button>
            {visibleCountries.map((region) => {
              const selected = draftCountries.includes(region.country)
              return (
                <button
                  key={region.country}
                  type="button"
                  className={selected ? 'selected' : ''}
                  aria-pressed={selected}
                  onClick={() => onToggleRegion(region.country)}
                >
                  <CountryFlag
                    code={region.country}
                    className="filter-flag"
                    title={region.label}
                  />
                  <span>{region.label || countryDisplayName(region.country)}</span>
                </button>
              )
            })}
          </div>
        </fieldset>

        {emptyPreview ? (
          <p className="filter-empty" role="status">
            No songs match. Clear a chip and try again.
          </p>
        ) : null}
        </div>

        {isDesk ? null : (
          <div className="filter-footer mix-sheet-foot">
            <button type="button" className="filter-clear" disabled={!hasDraftFilters} onClick={onClearAll}>
              Clear mix
            </button>
            <button type="button" className="filter-done" disabled={emptyPreview} onClick={onApply}>
              Done
            </button>
          </div>
        )}
    </>
  )

  if (isDesk) {
    return (
      <aside className="mix-desk filter-sheet mix-sheet" role="region" aria-labelledby="filter-title">
        {panel}
      </aside>
    )
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div
        className="filter-sheet mix-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="filter-title"
        onClick={(event) => event.stopPropagation()}
      >
        {panel}
      </div>
    </div>
  )
}
