import { useEffect, useRef, useState } from 'react'
import { formatRoundPoints, sittingTallyLabel } from '../lib/score'

/** Matches `--dur-4`: the float and the count-up share one beat. */
const SCORE_TICK_MS = 600

interface SittingTallyProps {
  total: number
  delta: number
  bump: boolean
}

/**
 * The sitting score. Not a streak: no flame, a "pts" unit, and a count-up
 * when points land. Neighbour is StreakBadge. Same operator type as Mix.
 */
export function SittingTally({ total, delta, bump }: SittingTallyProps) {
  const [shown, setShown] = useState(total)
  const fromRef = useRef(total)

  useEffect(() => {
    const from = fromRef.current
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce || from === total) {
      fromRef.current = total
      setShown(total)
      return
    }

    const start = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / SCORE_TICK_MS)
      const eased = 1 - (1 - t) ** 3
      setShown(Math.round(from + (total - from) * eased))
      if (t < 1) {
        frame = window.requestAnimationFrame(tick)
        return
      }
      fromRef.current = total
    }
    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [total])

  const empty = total <= 0
  const fly = bump && delta > 0 ? formatRoundPoints(delta) : null

  return (
    <div
      className={`sitting-tally${empty ? ' is-empty' : ''}${bump ? ' is-scoring' : ''}`}
      aria-label={sittingTallyLabel(total)}
    >
      <b>{shown}</b>
      <span>pts</span>
      {fly ? (
        <i className="sitting-tally-fly" aria-hidden="true">
          {fly}
        </i>
      ) : null}
    </div>
  )
}
