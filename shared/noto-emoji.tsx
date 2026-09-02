import { useEffect, useState } from 'react'

/**
 * Noto Color Emoji (Google) for catalog UI glyphs — flags and custom catalog
 * icons. We do not use Apple Color Emoji (licensing) and we do not rely on
 * Windows Segoe UI Emoji, which draws regional-indicator pairs as letters
 * ("PH") instead of a flag.
 *
 * ISO country codes stay in data. Display uses Noto SVG from Google's emoji
 * CDN, with Twemoji as a same-glyph fallback if Noto is unreachable.
 */
export interface NotoEmojiProps {
  emoji: string
  className?: string
  title?: string
}

export function emojiToCodepoints(emoji: string): string {
  return [...emoji]
    .map((char) => char.codePointAt(0))
    .filter((value): value is number => value != null && value !== 0xfe0f)
    .map((value) => value.toString(16))
    .join('-')
}

export function notoEmojiUrl(emoji: string): string {
  return `https://fonts.gstatic.com/s/e/notoemoji/latest/${emojiToCodepoints(emoji)}/emoji.svg`
}

export function twemojiUrl(emoji: string): string {
  return `https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/svg/${emojiToCodepoints(emoji)}.svg`
}

export function isoCountryToFlagEmoji(code: string): string {
  const normalized = code.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(normalized)) return ''
  const first = normalized.charCodeAt(0) - 0x41
  const second = normalized.charCodeAt(1) - 0x41
  return String.fromCodePoint(0x1f1e6 + first, 0x1f1e6 + second)
}

export function NotoEmoji({ emoji, className = 'noto-emoji', title }: NotoEmojiProps) {
  const glyph = emoji.trim()
  const [src, setSrc] = useState(() => (glyph ? notoEmojiUrl(glyph) : ''))

  useEffect(() => {
    if (!glyph) {
      setSrc('')
      return
    }
    setSrc(notoEmojiUrl(glyph))
  }, [glyph])

  if (!glyph || !src) return null

  return (
    <img
      src={src}
      alt={title ?? glyph}
      title={title ?? glyph}
      className={className}
      draggable={false}
      onError={() => {
        const fallback = twemojiUrl(glyph)
        if (src !== fallback) setSrc(fallback)
      }}
    />
  )
}
