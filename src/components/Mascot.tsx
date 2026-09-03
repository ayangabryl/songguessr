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

/**
 * Reaction pools. One gesture per event reads as mechanical by the third
 * round, so each event picks from a small pool with no immediate repeat.
 * The pool members share timing and amplitude (see noot.css); only the
 * gesture differs. `default` is the base binding for the pose.
 */
const VARIANT_POOLS: Partial<Record<MascotPose, readonly string[]>> = {
  play: ['default', 'bop', 'sway'],
  win: ['default', 'twist', 'double'],
  lose: ['default', 'shake'],
}

/** Idle life signs: quiet one-shots dropped into the breathing loop. */
const IDLE_LIFE_SIGNS = ['sway', 'peek', 'bop'] as const
const IDLE_LIFE_SIGN_MS = 2200
/** Whole blink, lid down to lid up. Humans: ~100–400 ms; each blink draws its own length. */
const BLINK_MS = 280
const BLINK_JITTER_MS = 60

function pick(pool: readonly string[], previous: string | undefined) {
  const options = pool.length > 1 && previous ? pool.filter((v) => v !== previous) : pool
  return options[Math.floor(Math.random() * options.length)]
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

  // The gesture is chosen once per pose entry, during render (React's
  // "adjust state when a prop changes" pattern), with no immediate repeat.
  const [gesture, setGesture] = useState<{
    pose: MascotPose
    variant: string
    last: Partial<Record<MascotPose, string>>
  }>({ pose, variant: 'default', last: {} })
  if (gesture.pose !== pose) {
    const pool = VARIANT_POOLS[pose]
    const variant = pool ? pick(pool, gesture.last[pose]) : 'default'
    setGesture({ pose, variant, last: { ...gesture.last, [pose]: variant } })
  }

  // While idle, a life sign drops in every 6–12 s, then breathing resumes.
  const [lifeSign, setLifeSign] = useState<string | null>(null)
  useEffect(() => {
    if (pose !== 'idle') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let timer: number | null = null
    let previous: string | undefined
    const schedule = () => {
      timer = window.setTimeout(() => {
        const sign = pick(IDLE_LIFE_SIGNS, previous)
        previous = sign
        setLifeSign(sign)
        timer = window.setTimeout(() => {
          setLifeSign(null)
          schedule()
        }, IDLE_LIFE_SIGN_MS)
      }, 6000 + Math.random() * 6000)
    }
    schedule()
    return () => {
      if (timer !== null) window.clearTimeout(timer)
      setLifeSign(null)
    }
  }, [pose])

  const variant = pose === 'idle' && lifeSign ? lifeSign : gesture.variant

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
   * Blinking.
   *
   * A human blink is asymmetric: the lid drops in roughly a third of the time
   * and lifts in the remaining two thirds, with a brief hold at the bottom.
   * Intervals are irregular (here 1.6–7.6 s, peaked around 4.5 s), about one in
   * eight is a double, and both lids always move together. The lids are real
   * shapes sliding down over the eye (see `.noot-lid`), and the brows dip a
   * touch with them so the blink reads on the whole face, not just the eye.
   *
   * Driven with the Web Animations API so each phase is a fixed number of
   * milliseconds regardless of how long the gap before it was.
   */
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const lids = Array.from(host.querySelectorAll<SVGElement>('.noot-lid'))
    const brows = Array.from(host.querySelectorAll<SVGElement>('.noot-brow'))
    if (lids.length === 0) return

    let timer: number | null = null
    let disposed = false

    const blinkOnce = () => {
      const duration = BLINK_MS + (Math.random() * 2 - 1) * BLINK_JITTER_MS
      for (const lid of lids) {
        lid.animate(
          [
            { transform: 'translateY(-104%)', easing: 'cubic-bezier(0.55, 0, 1, 0.45)' },
            { transform: 'translateY(0%)', offset: 0.34 },
            { transform: 'translateY(0%)', offset: 0.46, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
            { transform: 'translateY(-104%)' },
          ],
          { duration, fill: 'none' },
        )
      }
      for (const brow of brows) {
        brow.animate(
          [{ transform: 'translateY(0)' }, { transform: 'translateY(9px)', offset: 0.38 }, { transform: 'translateY(0)' }],
          { duration: duration + 80, easing: 'ease-in-out', composite: 'add', fill: 'none' },
        )
      }
    }

    const schedule = () => {
      // Sum of two uniforms: most blinks land near 4–5 s, with an occasional
      // 7 s gap so the rhythm never settles (humans: ~6 s ± 2.4 at rest).
      const wait = 1600 + Math.random() * 2400 + Math.random() * 3600
      timer = window.setTimeout(() => {
        if (disposed) return
        blinkOnce()
        if (Math.random() < 0.13) window.setTimeout(() => !disposed && blinkOnce(), BLINK_MS + 90)
        schedule()
      }, wait)
    }
    schedule()

    return () => {
      disposed = true
      if (timer !== null) window.clearTimeout(timer)
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
      data-variant={variant}
      aria-hidden="true"
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onPointerDown={handlePointerDown}
    >
      <NootRig />
    </div>
  )
}
