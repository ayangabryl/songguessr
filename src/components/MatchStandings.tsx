import { useLayoutEffect, useRef } from 'react'
import { Crown } from 'lucide-react'
import { matchRank, matchSeatLabel, type MatchEntry } from '../../shared/match'
import { ScoreNumber } from './ScoreNumber'

export function MatchStandings({ entries, playerId, revealed, online, onChoose }: {
  entries: MatchEntry[]; playerId: string; revealed: boolean; online: string[]; onChoose: (id: string) => void
}) {
  const list = useRef<HTMLOListElement>(null), previous = useRef(new Map<string, number>())
  const order = entries.map(entry => `${entry.id}:${entry.points}`).join('|')
  useLayoutEffect(() => {
    const animations: Animation[] = [], next = new Map<string, number>()
    for (const element of list.current?.querySelectorAll<HTMLElement>('[data-player-id]') ?? []) {
      const id = element.dataset.playerId!, y = element.offsetTop, old = previous.current.get(id)
      next.set(id, y)
      if (old !== undefined && old !== y && !matchMedia('(prefers-reduced-motion: reduce)').matches) animations.push(element.animate([
        { transform: `translateY(${old - y}px)`, backgroundColor: 'var(--match-tint)' },
        { transform: 'translateY(0)', backgroundColor: 'transparent' },
      ], { duration: 520, easing: 'cubic-bezier(.22,1,.36,1)' }))
    }
    previous.current = next
    return () => animations.forEach(animation => animation.cancel())
  }, [order])
  const high = Math.max(1, ...entries.map(entry => entry.points))
  return <ol className="race-standings" ref={list}>
    {entries.map(entry => {
      const { rank, tied } = matchRank(entries, entry.id)
      return <li key={entry.id} data-player-id={entry.id} data-you={entry.id === playerId} data-leader={rank === 1 && entry.points > 0}>
        <span className="race-place" aria-label={`${tied ? 'Tied ' : ''}rank ${rank}`}>{rank === 1 && !tied && entry.points > 0 ? <Crown size={19}/> : `${tied ? 'T' : ''}${rank}`}</span>
        <div className="race-player">
          <button onClick={() => onChoose(entry.id)}>{entry.name}{entry.id === playerId && entry.name.toLowerCase() !== 'you' && <small>you</small>}</button>
          <span>{!online.includes(entry.id) ? 'Reconnecting' : matchSeatLabel(entry, revealed) || (tied ? 'Sharing this place' : 'Ready for the next song')}</span>
          <i className="race-progress" aria-hidden="true"><i style={{width:`${entry.points / high * 100}%`}}/></i>
        </div>
        <div className="race-score"><ScoreNumber value={entry.points}/>{entry.delta > 0 && <small>+{entry.delta.toLocaleString()} this round</small>}</div>
      </li>
    })}
  </ol>
}
