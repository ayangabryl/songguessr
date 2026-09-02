import type { Difficulty } from './api'

export type MascotMood = 'idle' | 'play' | 'win' | 'lose' | 'skip' | 'streak' | 'switch'

export interface MascotPalette {
  body: [number, number, number]
  belly: [number, number, number]
  outline: [number, number, number]
  cheek: [number, number, number]
  accent: [number, number, number]
}

export const MASCOT_SEGMENTS: Record<MascotMood, [number, number]> = {
  idle: [0, 90],
  play: [90, 180],
  win: [180, 270],
  lose: [270, 360],
  skip: [360, 420],
  streak: [420, 500],
  switch: [500, 560],
}

export const MASCOT_LOOPING: Record<MascotMood, boolean> = {
  idle: true,
  play: true,
  win: true,
  lose: true,
  skip: false,
  streak: false,
  switch: false,
}

function rgb(hex: string): [number, number, number] {
  const value = hex.replace('#', '')
  return [
    Number.parseInt(value.slice(0, 2), 16) / 255,
    Number.parseInt(value.slice(2, 4), 16) / 255,
    Number.parseInt(value.slice(4, 6), 16) / 255,
  ]
}

export const MASCOT_PALETTES: Record<Difficulty, MascotPalette> = {
  easy: {
    body: rgb('#22D875'),
    belly: rgb('#6BE89E'),
    outline: rgb('#149A52'),
    cheek: rgb('#E8A0B0'),
    accent: rgb('#22D875'),
  },
  medium: {
    body: rgb('#FFD119'),
    belly: rgb('#FFE566'),
    outline: rgb('#C79A00'),
    cheek: rgb('#E8A0B0'),
    accent: rgb('#FFD119'),
  },
  hard: {
    body: rgb('#E17C21'),
    belly: rgb('#F0A45A'),
    outline: rgb('#B35E12'),
    cheek: rgb('#E8A0B0'),
    accent: rgb('#E17C21'),
  },
  expert: {
    body: rgb('#D74842'),
    belly: rgb('#EE7C76'),
    outline: rgb('#A82F2B'),
    cheek: rgb('#E8A0B0'),
    accent: rgb('#D74842'),
  },
  impossible: {
    body: rgb('#9A4DE0'),
    belly: rgb('#C08AF0'),
    outline: rgb('#6E32AD'),
    cheek: rgb('#E8A0B0'),
    accent: rgb('#9A4DE0'),
  },
}

type FillName = 'bodyFill' | 'bellyFill' | 'outlineFill' | 'cheekFill' | 'accentFill'

const FILL_NAMES = new Set<string>(['bodyFill', 'bellyFill', 'outlineFill', 'cheekFill', 'accentFill'])

export function tintMascotData(data: unknown, palette: MascotPalette): unknown {
  const clone = structuredClone(data) as Record<string, unknown>
  walk(clone, palette)
  return clone
}

function walk(node: unknown, palette: MascotPalette) {
  if (!node || typeof node !== 'object') return
  if (Array.isArray(node)) {
    for (const item of node) walk(item, palette)
    return
  }

  const record = node as { nm?: string; ty?: string; c?: { k?: number[] } }
  if (record.ty === 'fl' && record.nm && FILL_NAMES.has(record.nm) && record.c && Array.isArray(record.c.k)) {
    const color = colorForFill(record.nm as FillName, palette)
    record.c.k = [color[0], color[1], color[2], 1]
  }

  for (const value of Object.values(record)) walk(value, palette)
}

function colorForFill(name: FillName, palette: MascotPalette): [number, number, number] {
  switch (name) {
    case 'bodyFill':
      return palette.body
    case 'bellyFill':
      return palette.belly
    case 'outlineFill':
      return palette.outline
    case 'cheekFill':
      return palette.cheek
    case 'accentFill':
      return palette.accent
    default: {
      const exhaustive: never = name
      return exhaustive
    }
  }
}
