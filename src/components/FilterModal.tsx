import { useEffect, useMemo, useState } from 'react'
import { CountryFlag } from '../../shared/country-flag'
import { filterIsoCountries } from '../../shared/iso-countries'
import {
  ERA_LABELS,
  ERA_OPTIONS,
  GENRE_LABELS,
  GENRE_OPTIONS,
  REGION_LABELS,
  type CountryCode,
  type EraFilter,
  type GenreFilter,
} from '../lib/filters'
import { DIFFICULTY_LABELS } from '../lib/game-state'
import type { CatalogRegion, Difficulty } from '../lib/api'
import { FilterIcon } from './Icons'

interface FilterModalProps {
  open: boolean
  difficulty: Difficulty
  draftEras: EraFilter[]
  draftGenres: GenreFilter[]
  draftCountries: CountryCode[]
  regions: CatalogRegion[]
  previewCount: number
  onClose: () => void
  onToggleEra: (era: EraFilter) => void
  onToggleGenre: (genre: GenreFilter) => void
  onToggleRegion: (country: CountryCode) => void
  onClearEras: () => void
  onClearGenres: () => void
  onClearRegions: () => void
  onClearAll: () => void
  onApply: () => void
}

export function FilterModal({
  open,
  difficulty,
  draftEras,
  draftGenres,
  draftCountries,
  regions,
  previewCount,
  onClose,
  onToggleEra,
  onToggleGenre,
  onToggleRegion,
  onClearEras,
  onClearGenres,
  onClearRegions,
  onClearAll,
  onApply,
}: FilterModalProps) {
  const [regionQuery, setRegionQuery] = useState('')

  useEffect(() => {
    if (!open) {
      setRegionQuery('')
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  const countByCountry = useMemo(
    () => new Map(regions.map((region) => [region.country, region.count ?? 0])),
    [regions],
  )
  const visibleCountries = useMemo(() => filterIsoCountries(regionQuery), [regionQuery])

  if (!open) return null

  const hasDraftFilters =
    draftEras.length > 0 || draftGenres.length > 0 || draftCountries.length > 0

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content filter-modal" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close filters">
          ×
        </button>

        <div className="filter-heading">
          <FilterIcon />
          <div>
            <h2>Song filters</h2>
            <p>
              {previewCount} {previewCount === 1 ? 'song' : 'songs'} available in{' '}
              {DIFFICULTY_LABELS[difficulty]}
            </p>
          </div>
        </div>

        <fieldset className="filter-group">
          <legend>
            Region <span>(select any)</span>
          </legend>
          <input
            type="search"
            className="filter-region-search"
            value={regionQuery}
            onChange={(event) => setRegionQuery(event.target.value)}
            placeholder="Search all countries"
            aria-label="Search regions"
          />
          <div className="filter-options filter-region-list">
            <button
              type="button"
              className={draftCountries.length === 0 ? 'selected' : ''}
              aria-pressed={draftCountries.length === 0}
              onClick={onClearRegions}
            >
              {REGION_LABELS.all}
            </button>
            {visibleCountries.map((country) => {
              const count = countByCountry.get(country.code)
              return (
                <button
                  key={country.code}
                  type="button"
                  className={draftCountries.includes(country.code) ? 'selected' : ''}
                  aria-pressed={draftCountries.includes(country.code)}
                  onClick={() => onToggleRegion(country.code)}
                >
                  <CountryFlag
                    code={country.code}
                    className="filter-flag"
                    title={country.name}
                  />
                  <span>{country.name}</span>
                  {count != null && count > 0 ? (
                    <span className="filter-region-count">{count}</span>
                  ) : null}
                </button>
              )
            })}
          </div>
        </fieldset>

        <fieldset className="filter-group">
          <legend>
            Era <span>(select any)</span>
          </legend>
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
          <legend>
            Genre <span>(select any)</span>
          </legend>
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

        <div className="filter-footer">
          <button
            type="button"
            className="filter-clear"
            disabled={!hasDraftFilters}
            onClick={onClearAll}
          >
            Clear filters
          </button>
          <button
            type="button"
            className="filter-done"
            disabled={previewCount === 0}
            onClick={onApply}
          >
            Play this mix
          </button>
        </div>
      </div>
    </div>
  )
}
