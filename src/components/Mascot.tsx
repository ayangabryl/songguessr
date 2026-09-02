import { useEffect, useState, type CSSProperties } from 'react'
import type { Difficulty } from '../lib/api'
import type { MascotMood } from '../lib/mascot'

/**
 * Noot mascot: keyed PNG flipbooks from the video-kit sequences.
 * Not affiliated with Duolingo.
 */
interface MascotProps {
  difficulty: Difficulty
  mood: MascotMood
}

interface NootClip {
  src: string
  duration: string
  frames: number
  loop: boolean
}

const STILL = '/mascot/noot-still.png?v=7'

const NOOT_CLIPS: Record<MascotMood, NootClip> = {
  idle: { src: '/mascot/noot-idle.png?v=7', duration: '3s', frames: 24, loop: true },
  play: { src: '/mascot/noot-play.png?v=7', duration: '2s', frames: 24, loop: true },
  win: { src: '/mascot/noot-win.png?v=7', duration: '1.3s', frames: 24, loop: false },
  lose: { src: '/mascot/noot-lose.png?v=7', duration: '1.2s', frames: 24, loop: false },
  skip: { src: '/mascot/noot-skip.png?v=7', duration: '1.1s', frames: 24, loop: false },
  streak: { src: '/mascot/noot-streak.png?v=7', duration: '1.5s', frames: 24, loop: false },
  switch: { src: '/mascot/noot-switch.png?v=7', duration: '1.2s', frames: 24, loop: false },
}

export function Mascot({ difficulty, mood }: MascotProps) {
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setReduceMotion(media.matches)
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [])

  const clip = NOOT_CLIPS[mood]
  const src = reduceMotion ? STILL : clip.src
  const frameCount = reduceMotion ? 1 : clip.frames
  const stepCount = reduceMotion || clip.loop ? frameCount : Math.max(frameCount - 1, 1)
  const endFrames = stepCount
  const style = {
    backgroundImage: `url("${src}")`,
    animationDuration: reduceMotion ? '0s' : clip.duration,
    animationIterationCount: reduceMotion || !clip.loop ? '1' : 'infinite',
    animationTimingFunction: `steps(${stepCount})`,
    '--noot-end': String(endFrames),
  } as CSSProperties

  return (
    <div className={`mascot mascot-${mood} mascot-${difficulty}`} aria-hidden="true">
      <div key={mood} className="mascot-sprite" style={style} />
    </div>
  )
}
