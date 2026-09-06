import {NootProfile} from './components/NootProfile'
import { lazy, Suspense, useState, useEffect } from 'react'
import { Game } from './components/Game'
import './fonts.css'
import './seo-chrome.css'
import './game-shell.css'
import './console.css'
import './noot.css'

const NootStudio = import.meta.env.DEV ? lazy(() => import('./components/NootStudio')) : null

function App() {
  const [profile,setProfile]=useState(()=>{try{return !localStorage.getItem('songguessr-profile-seen')}catch{return true}})
  useEffect(()=>{const open=()=>setProfile(true);window.addEventListener('open-noot-profile',open);return()=>window.removeEventListener('open-noot-profile',open)},[])
  const closeProfile=()=>{try{localStorage.setItem('songguessr-profile-seen','1')}catch{/* Session only. */}setProfile(false)}

  if (NootStudio && new URLSearchParams(window.location.search).has('noot-studio')) {
    return <Suspense fallback={null}><NootStudio /></Suspense>
  }
  return <><Game />{profile&&<NootProfile onClose={closeProfile}/>}</>
}

export default App
