import { CountryFlag } from '../../shared/country-flag'
import { countryDisplayName, filterIsoCountries } from '../../shared/iso-countries'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { ChevronsUpDownIcon } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

interface CountryComboboxProps {
  value: string
  onChange: (code: string) => void
  disabled?: boolean
  includeAllOption?: boolean
  allLabel?: string
  counts?: Record<string, number>
  id?: string
}

export function CountryCombobox({
  value,
  onChange,
  disabled,
  includeAllOption = false,
  allLabel = 'All countries',
  counts,
  id,
}: CountryComboboxProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) {
      setQuery('')
      return
    }

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const options = useMemo(() => filterIsoCountries(query), [query])
  const selectedLabel = value === 'all' ? allLabel : countryDisplayName(value)

  return (
    <div ref={rootRef} className="relative w-full">
      <Button
        id={id}
        type="button"
        variant="outline"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="h-8 w-full justify-between px-2.5 font-normal"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="flex min-w-0 items-center gap-2">
          {value !== 'all' ? <CountryFlag code={value} className="size-4 shrink-0" /> : null}
          <span className="truncate">{selectedLabel}</span>
        </span>
        <ChevronsUpDownIcon className="size-3.5 opacity-60" />
      </Button>
      {open ? (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-md">
          <div className="p-1.5">
            <Input
              autoFocus
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search countries"
              aria-label="Search countries"
            />
          </div>
          <ul role="listbox" className="max-h-64 overflow-auto p-1">
            {includeAllOption && (!query.trim() || allLabel.toLowerCase().includes(query.trim().toLowerCase())) ? (
              <li>
                <button
                  type="button"
                  role="option"
                  aria-selected={value === 'all'}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm',
                    value === 'all' ? 'bg-muted' : 'hover:bg-muted/70',
                  )}
                  onClick={() => {
                    onChange('all')
                    setOpen(false)
                  }}
                >
                  {allLabel}
                </button>
              </li>
            ) : null}
            {options.map((country) => {
              const count = counts?.[country.code]
              return (
                <li key={country.code}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={value === country.code}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm',
                      value === country.code ? 'bg-muted' : 'hover:bg-muted/70',
                    )}
                    onClick={() => {
                      onChange(country.code)
                      setOpen(false)
                    }}
                  >
                    <CountryFlag
                      code={country.code}
                      className="size-4 shrink-0"
                      title={country.name}
                    />
                    <span className="min-w-0 flex-1 truncate">{country.name}</span>
                    {count != null ? (
                      <span className="text-muted-foreground tabular-nums">{count}</span>
                    ) : null}
                  </button>
                </li>
              )
            })}
            {options.length === 0 ? (
              <li className="px-2 py-1.5 text-sm text-muted-foreground">No countries match</li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
