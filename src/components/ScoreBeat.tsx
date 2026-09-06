import { formatRoundDelta, roundPointsLabel } from '../lib/score'
interface ScoreBeatProps {
  status: 'won' | 'lost'
  points: number
  solvedStage: number | null
  stages: number[]
  teach: boolean
}
export function ScoreBeat({ status, points, solvedStage }: ScoreBeatProps) {
  return (
    <p className="score-beat" data-status={status}>
      <b aria-label={roundPointsLabel(points)}>{formatRoundDelta(points)}</b>
      <span>
        {status === 'won'
          ? `points · named at ${solvedStage}s`
          : 'points this song'}
      </span>
    </p>
  )
}
