import { useEffect } from 'react'
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
  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

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
          <div className="filter-options">
            <button
              type="button"
              className={draftCountries.length === 0 ? 'selected' : ''}
              aria-pressed={draftCountries.length === 0}
              onClick={onClearRegions}
            >
              {REGION_LABELS.all}
            </button>
            {regions.map((region) => (
              <button
                key={region.id}
                type="button"
                className={draftCountries.includes(region.country) ? 'selected' : ''}
                aria-pressed={draftCountries.includes(region.country)}
                onClick={() => onToggleRegion(region.country)}
              >
                {region.label}
              </button>
            ))}
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
