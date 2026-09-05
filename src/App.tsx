import { lazy, Suspense } from 'react'
import { Game } from './components/Game'
import './fonts.css'
import './seo-chrome.css'
import './game-shell.css'
import './console.css'
import './noot.css'

const NootStudio = import.meta.env.DEV ? lazy(() => import('./components/NootStudio')) : null

function App() {
  if (NootStudio && new URLSearchParams(window.location.search).has('noot-studio')) {
    return <Suspense fallback={null}><NootStudio /></Suspense>
  }
  return <Game />
}

export default App
