export function stageSegmentWeight(stageSeconds: number): number {
  return Math.max(0.58, Math.log10(stageSeconds * 100 + 1))
}

/** Percent fill when stages 0..stageIndex are fully unlocked. */
export function progressAtStageBoundary(stages: number[], stageIndex: number): number {
  const weights = stages.map(stageSegmentWeight)
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  if (total <= 0) return 0

  const unlockedWeight = weights
    .slice(0, Math.max(0, Math.min(stageIndex, weights.length)))
    .reduce((sum, weight) => sum + weight, 0)

  return (unlockedWeight / total) * 100
}

/** Percent fill at elapsed seconds on the cumulative stage timeline. */
export function progressAtElapsedSeconds(
  stages: number[],
  stageIndex: number,
  elapsedSeconds: number,
): number {
  const weights = stages.map(stageSegmentWeight)
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  if (total <= 0 || elapsedSeconds <= 0) return 0

  let filled = 0
  let previousMarker = 0
  const cappedIndex = Math.max(0, Math.min(stageIndex, stages.length - 1))

  for (let index = 0; index <= cappedIndex; index += 1) {
    const marker = stages[index]
    const segmentLength = Math.max(0.0001, marker - previousMarker)
    const segmentProgress = Math.max(0, Math.min(1, (elapsedSeconds - previousMarker) / segmentLength))
    filled += weights[index] * segmentProgress
    if (segmentProgress < 1) break
    previousMarker = marker
  }

  return (filled / total) * 100
}

export function previousStageEndpoint(stages: number[], stageIndex: number): number {
  return stageIndex > 0 ? (stages[stageIndex - 1] ?? 0) : 0
}
