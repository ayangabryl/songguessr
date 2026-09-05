import type { Difficulty } from './api'

/** Shared game reactions and difficulty colours for Noot's 3D rig and SVG fallback. */
export type MascotIntent =
  | 'idle'
  | 'play'
  | 'win'
  | 'lose'
  | 'skip'
  | 'streak'
  | 'switch'
  | 'hover'
  | 'tap'

/**
 * Duration of each state animation, in ms.
 *
 * These MUST stay in sync with the `animation-duration` values in
 * `noot.css` — Game.tsx and Mascot.tsx schedule their state resets off them.
 */
export const MASCOT_DURATION_MS: Record<MascotIntent, number> = {
  idle: 3400,
  play: 1100,
  win: 1400,
  lose: 1200,
  skip: 1200,
  streak: 1800,
  switch: 900,
  hover: 1600,
  tap: 1100,
}

/** Timeout is a slower, heavier version of `lose`. */
export const MASCOT_TIMEOUT_MS = 1700

export type MascotLoseReason = 'wrong' | 'timeout' | 'skip'

/** Face + pose variant a given intent should hold. */
export type MascotPose =
  | 'idle'
  | 'play'
  | 'win'
  | 'lose'
  | 'timeout'
  | 'skip'
  | 'streak'
  | 'switch'
  | 'hover'
  | 'tap'

export function resolveMascotPose(intent: MascotIntent, loseReason: MascotLoseReason): MascotPose {
  if (intent === 'lose' && loseReason === 'timeout') return 'timeout'
  return intent
}

export function mascotPoseDurationMs(pose: MascotPose): number {
  return pose === 'timeout' ? MASCOT_TIMEOUT_MS : MASCOT_DURATION_MS[pose]
}

export interface MascotPalette {
  /** Main shell fill. */
  body: string
  /** Belly patch. */
  belly: string
  /** Contour shading, a shade darker than `body`. */
  shade: string
  /** Blush ovals. */
  cheek: string
}

/**
 * One palette per difficulty. Three.js interpolates material colours;
 * the SVG fallback reads matching CSS custom properties.
 */
export const MASCOT_PALETTES: Record<Difficulty, MascotPalette> = {
  easy: { body: '#86C217', belly: '#C1E384', shade: '#629F08', cheek: '#F0A07A' },
  medium: { body: '#EFC016', belly: '#F9E79E', shade: '#C79A05', cheek: '#EE8A5E' },
  hard: { body: '#E58322', belly: '#F8CE9E', shade: '#BC630D', cheek: '#C4553A' },
  expert: { body: '#DB4C44', belly: '#F5AEA6', shade: '#B22F29', cheek: '#9C2D24' },
  impossible: { body: '#9A51E0', belly: '#D8B4F6', shade: '#7532C0', cheek: '#E07AA0' },
}

/** Inline style object that drives the rig's colours for a difficulty. */
export function mascotPaletteVars(difficulty: Difficulty): Record<string, string> {
  const palette = MASCOT_PALETTES[difficulty]
  return {
    '--noot-body': palette.body,
    '--noot-belly': palette.belly,
    '--noot-shade': palette.shade,
    '--noot-cheek': palette.cheek,
  }
}
