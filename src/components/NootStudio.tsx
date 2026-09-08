import { useState } from 'react'
import { ArrowLeft, RotateCcw, Pause, Play, Sun, Moon, Heart, Music2, Sparkles, Footprints, ArrowRight, Hand, CloudMoon, Headphones, Cat, Flower2, Circle } from 'lucide-react'
import { NootProfile } from './NootProfile'
import { Noot3D } from './Noot3D'
import { NootParty, type PartyCommand } from './NootParty'
import { MASCOT_PALETTES, mascotPaletteVars } from '../lib/mascot'
import { HEADGEAR, type NootAction, type NootMood } from '../lib/noot/types'
import { useNootPreferences } from '../lib/noot/preferences'
import type { Difficulty } from '../lib/api'
import type { NootParticipant } from '../lib/noot/social-world'
import '../noot-studio.css'

const ACTIONS = [
  { id:'idle', label:'Just chilling', icon:Heart, note:'A breath, a blink. Taking it all in.' },
  { id:'groove', label:'Listening groove', icon:Music2, note:'A relaxed groove, following the music.' },
  { id:'body-roll', label:'Body roll', icon:Music2, note:'A soft roll through the body, with a little antenna follow-through.' },
  { id:'charleston', label:'Charleston', icon:Footprints, note:'Playful steps, made for very small feet.' },
  { id:'hip-sway', label:'Hip sway', icon:Music2, note:'A weight shift and a cheerful swing.' },
  { id:'victory-dance', label:'Victory pump', icon:Sparkles, note:'A little fist pump. You got it!' },
  { id:'friendly-wave', label:'Friendly wave', icon:Hand, note:'A warm hello, with a soft return to rest.' },
  { id:'samba', label:'Samba steps', icon:Music2, note:'A loose sway, a weight shift, a little spring in the feet.' },
  { id:'outfit', label:'Outfit moment', icon:Sparkles, note:'A little adjustment, just the way Noot likes it.' },
  { id:'dance', label:'Little dance', icon:Sparkles, note:'Small feet. Excellent rhythm.' },
  { id:'happy-song', label:'Happy song', icon:Music2, note:'This one goes straight to the happy place.' },
  { id:'sad-song', label:'Sad song', icon:Music2, note:'Some songs deserve a quiet little sway.' },
  { id:'walk', label:'Take a walk', icon:Footprints, note:'One little foot in front of the other.' },
  { id:'skip', label:'Skip right', icon:ArrowRight, note:'Off to the next song!' },
  { id:'hover', label:'Say hello', icon:Hand, note:'Oh! Hi, you.' },
  { id:'tap', label:'Give a pet', icon:Heart, note:'Noot appreciates the attention.' },
  { id:'win', label:'Celebrate', icon:Sparkles, note:'You knew that one. Noot knew you would.' },
  { id:'listen-close', label:'Hold an earcup', icon:Headphones, note:'Wait… I know this part.' },
  { id:'shrug', label:'Curious shrug', icon:Hand, note:'Hmm… what could it be?' },
  { id:'cheer', label:'Little cheer', icon:Sparkles, note:'That’s the one!' },
  { id:'sleepy', label:'Getting sleepy', icon:CloudMoon, note:'Just resting those listening ears.' },
  { id:'stretch', label:'Big stretch', icon:Hand, note:'A little stretch between songs.' },
  { id:'angry', label:'Tiny grump', icon:CloudMoon, note:'That was almost the right song.' },
  { id:'laugh', label:'Have a giggle', icon:Heart, note:'Some things are just funny.' },
  { id:'sit', label:'Show the paws', icon:Footprints, note:'Soft little paws, all the way underneath.' },
  { id:'tumble', label:'Oops… recover', icon:RotateCcw, note:'A wobble, a soft landing, back on those feet.' },
] as const

export default function NootStudio() {
  const [profile, setProfile] = useState(false)
  const [pose, setPose] = useState<NootAction>('idle')
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  const [preferences, updatePreferences] = useNootPreferences()
  const [yaw, setYaw] = useState(0)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [eventId, setEventId] = useState(0)
  const [paused, setPaused] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [direction, setDirection] = useState(1)
  const [compare, setCompare] = useState(true)
  const [friends, setFriends] = useState(false)
  const [partySize, setPartySize] = useState(2)
  const [selected, setSelected] = useState('noot')
  const [command, setCommand] = useState<PartyCommand>()
  const roster: NootParticipant[] = [
    { id: 'noot', name: 'Noot', state: { ...preferences, pose, difficulty, theme, eventId } },
    { id: 'milo', name: 'Milo', state: { pose: 'idle', difficulty: 'medium', headgear: 'cat-earphones', clothing: 'bandana', accessoryColor: 'blue' } },
    { id: 'lumi', name: 'Lumi', state: { pose: 'idle', difficulty: 'expert', headgear: 'daisy' } },
    { id: 'pip', name: 'Pip', state: { pose: 'idle', difficulty: 'hard', headgear: 'headphones' } },
    { id: 'coco', name: 'Coco', state: { pose: 'idle', difficulty: 'impossible', headgear: 'beanie', accessoryColor: 'rose' } },
    { id: 'bea', name: 'Bea', state: { pose: 'idle', difficulty: 'easy', headgear: 'bucket', accessoryColor: 'lavender' } },
  ].slice(0,partySize) as NootParticipant[]
  function playWithFriend(action: PartyCommand['action'], actor = selected) {
    const index = Math.max(0,roster.findIndex(p => p.id === actor))
    setCommand(value => ({ id: (value?.id ?? 0) + 1, action, actor: roster[index].id, friend: roster[index === roster.length-1 ? index-1 : index+1].id })); setPaused(false)
  }
  function perform(action: NootAction, direction = 1) {
    setPose(action); setDirection(direction); setEventId(n => n + 1); setPaused(false)
    const mood: NootMood | undefined = action === 'dance' ? 'dance' : action === 'happy-song' ? 'happy' : action === 'sad-song' ? 'sad' : action === 'idle' ? 'chill' : undefined
    if (mood) updatePreferences({mood})
  }
  const current = ACTIONS.find(a=>a.id===pose)
  return (
    <main className="noot-studio" data-theme={theme}>
      <header className="studio-header">
        <a href="/" className="studio-back"><ArrowLeft size={16} /> Back to SongGuessr</a>
        <span className="studio-wordmark">noot<span> / </span>studio</span>
        <button className="studio-theme" onClick={()=>setTheme(t=>t==='light'?'dark':'light')} aria-label={`Use ${theme==='light'?'dark':'light'} lighting`}>
          {theme==='light'?<Moon size={17}/>:<Sun size={17}/>}<span>{theme==='light'?'Night light':'Daylight'}</span>
        </button>
      </header>
      <div className={`studio-layout${compare && !friends ? ' has-comparison' : ''}`}>
        <section className="studio-stage" aria-label="Noot character preview">
          <div className="studio-intro"><span className="studio-eyebrow">YOUR LITTLE LISTENING BUDDY</span><h1>A little note.<br/><em>A lot of personality.</em></h1></div>
          <button className="studio-compare-toggle" aria-pressed={friends} onClick={() => setFriends(value => !value)}>{friends ? 'Back to one Noot' : 'Bring a friend'}</button>
          {!friends && <button className="studio-compare-toggle" aria-pressed={compare} onClick={() => { setCompare(value => !value); setYaw(0) }}>{compare ? 'Focus on 3D' : 'Compare photo, SVG & 3D'}</button>}
          {friends ? <>
            <div className="noot-playground-controls">
              <label>Friends <select aria-label="Number of Noots" value={partySize} onChange={e => { setPartySize(Number(e.target.value)); setSelected('noot'); setCommand(undefined) }}>{[2,3,4,6].map(n => <option key={n} value={n}>{n} Noots</option>)}</select></label>
              <label>Play as <select aria-label="Selected Noot" value={selected} onChange={e => setSelected(e.target.value)}>{roster.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
            </div>
            <NootParty participants={roster} theme={theme} paused={paused} speed={speed} command={command} onChoose={id => { setSelected(id); playWithFriend('hello',id) }} />
            <div className="noot-playground-controls">{([
              ['hello','Say hello'], ['high-five','High five'], ['boop','A little boop'], ['dance','Dance together'], ['comfort','Make up'], ['jump','Little jump'], ['wave-chain','Pass a wave'], ['group-dance','Everybody dance'],
            ] as const).map(([action,label]) => <button key={action} onClick={() => playWithFriend(action)}>{label}</button>)}</div>
            <p className="noot-playground-note">Choose a Noot to play with their neighbor, or invite everybody in. Drag gently and release to set them down. On the playground, arrows choose and Space jumps.</p>
          </> : <>
          <div className={`studio-comparison${compare ? ' is-comparing' : ''}`}>
          {compare && <figure className="studio-reference"><img src="/mascot/noot-reference.jpg" alt="Original Noot reference: bright green pear-shaped music note with big brown eyes and charcoal headphones"/><figcaption>Original photo</figcaption></figure>}
          {compare && <figure className="studio-reference studio-svg"><img src="/mascot/noot-vector-source.svg" alt="Original Noot SVG artwork"/><figcaption>Our SVG</figcaption></figure>}
          <div className="studio-live">
          <div className="studio-character mascot" style={mascotPaletteVars(difficulty)} role="button" tabIndex={0} aria-label="Pet Noot" onClick={()=>perform('tap')} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();perform('tap')}}}>
            <Noot3D {...preferences} comparison={compare} pose={pose} difficulty={difficulty} theme={theme} viewYaw={yaw} eventId={eventId} paused={paused} speed={speed} direction={direction}/>
          </div>
          {compare && <p className="studio-live-label">Live 3D · turn to inspect</p>}
          </div>
          </div>
          </>}
          <p className="studio-caption" aria-live="polite">{current?.note ?? 'Let’s hear the next one.'}</p>
          <div className="studio-playback">
            <button onClick={()=>setPaused(p=>!p)} aria-label={paused?'Resume animation':'Pause animation'}>{paused?<Play size={16}/>:<Pause size={16}/>}</button>
            <button onClick={()=>{setEventId(n=>n+1);setPaused(false)}} aria-label="Replay animation"><RotateCcw size={16}/></button>
            <span className="studio-playback-divider"/>
            <label>Speed<select aria-label="Animation speed" value={speed} onChange={e=>setSpeed(Number(e.target.value))}><option value={.5}>½×</option><option value={1}>1×</option><option value={1.5}>1½×</option></select></label>
          </div>
          {!friends && <div className="studio-turntable">
            <label htmlFor="noot-rotation">A good side? Every side.</label>
            <input id="noot-rotation" type="range" min={-180} max={180} step={1} value={Math.round(yaw*180/Math.PI)} onChange={e=>setYaw(Number(e.target.value)*Math.PI/180)}/>
            <div>{[{label:'Front',value:0},{label:'¾ view',value:.65},{label:'Side',value:Math.PI/2},{label:'Back',value:Math.PI}].map(v=><button key={v.label} aria-pressed={Math.abs(yaw-v.value)<.02} onClick={()=>setYaw(v.value)}>{v.label}</button>)}</div>
          </div>}
        </section>
        <aside className="studio-controls">
          <section className="studio-control-section">
            <div className="studio-section-title"><span>01</span><h2>What’s the mood?</h2></div>
            <div className="studio-actions">{ACTIONS.map(({id,label,icon:Icon})=><button key={id} aria-pressed={pose===id} onClick={()=>perform(id)}><Icon size={17}/>{label}</button>)}</div>
            <div className="studio-extra-actions"><button onClick={()=>perform('skip',-1)}><ArrowLeft size={14}/> Skip left</button><button onClick={()=>perform('run')}>Run <Footprints size={14}/></button><button onClick={()=>perform('lose')}>Little frown</button></div>
          </section>
          <section className="studio-control-section">
            <div className="studio-section-title"><span>02</span><h2>A little dress-up.</h2></div>
            <div className="studio-outfits">{HEADGEAR.map(gear=><button key={gear.id} aria-pressed={preferences.headgear===gear.id} onClick={()=>updatePreferences({headgear:gear.id})} title={gear.description}><span className={`studio-gear-icon gear-${gear.id}`} aria-hidden="true">{gear.id==='beanie'||gear.id==='bucket'?<svg width={29} height={29} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{gear.id==='beanie'?<><path d="M5 16v-3a7 7 0 0 1 14 0v3M8 15v-4m4 4V9m4 6v-4"/><rect x="4" y="16" width="16" height="5" rx="2"/></>:<><path d="m6 15 1-8c2-2 8-2 10 0l1 8M6 15l-3 4q9 4 18 0l-3-4M6 15q6 2 12 0"/></>}</svg>:gear.id==='daisy'?<Flower2 size={29}/>:gear.id==='none'?<Circle size={27}/>:gear.id==='cat-earphones'?<Cat size={29}/>:<Headphones size={28}/>}</span><span>{gear.label}</span></button>)}</div>
            <button className="studio-compare-toggle" onClick={()=>setProfile(true)}>Open the full wardrobe</button>
            <p className="studio-help">Noot’s outfit and listening mood follow him into your game.</p>
          </section>
          <section className="studio-control-section studio-color-section">
            <div className="studio-section-title"><span>03</span><h2>Show your colors.</h2></div>
            <div className="studio-colors">{Object.entries(MASCOT_PALETTES).map(([id,palette])=><button key={id} aria-label={`${id} color`} aria-pressed={difficulty===id} style={{'--swatch':palette.body} as React.CSSProperties} onClick={()=>setDifficulty(id as Difficulty)}><span/></button>)}</div>
            <p className="studio-color-label">{difficulty} <span>difficulty palette</span></p>
          </section>
        </aside>
      </div>
      {profile && <NootProfile onClose={()=>setProfile(false)}/>}
      <footer className="studio-footer"><span>Made for music. And a little company.</span><span>Move your pointer to catch Noot’s eye. Tap for a pet.</span></footer>
    </main>
  )
}
