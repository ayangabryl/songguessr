import { PlaylistMix } from './PlaylistMix'
import type { PlaylistMix as PlaylistSelection } from '../../shared/playlist-mix'
import { ArtistExclusions } from './ArtistExclusions'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useModalFocus } from '../hooks/useModalFocus'
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
import { fetchCatalogArtists, isArtistPortrait, peekCatalogArtists } from '../lib/api'
import { mergeSingerRows } from '../../shared/catalog-artists'
import { DIFFICULTY_LABELS } from '../lib/game-state'
import type { CatalogArtist, CatalogCollection, CatalogRegion, Difficulty } from '../lib/api'

function singerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((part) => part.charAt(0).toUpperCase()).join('') || '?'
}

function singerFaceUrl(url?: string | null): string | null {
  if (!url) return null
  if (!/^https:\/\//i.test(url)) return null
  // Only a portrait is a face. Album art borrowed from one of the artist's
  // tracks is a different singer's picture as often as it is theirs.
  if (!isArtistPortrait(url)) return null
  return url
}

function singersMatching(artists: CatalogArtist[], query: string): CatalogArtist[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return artists
  return artists.filter((hit) => hit.name.toLowerCase().includes(needle))
}

interface FilterModalProps {
  playlist?: PlaylistSelection
  onPlaylist?: (value?:PlaylistSelection) => void
  excludedArtists?: string[]
  excludedGenres?: GenreFilter[]
  onExclusions?: (artists: string[], genres: GenreFilter[]) => void
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
  allDifficulties?: boolean
  previewDifficulty?: Difficulty
  previewCount: number
  previewReady?: boolean
  previewError?: boolean
  onRetryPreview?: () => void
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
  playlist, onPlaylist,
  excludedArtists = [], excludedGenres = [], onExclusions,
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
  previewDifficulty = difficulty, allDifficulties = false,
  previewReady = true,
  previewError = false, onRetryPreview,
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
  const [playlistPending, setPlaylistPending] = useState(false)
  const [playlistAdded, setPlaylistAdded] = useState(false)
  const [playlistReset, setPlaylistReset] = useState(0)
  function clearMix() { setPlaylistAdded(false); setPlaylistReset(n => n + 1); setPlaylistPending(false); onClearAll() }
  const [countryQuery, setCountryQuery] = useState('')
  const [singerQuery, setSingerQuery] = useState('')
  const [singerHits, setSingerHits] = useState<CatalogArtist[]>(() => peekCatalogArtists('') ?? [])
  const [showSingerWait, setShowSingerWait] = useState(false)
  const [singerLookup, setSingerLookup] = useState(false)
  const singerMemory = useRef(new Map<string, CatalogArtist>())
  const panelRef = useRef<HTMLDivElement>(null)
  useModalFocus(open && variant === 'sheet', panelRef, onClose)

  useEffect(() => {
    if (!open) {
      setCountryQuery('')
      setSingerQuery('')
      setShowSingerWait(false)
      setSingerLookup(false)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const exact = peekCatalogArtists(singerQuery, draftCollections)
    const popular = peekCatalogArtists('', draftCollections) ?? []
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

    const debounce = singerQuery.trim() && !exact ? 60 : 0
    const timer = window.setTimeout(() => {
      void fetchCatalogArtists(singerQuery, draftCollections).then((hits) => {
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
  }, [open, singerQuery, draftCollections])

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

  useEffect(() => {
    for (const hit of singerHits) {
      const key = hit.name.toLowerCase()
      const prev = singerMemory.current.get(key)
      if (isArtistPortrait(hit.imageUrl) || !prev || !isArtistPortrait(prev.imageUrl)) {
        singerMemory.current.set(key, hit)
      }
    }
  }, [singerHits])

  const displayedSingers = useMemo(
    () => mergeSingerRows(singerHits, draftArtists, singerMemory.current),
    [singerHits, draftArtists],
  )

  if (!open) return null

  const hasRefinements =
    draftEras.length > 0 ||
    draftGenres.length > 0 ||
    draftCountries.length > 0 ||
    draftCollections.length > 0 ||
    draftArtists.length > 0 || excludedArtists.length > 0 || excludedGenres.length > 0
  const hasDraftFilters = Boolean(playlist) || playlistPending || hasRefinements
  const showCountrySearch = regions.filter((region) => (region.count ?? 0) > 0).length > 8
  const emptyPreview = !playlistPending && previewReady && !previewError && previewCount === 0
  function usePlaylistOnly() {
    onClearEras(); onClearGenres(); onClearRegions(); onClearCollections()
    for (const name of draftArtists) onRemoveArtist(name)
    onExclusions?.([], [])
  }
  const isDesk = variant === 'desk'

  function chooseSinger(name: string) {
    const already = selectedArtistKeys.has(name.toLowerCase())
    onToggleArtist(name)
    if (!already && onExclusions) onExclusions(excludedArtists.filter(value => value.toLowerCase() !== name.toLowerCase()), excludedGenres)
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
          {playlistPending ? 'Preparing your playlist…' : previewError ? 'Could not count songs.' : previewReady
            ? `${previewCount} ${previewCount === 1 ? 'song' : 'songs'} ${allDifficulties ? 'across all difficulties' : `in ${DIFFICULTY_LABELS[previewDifficulty]}`}`
            : 'Counting songs…'}
          {isDesk && hasDraftFilters ? (
            <button type="button" className="filter-clear-inline" onClick={clearMix}>
              Clear mix
            </button>
          ) : null}
        </p>
        </div>

        <div className="mix-sheet-body">
        {previewError && <p className="filter-empty" role="alert">Check your connection and <button className="playlist-cancel" type="button" onClick={onRetryPreview}>try again</button>.</p>}
        {onPlaylist && <PlaylistMix key={`${playlist?.id ?? 'empty'}-${playlistReset}`} value={playlist} ready={playlistAdded && previewReady && !previewError && previewCount > 0 && !playlistPending} onChange={value=>{setPlaylistAdded(Boolean(value));onPlaylist(value)}} onPending={setPlaylistPending}/>}
        <p className="filter-helper">
          {draftArtists.length > 0
            ? `${draftArtists.length === 1 ? '1 artist' : `${draftArtists.length} artists`} in this mix. Search another name to add more.`
            : 'Choose what to hear, or leave out artists and genres below.'}
        </p>

        {draftArtists.length + draftCollections.length + draftEras.length + draftGenres.length + draftCountries.length > 0 ? (
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
                onClick={() => {
                  onToggleGenre(genre)
                  if (!draftGenres.includes(genre) && onExclusions) onExclusions(excludedArtists, excludedGenres.filter(value => value !== genre))
                }}
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
          <span className="mix-search-label">Artists to include</span>
          <input
            type="search"
            className="filter-region-search mix-search-input"
            value={singerQuery}
            onChange={(event) => setSingerQuery(event.target.value)}
            placeholder="Type a name"
            aria-label="Search artists to include"
            autoComplete="off"
            enterKeyHint="search"
          />
        </label>

        <div
          className="mix-singers"
          role="listbox"
          aria-label="Artists to include"
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
                ? 'No artist by that name. Try another spelling.'
                : 'No artists yet. Type a name.'}
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
                onClick={() => {
                  onToggleGenre(genre)
                  if (!draftGenres.includes(genre) && onExclusions) onExclusions(excludedArtists, excludedGenres.filter(value => value !== genre))
                }}
              >
                {GENRE_LABELS[genre]}
              </button>
            ))}
          </div>
        </fieldset>

        {onExclusions && (
          <fieldset className="filter-group mix-exclusions">
            <legend>Exclude from your mix</legend>
            <ArtistExclusions selected={excludedArtists} onChange={names => {
              for (const name of draftArtists) {
                if (names.some(excluded => excluded.toLowerCase() === name.toLowerCase())) onRemoveArtist(name)
              }
              onExclusions(names, excludedGenres)
            }}/>
            <span className="mix-search-label">Genres to leave out</span>
            <div className="filter-options" role="group" aria-label="Genres to exclude">
              {GENRE_OPTIONS.map(genre => {
                const selected = excludedGenres.includes(genre)
                return (
                  <button
                    key={genre}
                    type="button"
                    className={selected ? 'selected' : ''}
                    aria-label={`Exclude ${GENRE_LABELS[genre]}`}
                    aria-pressed={selected}
                    onClick={() => {
                      if (!selected && draftGenres.includes(genre)) onToggleGenre(genre)
                      onExclusions(excludedArtists, selected
                        ? excludedGenres.filter(value => value !== genre)
                        : [...excludedGenres, genre])
                    }}
                  >
                    {GENRE_LABELS[genre]}{selected && <span aria-hidden="true"> ×</span>}
                  </button>
                )
              })}
            </div>
          </fieldset>
        )}
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
            {playlist ? hasRefinements ? 'Your filters exclude every song in this playlist.' : 'No playable songs are available. Refresh this playlist to check again.' : 'No songs match these filters. Clear a filter and try again.'}
            {isDesk && playlist && hasRefinements && <button type="button" className="playlist-refresh" onClick={usePlaylistOnly}>Use playlist only</button>}
          </p>
        ) : null}
        </div>

        {isDesk ? null : (
          <div className="filter-footer mix-sheet-foot">
            {(playlistPending || !previewReady || previewError || emptyPreview || previewDifficulty !== difficulty) && <p className="mix-apply-status" role="status">
              {playlistPending ? 'Finish playlist setup to apply your mix.' : !previewReady ? 'Checking your mix…' : previewError ? 'The song count is unavailable. Try again above.' : emptyPreview ? playlist && !hasRefinements ? 'Refresh this playlist to check its songs.' : 'No songs match these filters.' : `This mix will use ${DIFFICULTY_LABELS[previewDifficulty]}.`}
              {emptyPreview && playlist && hasRefinements && <button type="button" className="mix-recover" onClick={usePlaylistOnly}>Use playlist only</button>}
            </p>}
            <button type="button" className="filter-clear" disabled={!hasDraftFilters} onClick={clearMix}>
              Clear mix
            </button>
            <button type="button" className="filter-done" disabled={emptyPreview || previewError || playlistPending || !previewReady} onClick={onApply}>
              Apply mix
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
        ref={panelRef}
        className="filter-sheet mix-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="filter-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        {panel}
      </div>
    </div>
  )
}
