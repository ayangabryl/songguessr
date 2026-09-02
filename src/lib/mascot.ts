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
    body: rgb('#58CC02'),
    belly: rgb('#89E219'),
    outline: rgb('#3D8C02'),
    cheek: rgb('#FF8DAA'),
    accent: rgb('#58CC02'),
  },
  medium: {
    body: rgb('#FFC800'),
    belly: rgb('#FFE566'),
    outline: rgb('#C79200'),
    cheek: rgb('#FF8DAA'),
    accent: rgb('#FFC800'),
  },
  hard: {
    body: rgb('#FF9600'),
    belly: rgb('#FFC14A'),
    outline: rgb('#C56A00'),
    cheek: rgb('#FF8DAA'),
    accent: rgb('#FF9600'),
  },
  expert: {
    body: rgb('#FF4B4B'),
    belly: rgb('#FF8A8A'),
    outline: rgb('#C91F1F'),
    cheek: rgb('#FF8DAA'),
    accent: rgb('#FF4B4B'),
  },
  impossible: {
    body: rgb('#CE82FF'),
    belly: rgb('#E4B5FF'),
    outline: rgb('#9B4DCC'),
    cheek: rgb('#FF8DAA'),
    accent: rgb('#CE82FF'),
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
