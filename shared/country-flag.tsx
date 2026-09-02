import { hasFlag } from 'country-flag-icons'
import * as Flags from 'country-flag-icons/react/3x2'
import type { JSX, SVGProps } from 'react'

type FlagComponent = (props: SVGProps<SVGSVGElement>) => JSX.Element

const FLAG_COMPONENTS = Flags as unknown as Record<string, FlagComponent>

export interface CountryFlagProps {
  code: string
  className?: string
  title?: string
}

/**
 * Flag library: `country-flag-icons` (SVG 3x2 React components).
 * Chosen over Apple/iOS (or Windows) native flag emoji so every browser
 * and OS renders the same vector flag. Do not use emoji or a second flag pack.
 */
export function CountryFlag({ code, className = 'country-flag', title }: CountryFlagProps) {
  const normalized = code.trim().toUpperCase()
  if (normalized === 'GLOBAL' || !hasFlag(normalized)) return null
  const FlagSvg = FLAG_COMPONENTS[normalized]
  if (!FlagSvg) return null
  const label = title ?? normalized
  return (
    <span className="country-flag-wrap" title={label}>
      <FlagSvg className={className} aria-label={label} />
    </span>
  )
}
