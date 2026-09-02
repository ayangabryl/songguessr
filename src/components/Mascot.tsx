import { useEffect, useState } from 'react'
import type { Difficulty } from '../lib/api'
import type { MascotMood } from '../lib/mascot'

/**
 * Noot mascot: painted idle loop from the vector flipbook SVG
 * (public/mascot/noot.svg). Background keyed out. Not affiliated with Duolingo.
 */
interface MascotProps {
  difficulty: Difficulty
  mood: MascotMood
}

const NOOT_LOOP = '/mascot/noot.svg?v=5'
const NOOT_STILL = '/mascot/noot-still.svg?v=5'

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
      <img
        className="mascot-art"
        src={reduceMotion ? NOOT_STILL : NOOT_LOOP}
        alt=""
        width={640}
        height={640}
        decoding="async"
      />
    </div>
  )
}
