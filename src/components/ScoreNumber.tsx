import { useEffect, useRef, useState } from 'react'

/** The server value is authoritative; only its visual presentation counts up. */
export function ScoreNumber({ value, prefix = '' }: { value: number; prefix?: string }) {
  const [shown, setShown] = useState(value), current = useRef(value)
  useEffect(() => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0
    const start = performance.now(), from = current.current
    const settle = () => { cancelAnimationFrame(frame); current.current = value; setShown(value) }
    function tick(time: number) {
      const t = Math.min(1, (time - start) / 650)
      current.current = Math.round(from + (value - from) * (1 - (1 - t) ** 3))
      setShown(current.current)
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    if (reduced.matches) settle(); else frame = requestAnimationFrame(tick)
    reduced.addEventListener('change', settle)
    return () => { cancelAnimationFrame(frame); reduced.removeEventListener('change', settle) }
  }, [value])
  return <span className="score-number" aria-label={`${prefix}${value.toLocaleString()} points`}><span aria-hidden="true">{prefix}{shown.toLocaleString()}</span></span>
}
