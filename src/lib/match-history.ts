import { MATCH_STAGES, type MatchView } from '../../shared/match.ts'
import type { SessionEntry } from '../components/SittingHistory'

export function matchSittingHistory(match: MatchView, playerId: string): SessionEntry[] {
  return [...(match.completedRounds ?? [])].reverse().flatMap(round => {
    const result = round.results.find(p => p.id === playerId)
    if (!result) return []
    const solved = result.status === 'solved'
    return [{
      id: round.roundId, title: round.answer.title, artist: round.answer.artist,
      status: solved ? 'won' as const : 'lost' as const,
      solvedStage: solved ? MATCH_STAGES[result.stage] : null,
      points: result.delta, stages: MATCH_STAGES, marks: result.attempts ?? [],
      description: result.lastAction === 'timeout'
        ? `Time ran out with ${MATCH_STAGES[result.stage]} seconds unlocked.`
        : solved ? `Named at ${MATCH_STAGES[result.stage]} seconds after ${result.stage + 1} ${result.stage === 0 ? 'try' : 'tries'}.`
        : result.lastAction === 'ready' ? 'Did not play this song.'
        : result.attempts ? undefined : 'Song passed. Earlier attempt details are unavailable.',
    }]
  })
}
