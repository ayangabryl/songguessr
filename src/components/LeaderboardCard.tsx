import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { type RankedPlayer, rankDelta } from '../../shared/sitting'
import { formatRoundDelta, formatScoreValue } from '../lib/score'

interface LeaderboardCardProps {
  players: RankedPlayer[]
  youId: string
  message: string | null
  bump: boolean
  delta: number
}

function cssDurationMs(el: Element, token: string, fallback: number): number {
  const raw = getComputedStyle(el).getPropertyValue(token).trim()
  const value = Number.parseFloat(raw)
  if (!Number.isFinite(value)) return fallback
  if (raw.endsWith('ms')) return value
  if (raw.endsWith('s')) return value * 1000
  return fallback
}

export function LeaderboardCard({
  players,
  youId,
  message,
  bump,
  delta,
}: LeaderboardCardProps) {
  const you = players.find((player) => player.id === youId)
  const ahead = players.filter(player=>you && player.points>you.points).at(-1)
  const chase = you ? ahead ? `${ahead.points-you.points} points to tie ${ahead.name}` : players.filter(p=>p.points===you.points).length>1 ? 'Tied for the lead' : 'You’re leading the table' : 'Make your first move'
  const countLabel = players.length === 1 ? '1 playing' : `${players.length} playing`
  const listRef = useRef<HTMLOListElement>(null)
  const firstTops = useRef(new Map<string, number>())
  const prevPlayers = useRef<RankedPlayer[]>([])
  const [overtaking, setOvertaking] = useState(false)

  useLayoutEffect(() => {
    const list = listRef.current
    const improved = rankDelta(prevPlayers.current, players, youId) > 0
    prevPlayers.current = players
    if (improved) setOvertaking(true)

    if (!list) {
      firstTops.current = new Map()
      return
    }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const duration = cssDurationMs(list, '--dur-3', 420)
    const easing = getComputedStyle(list).getPropertyValue('--ease-land').trim()
    const next = new Map<string, number>()

    for (const node of list.children) {
      const el = node as HTMLElement
      const id = el.dataset.id
      if (!id) continue
      const top = el.getBoundingClientRect().top
      next.set(id, top)
      const prev = firstTops.current.get(id)
      if (reduce || prev == null) continue
      const dy = prev - top
      if (Math.abs(dy) <= 1) continue
      el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], {
        duration,
        easing: easing || undefined,
      })
    }

    firstTops.current = next
  }, [players, youId])

  useEffect(() => {
    if (!overtaking) return
    const host = listRef.current ?? document.documentElement
    const hold = cssDurationMs(host, '--dur-4', 600)
    const timer = window.setTimeout(() => setOvertaking(false), hold)
    return () => window.clearTimeout(timer)
  }, [overtaking])

  return (
    <section className="sit-board" aria-label="Scores">
      <div className="sit-board-heading"><div><p className="sit-board-count">LIVE TABLE · {countLabel}</p><h3>{chase}</h3></div>{you && <strong>#{you.rank}</strong>}</div><p className="sit-board-rules">Casual table · independent songs and clip stages</p>
      {you ? (
        <p className="sr-only">
          You are {you.name}, rank {you.rank}, {you.points} points.
        </p>
      ) : null}
      {overtaking && you ? (
        <p className="sr-only" role="status">
          You passed into rank {you.rank}.
        </p>
      ) : null}
      {message ? (
        <p className="sit-error" role="status">
          {message}
        </p>
      ) : null}
      {players.length === 0 ? (
        <p className="sit-empty">Waiting for friends</p>
      ) : (
        <ol className="sit-rows" ref={listRef}>
          {players.map((player) => {
            const mine = player.id === youId
            const fly = mine && bump && delta > 0
            return (
              <li
                key={player.id}
                data-id={player.id}
                className={`sit-row${mine ? ' is-you' : ''}${player.connected ? '' : ' is-away'}${
                  mine && overtaking ? ' is-overtaking' : ''
                }`}
              >
                <span className="sit-rank">{player.rank}</span>
                <span className="sit-name">
                  {player.name}
                  {mine ? <i>you</i> : null}
                  {player.connected ? null : <i>away</i>}
                  {player.activity && player.activity.action !== 'idle' && <small className="sit-activity">{player.activity.action==='skip' ? 'Skipped' : player.activity.action==='solved' ? 'Named it' : player.activity.action==='missed' ? 'Finished · not named' : 'Listening'} · {player.activity.stage}s clip</small>}
                </span>
                <span className="sit-pts">
                  <b>{formatScoreValue(player.points)}</b>
                  <span>pts</span>
                  {fly ? (
                    <em className="sit-fly" aria-hidden="true">
                      {formatRoundDelta(delta)}
                    </em>
                  ) : null}
                </span>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
