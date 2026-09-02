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
  const pendingBumpRef = useRef(false)

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
          return
        }
        if (pendingBumpRef.current) {
          pendingBumpRef.current = false
          celebrate(animation)
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
    if (!animation) {
      pendingBumpRef.current = true
      return
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    celebrate(animation)
  }, [bump])

  const label = count === 1 ? '1 song streak' : `${count} song streak`

  return (
    <div
      className={`streak-badge${count <= 0 ? ' cold' : ''}${bump ? ' bump' : ''}`}
      title={label}
      aria-label={label}
    >
      <div className="streak-flame" aria-hidden="true">
        <svg className="streak-flame-mark" viewBox="0 0 64 64">
          <path
            fill="currentColor"
            d="M32 4c4 10-6 14-2 24 8-8 18-2 18 12 0 14-12 22-22 22S8 50 8 36c0-10 6-16 10-20-2 8 6 10 8 4 2-8-2-16 6-16Z"
          />
          <path fill="#ffe08a" d="M32 28c2 6-4 8-1 14 4-4 10 0 10 8 0 8-6 12-11 12s-11-5-11-12c0-6 3-9 5-11 0 5 4 6 5 2 1-4 0-8 3-13Z" />
        </svg>
        <div ref={hostRef} className="streak-flame-lottie" />
      </div>
      <div className="streak-copy">
        <span className="streak-count">{count}</span>
        <span className="streak-label">streak</span>
      </div>
    </div>
  )
}

function celebrate(animation: AnimationItem) {
  animation.loop = false
  animation.goToAndPlay(0, true)
  const onComplete = () => {
    animation.removeEventListener('complete', onComplete)
    animation.loop = true
    animation.play()
  }
  animation.addEventListener('complete', onComplete)
}
