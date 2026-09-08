import type { NootAction } from './types.ts'

/** Baked CC0 motion templates, adapted for Noot at 120 BPM in Blender. */
export const DANCE_CLIPS = ['Groove', 'BodyRoll', 'Charleston', 'HipSway'] as const
export const DANCE_POSES = ['groove', 'body-roll', 'charleston', 'hip-sway'] as const satisfies readonly NootAction[]
export function danceFor(identity: string, variation = 0) {
  let hash = 0
  for (const char of identity) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0
  return DANCE_CLIPS[(hash + Math.abs(Math.trunc(variation))) % DANCE_CLIPS.length]
}
