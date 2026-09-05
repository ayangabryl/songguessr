import { useEffect, useRef, useState } from 'react'
import type { Difficulty } from '../lib/api'
import { MASCOT_DURATION_MS, mascotPaletteVars, resolveMascotPose, type MascotIntent, type MascotLoseReason } from '../lib/mascot'
import { Noot3D } from './Noot3D'
import { useNootPreferences } from '../lib/noot/preferences'

interface MascotProps {
  difficulty: Difficulty
  intent: MascotIntent
  withStreak?: boolean
  loseReason?: MascotLoseReason
  theme?: 'light' | 'dark'
  eventId?: number
  direction?: number
}

/** Game events and small pointer gestures feed the same continuous 3D rig. */
export function Mascot({ difficulty, intent, withStreak = false, loseReason = 'wrong', theme = 'light', eventId = 0, direction = 1 }: MascotProps) {
  const [preferences] = useNootPreferences()
  const [pointerPose, setPointerPose] = useState<'idle' | 'hover' | 'tap'>('idle')
  const [petEvent, setPetEvent] = useState(0)
  const [streakReady, setStreakReady] = useState(false)
  const pointerTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const resting = intent === 'idle'
  useEffect(() => {
    if (intent !== 'win' || !withStreak) return
    const timer = setTimeout(() => setStreakReady(true), MASCOT_DURATION_MS.win)
    return () => { clearTimeout(timer); setStreakReady(false) }
  }, [intent, withStreak])
  useEffect(() => () => clearTimeout(pointerTimer.current), [])
  const resolved = resolveMascotPose(resting ? pointerPose : intent, loseReason)
  const pose = intent === 'win' && withStreak && streakReady ? 'streak' : resolved
  function gesture(next: 'hover' | 'tap') {
    if (!resting) return
    clearTimeout(pointerTimer.current)
    setPointerPose(next); setPetEvent(n => n + 1)
    pointerTimer.current = setTimeout(() => setPointerPose('idle'), MASCOT_DURATION_MS[next])
  }
  return (
    <div
      className={`mascot mascot-${difficulty}${resting ? ' is-interactive' : ''}`}
      style={mascotPaletteVars(difficulty)}
      data-pose={pose}
      role={resting ? 'button' : 'img'}
      aria-label={resting ? 'Pet Noot' : 'Noot, your listening buddy'}
      tabIndex={resting ? 0 : undefined}
      onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); gesture('tap') } }}
      onPointerEnter={() => gesture('hover')}
      onPointerDown={() => gesture('tap')}
    >
      <Noot3D pose={pose} difficulty={difficulty} headgear={preferences.headgear} mood={preferences.mood} theme={theme} eventId={eventId + petEvent} direction={direction} onRuler />
    </div>
  )
}
