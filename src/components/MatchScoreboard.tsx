import { useEffect, useId, useRef, useState } from 'react'
import { Trophy } from 'lucide-react'
import { matchRank, type MatchEntry } from '../../shared/match'
import { describeOvertake } from '../lib/match-overtake'
import { MatchStandings } from './MatchStandings'
import '../scoreboard.css'

const visibilityKey = 'songguessr-standings-open'
function initialVisibility() {
  try { const saved = sessionStorage.getItem(visibilityKey); if (saved !== null) return saved === 'true' } catch { /* Session preference is optional. */ }
  return matchMedia('(min-width: 1001px)').matches
}

export function MatchScoreboard({ entries, playerId, matchId, finished, revealed, online, onChoose }: {
  entries: MatchEntry[]; playerId: string; matchId: string; finished: boolean; revealed: boolean
  online: string[]; onChoose: (id: string) => void
}) {
  const [open, setOpen] = useState(initialVisibility), [notice, setNotice] = useState('')
  const contentId = useId()
  function show(value: boolean) {
    setOpen(value)
    try { sessionStorage.setItem(visibilityKey, String(value)) } catch { /* Keep the current choice in memory. */ }
  }
  const panel = useRef<HTMLElement>(null), toggle = useRef<HTMLButtonElement>(null)
  const previous = useRef<{matchId: string; entries: MatchEntry[]} | null>(null)
  const expiry = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const me = entries.find(p => p.id === playerId), place = matchRank(entries, playerId)
  const scoreKey = JSON.stringify(entries.map(p => [p.id,p.name,p.points]))
  useEffect(() => {
    const old = previous.current
    const message = old?.matchId === matchId ? describeOvertake(old.entries, entries, playerId) : null
    previous.current = {matchId, entries: entries.map(p => ({...p}))}
    if (old?.matchId !== matchId) { clearTimeout(expiry.current); setNotice('') }
    else if (message) {
      clearTimeout(expiry.current); setNotice(message)
      expiry.current = setTimeout(() => setNotice(''), 5000)
    }
    // Compare committed scores, not unrelated roster/presence renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoreKey, matchId, playerId])
  useEffect(() => () => clearTimeout(expiry.current), [])
  useEffect(() => {
    if (!open) return
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('[aria-modal="true"]')) {
        show(false); toggle.current?.focus()
      }
    }
    const outside = (event: PointerEvent) => {
      if (matchMedia('(max-width: 1000px)').matches && !document.querySelector('[aria-modal="true"]') && !panel.current?.contains(event.target as Node)) show(false)
    }
    document.addEventListener('keydown', key); document.addEventListener('pointerdown', outside)
    return () => { document.removeEventListener('keydown', key); document.removeEventListener('pointerdown', outside) }
  }, [open])
  return <aside className="match-board score-ledger" aria-label="Table standings" data-open={open} ref={panel}>
    <button className="match-board-toggle" ref={toggle} onClick={() => show(!open)} aria-label={open ? 'Hide standings' : 'Show standings'} title={open ? 'Hide standings' : 'Show standings'} aria-description={me ? `${place.tied ? 'Tied rank' : 'Rank'} ${place.rank}, ${me.points.toLocaleString()} points` : `${entries.length} players`} aria-expanded={open} aria-controls={contentId}>
      <Trophy size={19} strokeWidth={1.6} aria-hidden="true"/>
    </button>
    <p className="score-ledger-announcement" role="status" aria-live="polite" aria-atomic="true">{notice}</p>
    <div className="score-ledger-surface" id={contentId} hidden={!open}>
      <div className="match-board-heading"><h2>{finished ? 'Final scores' : 'Standings'}</h2><span>{entries.length} players</span></div>
      {notice && <p className="match-rank-notice" aria-hidden="true" data-active="true">{notice}</p>}
      <div className="match-board-body">
        {open && <MatchStandings entries={entries} playerId={playerId} revealed={revealed} online={online} onChoose={onChoose}/>}
      </div>
    </div>
  </aside>
}
