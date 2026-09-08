import { useEffect, useState } from 'react'
import { ArrowRight, Check } from 'lucide-react'
import { MATCH_STAGES, matchRank, type MatchEntry } from '../../shared/match'
import type { NootAppearance } from '../../shared/noot-profile'
import type { Difficulty } from '../lib/api'
import { NootAvatar } from './NootAvatar'

export function MatchResults({entries,playerId,hostId,online,appearances,difficulty,finished,carryScores,pending,connected,error,onReady,onUnready,onContinue}: {
  entries:MatchEntry[]; playerId:string; hostId:string|null; online:string[]
  appearances:Record<string,NootAppearance|undefined>; difficulty:Difficulty
  finished:boolean; carryScores:boolean; pending:boolean; connected:boolean; error:string|null
  onReady:()=>void; onUnready:()=>void; onContinue:()=>void
}) {
  const [armed,setArmed] = useState(false)
  useEffect(()=>{const timer=setTimeout(()=>setArmed(true),900);return()=>clearTimeout(timer)},[])
  const me = entries.find(p=>p.id===playerId)
  const present = entries.filter(p=>online.includes(p.id))
  const allReady = present.length>0 && present.every(p=>p.ready)
  const isHost = hostId===playerId
  const hostName = entries.find(p=>p.id===hostId)?.name ?? 'the host'
  const readyCount = present.filter(p=>p.ready).length
  return <div className="match-results">
    <div className="match-results-heading"><h2>{finished?'Final standings':'This song'}</h2><span>{finished?'Total points':'Song / total'}</span></div>
    <ol className="match-results-list" aria-label={finished?'Final standings':'Player results'} tabIndex={0}>
      {entries.map(entry=>{
        const rank=matchRank(entries,entry.id)
        const outcome = entry.status==='solved' ? `Named at ${MATCH_STAGES[entry.stage]}s` : entry.lastAction==='timeout' ? 'Time ran out' : 'Passed'
        return <li key={entry.id} data-you={entry.id===playerId}>
          <span className="result-rank" aria-label={`${rank.tied?'Tied rank':'Rank'} ${rank.rank}`}>{rank.rank}</span>
          <NootAvatar appearance={appearances[entry.id]} difficulty={difficulty}/>
          <div className="result-player"><strong>{entry.name}{entry.id===playerId && entry.name.toLowerCase()!=='you' && <small>you</small>}</strong><span>{finished ? !online.includes(entry.id)?'Away':entry.ready?'Ready':'Reviewing results' : outcome}</span></div>
          <div className="result-points">{!finished && <strong>+{entry.delta}</strong>}<span>{entry.points} <small>pts</small></span></div>
        </li>
      })}
    </ol>
    <div className="match-result-confirm">
      <p>Take a moment. {finished?'The match is complete.':'The host starts the next song after everyone is ready.'}</p>
      {me ? <>
        <div className="match-result-actions">
          {!me.ready ? <button className="match-primary" disabled={!armed||pending||!connected} onClick={onReady}>I’m ready<Check size={17}/></button>
            : <button className="match-ready-toggle" disabled={pending||!connected} onClick={onUnready}><Check size={16}/>Ready · undo</button>}
          {isHost && me.ready && <button className="match-primary" disabled={!armed||pending||!connected||!allReady||(finished&&online.length<2)} onClick={onContinue}>{pending?'Starting…':finished?'Start new match':'Start next song'}<ArrowRight size={17}/></button>}
        </div>
        <p className="match-confirm-status" role="status">{readyCount}/{present.length} ready · {allReady ? isHost ? 'You choose when to start.' : `Waiting for ${hostName} to start.` : 'Waiting for everyone to review.'}</p>
        {finished && <small>{carryScores?'Points carry into the next match.':'A new match starts from zero.'}</small>}
        {error && <p role="alert">{error} {isHost?'Your results are saved. You can retry.':''}</p>}
      </> : <p className="match-confirm-status">The players are reviewing their results.</p>}
    </div>
  </div>
}
