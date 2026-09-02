import { useEffect, useRef, useState } from 'react'
import type { Difficulty } from '../lib/api'
import {
  MASCOT_DURATION_MS,
  mascotPaletteVars,
  mascotPoseDurationMs,
  resolveMascotPose,
  type MascotIntent,
  type MascotLoseReason,
  type MascotPose,
} from '../lib/mascot'
import { NootRig } from './NootRig'

/**
 * Noot mascot.
 *
 * A single inline vector rig (`NootRig`) whose reactions are CSS animations
 * keyed off `data-pose`. Because every pose shares one viewBox and one
 * ground-anchored transform origin, Noot never changes size or drifts
 * between states — the thing the old flipbook player could not guarantee.
 *
 * Difficulty colour is a plain CSS custom-property swap, so switching levels
 * is one quick squash-and-pop while the fills cross-fade. No extra assets.
 *
 * Not affiliated with Duolingo.
 */
interface MascotProps {
  difficulty: Difficulty
  intent: MascotIntent
  withStreak?: boolean
  loseReason?: MascotLoseReason
}

/** Pointer poses only take over while the game is otherwise resting. */
function acceptsPointerPose(intent: MascotIntent) {
  return intent === 'idle'
}

export function Mascot({ difficulty, intent, withStreak = false, loseReason = 'wrong' }: MascotProps) {
  const [hovered, setHovered] = useState(false)
  const [tapping, setTapping] = useState(false)
  /** Set while a win is being chased by its streak celebration. */
  const [chasingStreak, setChasingStreak] = useState(false)

  const hostRef = useRef<HTMLDivElement | null>(null)
  const hoveredRef = useRef(false)
  const tapTimerRef = useRef<number | null>(null)
  const streakTimerRef = useRef<number | null>(null)

  const baseIntent: MascotIntent = !acceptsPointerPose(intent)
    ? intent
    : tapping
      ? 'tap'
      : hovered
        ? 'hover'
        : 'idle'

  const pose: MascotPose = chasingStreak ? 'streak' : resolveMascotPose(baseIntent, loseReason)

  // Leaving idle cancels any pointer pose so hover/tap can't stick.
  useEffect(() => {
    if (acceptsPointerPose(intent)) return
    setHovered(false)
    setTapping(false)
    hoveredRef.current = false
    if (tapTimerRef.current !== null) {
      window.clearTimeout(tapTimerRef.current)
      tapTimerRef.current = null
    }
  }, [intent])

  // A streak win plays `win`, then hands off to the bigger `streak` reaction.
  useEffect(() => {
    if (streakTimerRef.current !== null) {
      window.clearTimeout(streakTimerRef.current)
      streakTimerRef.current = null
    }

    if (intent !== 'win' || !withStreak) {
      setChasingStreak(false)
      return
    }

    setChasingStreak(false)
    streakTimerRef.current = window.setTimeout(() => {
      setChasingStreak(true)
      streakTimerRef.current = null
    }, MASCOT_DURATION_MS.win)

    return () => {
      if (streakTimerRef.current !== null) {
        window.clearTimeout(streakTimerRef.current)
        streakTimerRef.current = null
      }
    }
  }, [intent, withStreak])

  useEffect(() => {
    return () => {
      if (tapTimerRef.current !== null) window.clearTimeout(tapTimerRef.current)
      if (streakTimerRef.current !== null) window.clearTimeout(streakTimerRef.current)
    }
  }, [])

  /**
   * Restart the pose animations without remounting the rig.
   *
   * Remounting would reset the fills too, which kills the colour cross-fade
   * on a difficulty switch. Nudging `animation` across a forced reflow
   * replays the one-shots while leaving the transitions running.
   */
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const targets = host.querySelectorAll<SVGElement>('.noot, .noot-root, .noot-note, .noot-spark')
    for (const target of targets) target.style.animation = 'none'
    host.getBoundingClientRect()
    for (const target of targets) target.style.removeProperty('animation')
  }, [pose])

  function handlePointerEnter() {
    if (!acceptsPointerPose(intent)) return
    hoveredRef.current = true
    setHovered(true)
  }

  function handlePointerLeave() {
    hoveredRef.current = false
    setHovered(false)
  }

  function handlePointerDown() {
    if (!acceptsPointerPose(intent) || tapping) return
    setTapping(true)
    if (tapTimerRef.current !== null) window.clearTimeout(tapTimerRef.current)
    tapTimerRef.current = window.setTimeout(() => {
      setTapping(false)
      tapTimerRef.current = null
      // Fall back to the hover hold if the pointer never left.
      setHovered(hoveredRef.current)
    }, mascotPoseDurationMs('tap'))
  }

  return (
    <div
      ref={hostRef}
      className={`mascot mascot-${difficulty}${acceptsPointerPose(intent) ? ' is-interactive' : ''}`}
      style={mascotPaletteVars(difficulty)}
      data-pose={pose}
      aria-hidden="true"
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onPointerDown={handlePointerDown}
    >
      <NootRig />
    </div>
  )
}
