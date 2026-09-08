import React, {useState} from 'react'
import {createRoot} from 'react-dom/client'
import {NootParty} from '../../../src/components/NootParty'
import {Ruler} from '../../../src/components/Ruler'
import '../../../src/fonts.css'
import '../../../src/game-shell.css'
import '../../../src/console.css'
import './study.css'
const names=['You','Milo','Luna']
function Study(){const [layout,setLayout]=useState('A'),[stage,setStage]=useState(0),[selection,setSelection]=useState('');return <div className="app-shell study" data-theme="light" data-difficulty="easy" data-layout={layout}>
<nav>{['A','B','C'].map(x=><button onClick={()=>setLayout(x)} aria-pressed={x===layout}>{x}</button>)}</nav>
<header><span className="brand">SongGuessr</span><span>Table NOOT42 · 3 listening</span><button>Leave table</button></header>
<main><section className="instrument"><div className="context">Song 4 of 10 · Easy</div><h1>{[.1,.5,2,8,15][stage]}<small>s</small></h1><NootParty theme="light" paused participants={names.map((name,i)=>({id:String(i),name,state:{pose:'idle',difficulty:'easy'}}))}/><Ruler stages={[.1,.5,2,8,15]} stageIndex={stage} marks={[]} status="playing"/><div className="transport"><button>▶</button><input placeholder="Name the track" value={selection} onChange={e=>setSelection(e.target.value)}/><button onClick={()=>{setStage(s=>Math.min(4,s+1));setSelection('')}}>{selection?'Guess':'Skip'}</button></div><p>5,000 points available <span>1:12 left</span></p></section><aside><h2>Standings</h2>{names.map((n,i)=><div className="seat"><span>{i+1}</span><strong>{n}</strong><span>{[12500,12000,8500][i].toLocaleString()}</span></div>)}</aside></main></div>}
createRoot(document.getElementById('root')!).render(<Study/>);
