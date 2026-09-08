import { Ruler } from './Ruler'
import { formatScoreValue } from '../lib/score'
import type { RoundMark } from './Game'

export interface SessionEntry {
  id: string
  title: string
  artist: string
  albumArt?: string
  status: 'won' | 'lost'
  solvedStage: number | null
  points: number
  stages: number[]
  marks: RoundMark[]
  description?: string
}

/** The same song ledger and attempt signatures in solo and multiplayer. */
export function SittingHistory({ entries, total }: {entries: SessionEntry[]; total: number}) {
  return <section className={`session${entries.length === 0 ? ' is-empty' : ''}`} aria-label={entries.length ? 'This sitting' : undefined} aria-hidden={!entries.length}>
    {entries.length > 0 && <>
      <h2 className="session-title">This sitting<span className="session-total" aria-hidden="true">{total}</span></h2>
      <ul className="session-list">{entries.map(entry => <li key={entry.id} className={`session-row ${entry.status}`}>
        <Ruler size="signature" stages={entry.stages} stageIndex={entry.stages.length} marks={entry.marks} status={entry.status} solvedStage={entry.solvedStage} description={entry.description}/>
        <span className="session-time">{formatScoreValue(entry.points)}</span>
        <span className="session-track"><strong>{entry.title}</strong><small>{entry.artist}</small></span>
      </li>)}</ul>
    </>}
  </section>
}
