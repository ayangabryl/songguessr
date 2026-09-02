import { isoCountryToFlagEmoji, NotoEmoji } from './noto-emoji'

export interface CountryFlagProps {
  code: string
  className?: string
  title?: string
}

/**
 * Flag glyphs use Noto Color Emoji (Google), not `country-flag-icons` SVGs
 * and not Apple Color Emoji (licensing). Windows Segoe UI Emoji would show
 * regional-indicator letters instead of flags, so we render Noto/Twemoji
 * images. ISO country codes stay in data; this is display only.
 */
export function CountryFlag({ code, className = 'country-flag', title }: CountryFlagProps) {
  const normalized = code.trim().toUpperCase()
  if (normalized === 'GLOBAL') return null
  const emoji = isoCountryToFlagEmoji(normalized)
  if (!emoji) return null
  return (
    <span className="country-flag-wrap">
      <NotoEmoji emoji={emoji} className={className} title={title ?? normalized} />
    </span>
  )
}
