/** One palette for the wardrobe UI, authored fabrics, and multiplayer profiles. */
export const NOOT_COLORS = {
  blue: { label: 'Denim', hex: '#7893ab' }, rose: { label: 'Rose', hex: '#b87985' },
  gold: { label: 'Honey', hex: '#c5a05c' }, mint: { label: 'Mint', hex: '#71a58e' },
  lavender: { label: 'Lavender', hex: '#9c88b6' }, coral: { label: 'Coral', hex: '#c77d65' },
  navy: { label: 'Ink', hex: '#4e647c' }, ivory: { label: 'Oat', hex: '#e9dfc9' },
  white: { label: 'Cloud', hex: '#f5f2e9' }, black: { label: 'Charcoal', hex: '#303635' },
  red: { label: 'Cherry', hex: '#bd4b52' }, orange: { label: 'Tangerine', hex: '#df9151' },
  yellow: { label: 'Butter', hex: '#e5c86d' }, lime: { label: 'Lime', hex: '#abc26b' },
  forest: { label: 'Forest', hex: '#426b54' }, teal: { label: 'Lagoon', hex: '#438c91' },
  sky: { label: 'Sky', hex: '#a8c7d7' }, indigo: { label: 'Indigo', hex: '#646897' },
  pink: { label: 'Blossom', hex: '#e7abc0' }, plum: { label: 'Plum', hex: '#876078' },
  sand: { label: 'Sand', hex: '#c5ae87' }, cocoa: { label: 'Cocoa', hex: '#826657' },
} as const
export type NootColor = keyof typeof NOOT_COLORS | `#${string}`
export function parseNootColor(value: unknown, fallback: NootColor = 'blue'): NootColor {
  if (typeof value !== 'string') return fallback
  if (Object.hasOwn(NOOT_COLORS, value)) return value as keyof typeof NOOT_COLORS
  return /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() as NootColor : fallback
}
export function nootColorHex(color: NootColor | undefined): string {
  const safe = parseNootColor(color)
  return safe.startsWith('#') ? safe : NOOT_COLORS[safe as keyof typeof NOOT_COLORS].hex
}
