import { previewMelody } from '../lib/preview-melody'
import { useEffect, useState } from 'react'
import { MatchArena } from './MatchArena'
import { NootProfile } from './NootProfile'
import type { useSitting } from '../hooks/useSitting'
import type { MatchEntry, MatchView } from '../../shared/match'
import type { RankedPlayer } from '../../shared/sitting'
import { parseAppearance } from '../../shared/noot-profile'
import type { Difficulty } from '../lib/api'

type Mode = 'lobby'|'playing'|'perfect'|'tie'|'finished'|'timeout'|'spectator'|'passed'
const names = ['You','Milo','Luna','Sofia','Kai','Amara','Alexandra Marie','Gabriel','Isabella','Theo','Harper','Oliver']
/** Development-only fixture: the production arena rendered with local game states. */
export default function MatchPreview() {
  const [scoreBoost,setScoreBoost] = useState<Record<string,number>>({})
  const [action,setAction] = useState<MatchEntry['lastAction']>('ready')
  const [out,setOut] = useState(false)
  const [count,setCount] = useState(3)
  const [audio,setAudio] = useState('')
  useEffect(() => { const url = previewMelody(); setAudio(url); return () => URL.revokeObjectURL(url) }, [])
  const [mode,setMode] = useState<Mode>('playing'), [theme,setTheme] = useState<'light'|'dark'>('light')
  const [profile,setProfile] = useState(false), [stage,setStage] = useState(0), [greeting,setGreeting] = useState({from:'',at:0,target:''})
  const [epoch,setEpoch] = useState(()=>Date.now())
  const [ready,setReady] = useState(false), [connected,setConnected] = useState(true)
  const [difficulty,setDifficulty] = useState<Difficulty>('easy')
  const entries: MatchEntry[] = names.slice(0,count).map((name,i)=>({id:String(i),name,points:Math.max(0, [12,11,8][i] ?? 8-i),stage:i===0?stage:1,status:i===0&&out?'out':'playing',lastAction:i===0?action:'ready',attempts:i===0?([.1,.5,2,8,15].slice(0,out?5:stage).map(stage=>({stage,kind:'skip' as const}))):[],delta:0,history:[5,4,3]}))
  if (mode==='perfect'||mode==='tie'||mode==='finished') entries.forEach((e,i)=>{e.status='solved';e.lastAction='solved';e.delta=[5,4,3][i] ?? 1;e.points=[17,15,11][i] ?? 9-i;e.solvedAt=epoch+i*5000})
  if (mode==='tie'||mode==='finished') entries[1].points=17
  if (mode==='passed') entries.forEach(e=>{e.status='out';e.lastAction='skip';e.stage=4;e.attempts=[.1,.5,2,8,15].map(stage=>({stage,kind:'skip'}))})
  if (mode==='timeout') entries.forEach(e=>{e.status='out';e.lastAction='timeout'})
  entries.forEach(e => { e.points += scoreBoost[e.id] ?? 0 })
  entries[0].ready = ready
  const players: RankedPlayer[] = entries.map((e,i)=>({...e,rank:i+1,connected:true,joinedAt:epoch-120000,appearance:parseAppearance(i===1?{headgear:'beanie',clothing:'shirt',accessoryColor:'rose'}:i===2?{headgear:'bucket',clothing:'bandana',accessoryColor:'blue'}:{}),...(greeting.target===e.id?{greeting:{from:greeting.from,at:greeting.at}}:{})}))
  const match: MatchView|null = mode==='lobby'?null:{scoringVersion:3,id:'preview',roundId:'round-'+mode+'-'+epoch,number:mode==='finished'?10:4,phase:mode==='playing'||mode==='spectator'?'playing':mode==='finished'?'finished':'reveal',difficulty,length:10,startsAt:epoch,deadline:epoch+90000,entries:mode==='spectator'?entries.slice(1):entries,audio,offset:0,answer:mode==='playing'||mode==='spectator'?null:{id:'preview-song',title:'A perfect little moment',artist:'Original preview melody',albumArt:''}}
  if (match) match.completedRounds = [
    {roundId:'earlier-win',number:1,answer:{id:'melody-one',title:'A quiet afternoon',artist:'Original preview melody'},results:entries.map(e=>({id:e.id,stage:0,status:'solved',lastAction:'solved',delta:5,attempts:[]}))},
    {roundId:'earlier-pass',number:2,answer:{id:'melody-two',title:'One more melody',artist:'Original preview melody'},results:entries.map(e=>({id:e.id,stage:4,status:'out',lastAction:'skip',delta:0,attempts:[.1,.5,2,8,15].map(stage=>({stage,kind:'skip'}))}))},
    ...(match.answer ? [{roundId:match.roundId,number:match.number,answer:match.answer,results:entries.map(({id,stage,status,lastAction,delta,attempts})=>({id,stage,status,lastAction,delta,attempts}))}] : []),
  ]
  useEffect(()=>{const open=()=>setProfile(true);window.addEventListener('open-noot-profile',open);return()=>window.removeEventListener('open-noot-profile',open)},[])
  useEffect(()=>{document.documentElement.dataset.theme=theme},[theme])
  const noop=()=>{}
  const table: ReturnType<typeof useSitting> = {nootChannel:undefined,playerId:'0',hostId:'0',match,players,visiblePlayers:players,you:players[0],status:connected?'live':'connecting',live:connected,code:'NOOT42',name:'You',setName:noop,query:'',setQuery:noop,joinCode:'',setJoinCode:noop,friends:[],slow:false,pending:null,error:null,message:null,matchError:null,clockOffset:0,inviteUrl:location.origin+'/?match-preview',inviteCode:null,host:async()=>{},join:async()=>{},leave:()=>setMode('lobby'),reconnect:()=>setConnected(true),reportScore:noop,reportActivity:noop,greet:target=>setGreeting({from:'0',at:Date.now(),target}),sendMatch:command=>{if(command.type==='match-skip'){setAction('skip');if(stage===4)setOut(true);else setStage(s=>s+1);}else if(command.type==='match-start'||command.type==='match-next'&&mode==='finished'){setStage(0);setAction('ready');setOut(false);setReady(false);setEpoch(Date.now());setMode('playing')}else if(command.type==='match-next')setReady(true);else if(command.type==='match-guess')setMode('perfect')}}
  return <><div className="match-preview-controls"><strong>Local preview · generated melody</strong><select aria-label="Preview players" value={count} onChange={e=>setCount(Number(e.target.value))}>{[2,3,6,12].map(n=><option key={n} value={n}>{n} players</option>)}</select>{(['lobby','playing','perfect','tie','finished','timeout','spectator','passed'] as const).map(m=><button key={m} aria-pressed={mode===m} onClick={()=>{setMode(m);setStage(0);setAction('ready');setOut(false);setReady(false);setEpoch(Date.now())}}>{m}</button>)}<button onClick={()=>setScoreBoost(v=>({...v,1:(v[1]??0)+2}))}>Milo +2</button><button onClick={()=>setScoreBoost(v=>({...v,0:(v[0]??0)+2}))}>You +2</button><button onClick={()=>setScoreBoost({})}>Reset scores</button><button onClick={()=>setTheme(t=>t==='light'?'dark':'light')}>Theme</button><button onClick={()=>setProfile(true)}>Wardrobe</button><button aria-pressed={!connected} onClick={()=>setConnected(c=>!c)}>Offline</button><select aria-label="Preview difficulty" value={difficulty} onChange={e=>setDifficulty(e.target.value as Difficulty)}>{(['easy','medium','hard','expert','impossible'] as const).map(d=><option key={d}>{d}</option>)}</select></div><MatchArena table={table} theme={theme}/>{profile&&<NootProfile onClose={()=>setProfile(false)}/>}</>
}
