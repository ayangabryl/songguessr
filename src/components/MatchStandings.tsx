import { NootAvatar } from './NootAvatar'
import type { NootAppearance } from '../../shared/noot-profile'
import type { Difficulty } from '../lib/api'
import { Ruler } from './Ruler'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { Crown } from 'lucide-react'
import { matchRank, matchSeatLabel, MATCH_STAGES, type MatchEntry } from '../../shared/match'
import { ScoreNumber } from './ScoreNumber'

export function MatchStandings({ entries, playerId, revealed, online, onChoose, appearances, difficulty }: {
  entries: MatchEntry[]; playerId: string; revealed: boolean; appearances: Record<string, NootAppearance | undefined>; difficulty: Difficulty; online: string[]; onChoose: (id: string) => void
}) {
  const list = useRef<HTMLOListElement>(null)
  const positions = useRef(new Map<string, {x: number; y: number}>())
  const motions = useRef(new Map<string, Animation>())
  const order = entries.map(entry => `${entry.id}:${entry.points}`).join('|')
  useLayoutEffect(() => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    const next = new Map<string, {x: number; y: number}>()
    for (const element of list.current?.querySelectorAll<HTMLElement>('[data-player-id]') ?? []) {
      const id = element.dataset.playerId!, x = element.offsetLeft, y = element.offsetTop
      const old = positions.current.get(id), running = motions.current.get(id)
      // Read the in-flight transform before cancelling: a second score update
      // continues from the visible position rather than jumping to an old rank.
      const transform = new DOMMatrixReadOnly(getComputedStyle(element).transform)
      const dx = old ? old.x + transform.m41 - x : 0
      const dy = old ? old.y + transform.m42 - y : 0
      running?.cancel(); motions.current.delete(id); next.set(id, {x,y})
      if (old && (Math.abs(dx) > .5 || Math.abs(dy) > .5) && !reduced) {
        const animation = element.animate([
          { transform: `translate(${dx}px, ${dy}px)`, backgroundColor: 'var(--surface-2)' },
          { transform: 'translate(0, 0)', backgroundColor: 'transparent' },
        ], { duration: 520, easing: 'cubic-bezier(.22,1,.36,1)' })
        motions.current.set(id, animation)
        animation.onfinish = () => { if (motions.current.get(id) === animation) motions.current.delete(id) }
      }
    }
    positions.current = next
    for (const [id, animation] of motions.current) if (!next.has(id)) { animation.cancel(); motions.current.delete(id) }
  }, [order])
  useEffect(() => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)')
    const settle = () => { motions.current.forEach(animation => animation.cancel()); motions.current.clear() }
    let width = list.current?.clientWidth
    const resize = new ResizeObserver(() => {
      if (width === list.current?.clientWidth) return
      width = list.current?.clientWidth; settle()
      for (const element of list.current?.querySelectorAll<HTMLElement>('[data-player-id]') ?? []) positions.current.set(element.dataset.playerId!, {x:element.offsetLeft,y:element.offsetTop})
    })
    if (list.current) resize.observe(list.current)
    reduced.addEventListener('change', settle)
    return () => { settle(); resize.disconnect(); reduced.removeEventListener('change', settle) }
  }, [])
  return <ol className="race-standings" ref={list}>
    {entries.map(entry => {
      const { rank, tied } = matchRank(entries, entry.id)
      const activity = !online.includes(entry.id) ? 'Reconnecting' : matchSeatLabel(entry, revealed)
      const detail = activity === 'Reconnecting' || activity === 'Ready' ? activity : ''
      return <li key={entry.id} data-player-id={entry.id} data-you={entry.id === playerId} data-leader={rank === 1 && entry.points > 0}>
        <span className="race-place" aria-label={`${tied ? 'Tied ' : ''}rank ${rank}`}>{rank === 1 && !tied && entry.points > 0 ? <Crown size={19}/> : `${tied ? 'T' : ''}${rank}`}</span>
        <div className="race-player">
          <button onClick={() => onChoose(entry.id)} title={entry.name}><NootAvatar appearance={appearances[entry.id]} difficulty={difficulty}/><span className="race-player-name">{entry.name}</span>{entry.id === playerId && entry.name.toLowerCase() !== 'you' && <small>you</small>}</button>
          <div className="race-attempts"><Ruler size="signature" stages={MATCH_STAGES} stageIndex={entry.stage}
            marks={entry.attempts ?? []} status={entry.status === 'solved' ? 'won' : entry.status === 'out' ? 'lost' : 'playing'}
            solvedStage={entry.status === 'solved' ? MATCH_STAGES[entry.stage] : null}
            description={entry.lastAction === 'timeout' ? `Time ran out with ${MATCH_STAGES[entry.stage]} seconds unlocked.` : undefined}/></div>
          {detail && <span>{detail}</span>}
        </div>
        <div className="race-score"><ScoreNumber value={entry.points}/>{entry.delta > 0 && <small>+{entry.delta.toLocaleString()} this round</small>}</div>
      </li>
    })}
  </ol>
}
