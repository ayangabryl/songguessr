import { useEffect, useRef } from 'react'
import lottie, { type AnimationItem } from 'lottie-web/build/player/lottie_light'

/**
 * Flame - Streak by Noah Wise, LottieFiles animation 1027695.
 * Public animation under the Lottie Simple License (free commercial use;
 * attribution encouraged): https://lottiefiles.com/free-animation/flame-streak-Y3x3T9TqFh
 * Hosted locally at /streak-flame.json so runtime does not depend on a CDN.
 */
interface StreakBadgeProps {
  count: number
  bump: boolean
}

export function StreakBadge({ count, bump }: StreakBadgeProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const animRef = useRef<AnimationItem | null>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let cancelled = false
    let animation: AnimationItem | null = null

    void fetch('/streak-flame.json')
      .then((response) => {
        if (!response.ok) throw new Error('Streak animation missing.')
        return response.json() as Promise<unknown>
      })
      .then((animationData) => {
        if (cancelled || !hostRef.current) return
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        animation = lottie.loadAnimation({
          container: hostRef.current,
          renderer: 'svg',
          loop: !reduceMotion,
          autoplay: !reduceMotion,
          animationData,
        })
        animRef.current = animation
        if (reduceMotion) {
          animation.goToAndStop(animation.totalFrames * 0.72, true)
        }
      })
      .catch(() => {
        // Number still renders; flame is decorative.
      })

    return () => {
      cancelled = true
      animation?.destroy()
      animRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!bump) return
    const animation = animRef.current
    if (!animation) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    animation.goToAndPlay(0, true)
  }, [bump])

  const label = count === 1 ? '1 song streak' : `${count} song streak`

  return (
    <div
      className={`streak-badge${count <= 0 ? ' cold' : ''}${bump ? ' bump' : ''}`}
      title={label}
      aria-label={label}
    >
      <div ref={hostRef} className="streak-flame" aria-hidden="true" />
      <span className="streak-count">{count}</span>
    </div>
  )
}
