import { installButtonSounds } from './lib/ui-audio'
import {NootProfile} from './components/NootProfile'
import { lazy, Suspense, useState, useEffect } from 'react'
import { Game } from './components/Game'
import './fonts.css'
import './seo-chrome.css'
import './game-shell.css'
import './console.css'
import './noot.css'
import './round-experience.css'

const NootStudio = import.meta.env.DEV ? lazy(() => import('./components/NootStudio')) : null

const MatchPreview = import.meta.env.DEV ? lazy(() => import('./components/MatchPreview')) : null

function App() {
  useEffect(installButtonSounds, [])
  const [profile,setProfile]=useState(()=>{try{return !localStorage.getItem('songguessr-profile-seen')}catch{return true}})
  const [welcome, setWelcome] = useState(profile)
  useEffect(()=>{const open=()=>{setWelcome(false);setProfile(true)};window.addEventListener('open-noot-profile',open);return()=>window.removeEventListener('open-noot-profile',open)},[])
  const closeProfile=()=>{try{localStorage.setItem('songguessr-profile-seen','1')}catch{/* Session only. */}setProfile(false);window.dispatchEvent(new Event("noot-profile-closed"))}

  if (MatchPreview && new URLSearchParams(window.location.search).has('match-preview')) return <Suspense fallback={null}><MatchPreview /></Suspense>
  if (NootStudio && new URLSearchParams(window.location.search).has('noot-studio')) {
    return <Suspense fallback={null}><NootStudio /></Suspense>
  }
  return <><Game />{profile&&<NootProfile onClose={closeProfile} welcome={welcome}/>}</>
}

export default App
