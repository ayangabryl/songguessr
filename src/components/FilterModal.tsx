import { useEffect, useMemo, useState } from 'react'
import { CountryFlag } from '../../shared/country-flag'
import { NotoEmoji } from '../../shared/noto-emoji'
import { countryDisplayName } from '../../shared/iso-countries'
import {
  ERA_LABELS,
  ERA_OPTIONS,
  GENRE_LABELS,
  GENRE_OPTIONS,
  REGION_LABELS,
  type CatalogKind,
  type CountryCode,
  type EraFilter,
  type GenreFilter,
} from '../lib/filters'
import { DIFFICULTY_LABELS } from '../lib/game-state'
import type { CatalogCollection, CatalogRegion, Difficulty } from '../lib/api'
import { FilterIcon } from './Icons'

interface FilterModalProps {
  open: boolean
  difficulty: Difficulty
  draftEras: EraFilter[]
  draftGenres: GenreFilter[]
  draftCountries: CountryCode[]
  draftCollections: CatalogKind[]
  regions: CatalogRegion[]
  collections: CatalogCollection[]
  previewCount: number
  onClose: () => void
  onToggleEra: (era: EraFilter) => void
  onToggleGenre: (genre: GenreFilter) => void
  onToggleRegion: (country: CountryCode) => void
  onToggleCollection: (id: CatalogKind) => void
  onClearEras: () => void
  onClearGenres: () => void
  onClearRegions: () => void
  onClearCollections: () => void
  onClearAll: () => void
  onApply: () => void
}

export function FilterModal({
  open,
  difficulty,
  draftEras,
  draftGenres,
  draftCountries,
  draftCollections,
  regions,
  collections,
  previewCount,
  onClose,
  onToggleEra,
  onToggleGenre,
  onToggleRegion,
  onToggleCollection,
  onClearEras,
  onClearGenres,
  onClearRegions,
  onClearCollections,
  onClearAll,
  onApply,
}: FilterModalProps) {
  const [countryQuery, setCountryQuery] = useState('')

  useEffect(() => {
    if (!open) {
      setCountryQuery('')
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

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

  if (!open) return null

  const hasDraftFilters =
    draftEras.length > 0 ||
    draftGenres.length > 0 ||
    draftCountries.length > 0 ||
    draftCollections.length > 0
  const showCountrySearch = regions.filter((region) => (region.count ?? 0) > 0).length > 8
  const emptyPreview = previewCount === 0

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content filter-modal" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close filters">
          ×
        </button>

        <div className="filter-heading">
          <FilterIcon />
          <div>
            <h2>Filters</h2>
            <p>
              {previewCount} {previewCount === 1 ? 'song' : 'songs'} in{' '}
              {DIFFICULTY_LABELS[difficulty]}
            </p>
          </div>
        </div>

        <p className="filter-helper">
          Country is where it’s from. Collections are playlists like OPM.
        </p>

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
              {REGION_LABELS.all}
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

        <fieldset className="filter-group">
          <legend>Collections</legend>
          <div className="filter-options">
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
                    <NotoEmoji
                      emoji={collection.emoji}
                      className="filter-flag"
                      title={collection.name}
                    />
                  ) : null}
                  <span>{collection.name}</span>
                </button>
              )
            })}
          </div>
        </fieldset>

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

        {emptyPreview ? (
          <p className="filter-empty" role="status">
            No songs match. Clear a filter and try again.
          </p>
        ) : null}

        <div className="filter-footer">
          <button
            type="button"
            className="filter-clear"
            disabled={!hasDraftFilters}
            onClick={onClearAll}
          >
            Clear
          </button>
          <button
            type="button"
            className="filter-done"
            disabled={emptyPreview}
            onClick={onApply}
          >
            Play this mix
          </button>
        </div>
      </div>
    </div>
  )
}
