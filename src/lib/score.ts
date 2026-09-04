export type RoundScoreStatus = 'won' | 'lost'

export interface RoundScoreInput {
  status: RoundScoreStatus
  solvedStage: number | null
  stages: number[]
}

/** Enabled clip stops, earliest first. Duplicates dropped. */
export function enabledStops(stages: number[]): number[] {
  const unique = [
    ...new Set(stages.filter((stage) => Number.isFinite(stage) && stage >= 0)),
  ]
  unique.sort((a, b) => a - b)
  return unique
}

/**
 * Points for one finished round. First enabled stop is worth the number of
 * stops; each later stop is worth one less; a miss is 0.
 * Difficulty and streak are not inputs.
 */
export function roundPoints(input: RoundScoreInput): number {
  const stages = enabledStops(input.stages)
  switch (input.status) {
    case 'lost':
      return 0
    case 'won': {
      if (input.solvedStage == null || stages.length === 0) return 0
      const index = stages.indexOf(input.solvedStage)
      if (index < 0) return 0
      return stages.length - index
    }
    default: {
      const exhaustive: never = input.status
      return exhaustive
    }
  }
}

export function sittingPoints(rounds: number[]): number {
  return rounds.reduce((total, points) => total + points, 0)
}

export function formatRoundPoints(points: number): string {
  const value = Math.max(0, Math.floor(points))
  return value > 0 ? `+${value}` : ''
}

export function sittingTallyLabel(total: number): string {
  const value = Math.max(0, Math.floor(total))
  return value === 1 ? '1 point this sitting' : `${value} points this sitting`
}

export function roundPointsLabel(points: number): string {
  const value = Math.max(0, Math.floor(points))
  return value === 1 ? '1 point' : `${value} points`
}

export function maxRoundPoints(stages: number[]): number {
  return enabledStops(stages).length
}

export function formatRoundDelta(points: number): string {
  const value = Math.max(0, Math.floor(points))
  return value > 0 ? `+${value}` : '0'
}

export function formatScoreValue(points: number): string {
  return String(Math.max(0, Math.floor(points)))
}

function stageSecondsLabel(stage: number): string {
  return stage < 1 ? stage.toFixed(2).replace(/0$/, '') : String(stage)
}

export function roundScoreWhy(input: RoundScoreInput): string {
  switch (input.status) {
    case 'lost':
      return 'No points this song'
    case 'won': {
      if (input.solvedStage == null) return 'Named'
      return `Named at ${stageSecondsLabel(input.solvedStage)} seconds`
    }
    default: {
      const exhaustive: never = input.status
      return exhaustive
    }
  }
}

export function scoreScaleHint(stages: number[]): string {
  const max = maxRoundPoints(stages)
  return `Earliest stop is ${max} points. Each later stop is one less.`
}
