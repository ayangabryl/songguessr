import { useEffect, useState } from 'react'
import type { Difficulty } from '../lib/api'
import type { MascotMood } from '../lib/mascot'

/**
 * Noot mascot: original SMIL SVG flipbooks from the video-kit sequences.
 * Not affiliated with Duolingo.
 */
interface MascotProps {
  difficulty: Difficulty
  mood: MascotMood
}

const STILL = '/mascot/noot-still.png?v=8'

const NOOT_CLIPS: Record<MascotMood, string> = {
  idle: '/mascot/noot-idle.svg?v=8',
  play: '/mascot/noot-play.svg?v=8',
  win: '/mascot/noot-win.svg?v=8',
  lose: '/mascot/noot-lose.svg?v=8',
  skip: '/mascot/noot-skip.svg?v=8',
  streak: '/mascot/noot-streak.svg?v=8',
  switch: '/mascot/noot-switch.svg?v=8',
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

  return (
    <div className={`mascot mascot-${mood} mascot-${difficulty}`} aria-hidden="true">
      {reduceMotion ? (
        <img className="mascot-svg" src={STILL} alt="" />
      ) : (
        <object
          key={mood}
          className="mascot-svg"
          type="image/svg+xml"
          data={NOOT_CLIPS[mood]}
        />
      )}
    </div>
  )
}
