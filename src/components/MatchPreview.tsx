import { useEffect, useState } from 'react'
import { MatchArena } from './MatchArena'
import { NootProfile } from './NootProfile'
import type { useSitting } from '../hooks/useSitting'
import type { MatchEntry, MatchView } from '../../shared/match'
import type { RankedPlayer } from '../../shared/sitting'
import { parseAppearance } from '../../shared/noot-profile'
import type { Difficulty } from '../lib/api'

type Mode = 'lobby'|'playing'|'perfect'|'tie'|'finished'
const names = ['You','Milo','Luna']
/** Development-only fixture: the production arena rendered with local game states. */
export default function MatchPreview() {
  const [mode,setMode] = useState<Mode>('playing'), [theme,setTheme] = useState<'light'|'dark'>('light')
  const [profile,setProfile] = useState(false), [stage,setStage] = useState(0), [greeting,setGreeting] = useState({from:'',at:0,target:''})
  const [epoch,setEpoch] = useState(()=>Date.now())
  const [ready,setReady] = useState(false), [connected,setConnected] = useState(true)
  const [difficulty,setDifficulty] = useState<Difficulty>('easy')
  const entries: MatchEntry[] = names.map((name,i)=>({id:String(i),name,points:[12500,12000,8500][i],stage:i===0?stage:1,status:'playing',lastAction:'ready',delta:0,history:[5000,4000,3500]}))
  if (mode==='perfect'||mode==='tie'||mode==='finished') entries.forEach((e,i)=>{e.status='solved';e.lastAction='solved';e.delta=[5000,4000,3000][i];e.points=[17500,16000,11500][i];e.solvedAt=epoch+i*5000})
  if (mode==='tie'||mode==='finished') entries[1].points=17500
  entries[0].ready = ready
  const players: RankedPlayer[] = entries.map((e,i)=>({...e,rank:i+1,connected:true,joinedAt:epoch-120000,appearance:parseAppearance(i===1?{headgear:'beanie',clothing:'shirt',accessoryColor:'rose'}:i===2?{headgear:'bucket',clothing:'bandana',accessoryColor:'blue'}:{}),...(greeting.target===e.id?{greeting:{from:greeting.from,at:greeting.at}}:{})}))
  const match: MatchView|null = mode==='lobby'?null:{scoringVersion:2,id:'preview',roundId:'round-'+mode,number:mode==='finished'?10:4,phase:mode==='playing'?'playing':mode==='finished'?'finished':'reveal',difficulty,length:10,startsAt:epoch,deadline:epoch+90000,entries,audio:'',offset:0,answer:mode==='playing'?null:{id:'preview-song',title:'A perfect little moment',artist:'Local preview track',albumArt:''}}
  useEffect(()=>{const open=()=>setProfile(true);window.addEventListener('open-noot-profile',open);return()=>window.removeEventListener('open-noot-profile',open)},[])
  useEffect(()=>{document.documentElement.dataset.theme=theme},[theme])
  const noop=()=>{}
  const table: ReturnType<typeof useSitting> = {playerId:'0',hostId:'0',match,players,visiblePlayers:players,you:players[0],status:connected?'live':'connecting',live:connected,code:'NOOT42',name:'You',setName:noop,query:'',setQuery:noop,joinCode:'',setJoinCode:noop,friends:[],slow:false,pending:null,error:null,message:null,matchError:null,clockOffset:0,inviteUrl:location.origin+'/?match-preview',inviteCode:null,host:async()=>{},join:async()=>{},leave:()=>setMode('lobby'),reconnect:()=>setConnected(true),reportScore:noop,reportActivity:noop,greet:target=>setGreeting({from:'0',at:Date.now(),target}),sendMatch:command=>{if(command.type==='match-skip')setStage(s=>Math.min(4,s+1));else if(command.type==='match-start'||command.type==='match-next'&&mode==='finished'){setStage(0);setReady(false);setEpoch(Date.now());setMode('playing')}else if(command.type==='match-next')setReady(true);else if(command.type==='match-guess')setMode('perfect')}}
  return <><div className="match-preview-controls"><strong>Local preview</strong>{(['lobby','playing','perfect','tie','finished'] as const).map(m=><button key={m} aria-pressed={mode===m} onClick={()=>{setMode(m);setStage(0);setReady(false);setEpoch(Date.now())}}>{m}</button>)}<button onClick={()=>setTheme(t=>t==='light'?'dark':'light')}>Theme</button><button onClick={()=>setProfile(true)}>Wardrobe</button><button aria-pressed={!connected} onClick={()=>setConnected(c=>!c)}>Offline</button><select aria-label="Preview difficulty" value={difficulty} onChange={e=>setDifficulty(e.target.value as Difficulty)}>{(['easy','medium','hard','expert','impossible'] as const).map(d=><option key={d}>{d}</option>)}</select></div><MatchArena table={table} theme={theme}/>{profile&&<NootProfile onClose={()=>setProfile(false)}/>}</>
}
