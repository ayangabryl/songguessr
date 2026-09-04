import { formatRoundDelta, roundPointsLabel, roundScoreWhy, scoreScaleHint } from '../lib/score'

interface ScoreBeatProps {
  status: 'won' | 'lost'
  points: number
  solvedStage: number | null
  stages: number[]
  teach: boolean
}

export function ScoreBeat({ status, points, solvedStage, stages, teach }: ScoreBeatProps) {
  const why = roundScoreWhy({ status, solvedStage, stages })
  const delta = formatRoundDelta(points)

  switch (status) {
    case 'won':
      return (
        <p className="score-beat" data-status="won">
          <b aria-label={roundPointsLabel(points)}>{delta}</b>
          <span>{why}</span>
          {teach ? <small>{scoreScaleHint(stages)}</small> : null}
        </p>
      )
    case 'lost':
      return (
        <p className="score-beat" data-status="lost">
          <b aria-label={roundPointsLabel(0)}>0</b>
          <span>{why}</span>
          {teach ? <small>{scoreScaleHint(stages)}</small> : null}
        </p>
      )
    default: {
      const exhaustive: never = status
      return exhaustive
    }
  }
}
