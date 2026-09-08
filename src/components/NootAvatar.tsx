import { useEffect, useState } from 'react'
import { parseAppearance, type NootAppearance } from '../../shared/noot-profile'
import type { Difficulty } from '../lib/api'
import '../noot-avatar.css'

export function NootAvatar({ appearance, difficulty = 'easy' }: {
  appearance?: Partial<NootAppearance>; difficulty?: Difficulty
}) {
  const head = parseAppearance(appearance)
  // Clothes and shoes are outside this portrait; don't load or rerender them.
  const signature = JSON.stringify({ headgear: head.headgear, headColor: head.headColor,
    eyewear: head.eyewear, eyeColor: head.eyeColor, accessoryColor: head.accessoryColor,
    clothing: 'none', footwear: 'none', difficulty, pose: 'idle' })
  const [portrait, setPortrait] = useState<{ signature: string; src: string }>()
  useEffect(() => {
    let active = true
    void import('../lib/noot/portrait').then(({ nootPortrait }) => nootPortrait(JSON.parse(signature)))
      .then(src => { if (active) setPortrait({ signature, src }) })
      .catch(() => { /* The adjacent player name remains available if WebGL fails. */ })
    return () => { active = false }
  }, [signature])
  return <span className="noot-avatar" aria-hidden="true">
    {portrait?.signature === signature && <img src={portrait.src} alt="" width={40} height={40} draggable={false}/>}
  </span>
}
