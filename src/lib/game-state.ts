import type { Difficulty } from './api'

export const ALL_STAGES = [0.01, 0.1, 0.5, 2, 8, 15] as const
export const DEFAULT_STAGES = [0.1, 0.5, 2, 8, 15] as const

export type StartMode = 'intro' | 'hook'
export type ShellStatus = 'idle' | 'playing' | 'won' | 'lost'

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  expert: 'Expert',
  impossible: 'Impossible',
}

const STAGES_KEY = 'songless-stages-v2'
const START_MODE_KEY = 'songless-start-mode'
const VOLUME_KEY = 'songless-volume-v2'

export function loadEnabledStages(): number[] {
  try {
    const raw = localStorage.getItem(STAGES_KEY)
    if (!raw) return [...DEFAULT_STAGES]
    const parsed = JSON.parse(raw) as number[]
    if (!Array.isArray(parsed) || parsed.length === 0) return [...DEFAULT_STAGES]
    return ALL_STAGES.filter((stage) => parsed.includes(stage))
  } catch {
    return [...DEFAULT_STAGES]
  }
}

export function saveEnabledStages(stages: number[]) {
  localStorage.setItem(STAGES_KEY, JSON.stringify(stages))
}

export function loadStartMode(): StartMode {
  const raw = localStorage.getItem(START_MODE_KEY)
  return raw === 'hook' ? 'hook' : 'intro'
}

export function saveStartMode(mode: StartMode) {
  localStorage.setItem(START_MODE_KEY, mode)
}

export function loadVolume(): number {
  const raw = localStorage.getItem(VOLUME_KEY)
  const value = raw ? Number(raw) : 1
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 1
}

export function saveVolume(volume: number) {
  localStorage.setItem(VOLUME_KEY, String(volume))
}

export function formatStageLabel(stage: number): string {
  return `${stage}s`
}

export function formatStageValue(stage: number): string {
  return stage < 1 ? stage.toFixed(2).replace(/0$/, '') : String(stage)
}
