import { useEffect, useRef, useState } from 'react'
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
  const [burning, setBurning] = useState(false)

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
        // The flame rests on a still frame and only burns when the streak
        // grows, so the top bar is quiet the rest of the time.
        animation = lottie.loadAnimation({
          container: hostRef.current,
          renderer: 'svg',
          loop: false,
          autoplay: false,
          animationData,
        })
        animRef.current = animation
        animation.goToAndStop(animation.totalFrames * 0.72, true)
        if (reduceMotion) return
        if (pendingBumpRef.current) {
          pendingBumpRef.current = false
          celebrate(animation, setBurning)
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
    celebrate(animation, setBurning)
  }, [bump])

  const label = count === 1 ? '1 song streak' : `${count} song streak`

  return (
    <div
      className={`streak-badge${count <= 0 ? ' cold' : ''}${bump ? ' bump' : ''}${burning ? ' is-burning' : ''}`}
      title={label}
      aria-label={label}
    >
      <div className="streak-flame" aria-hidden="true">
        <svg className="streak-flame-mark" viewBox="0 0 64 64">
          <path
            className="streak-flame-body"
            d="M33 6C41 14 50 24 50 38 50 50 42 58 32 58 22 58 14 50 14 38 14 31 17 26 21 21 20 27 23 31 27 31 31 31 30 22 29 19 28 16 31 10 33 6Z"
          />
          <path
            className="streak-flame-core"
            d="M32 33C36 38 42 41 42 46.5 42 51.5 37.5 54.5 32 54.5 26.5 54.5 22 51.5 22 46.5 22 41 28 38 32 33Z"
          />
        </svg>
        <div ref={hostRef} className="streak-flame-lottie" />
      </div>
      <span className="streak-count">{count}</span>
    </div>
  )
}

function celebrate(animation: AnimationItem, setBurning: (value: boolean) => void) {
  setBurning(true)
  animation.goToAndPlay(0, true)
  const onComplete = () => {
    animation.removeEventListener('complete', onComplete)
    animation.goToAndStop(animation.totalFrames * 0.72, true)
    setBurning(false)
  }
  animation.addEventListener('complete', onComplete)
}
