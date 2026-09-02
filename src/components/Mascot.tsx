import { useEffect, useRef, useState } from 'react'
import lottie, { type AnimationItem } from 'lottie-web/build/player/lottie_light'
import type { Difficulty } from '../lib/api'
import {
  MASCOT_LOOPING,
  MASCOT_PALETTES,
  MASCOT_SEGMENTS,
  tintMascotData,
  type MascotMood,
} from '../lib/mascot'

/**
 * Noot mascot: original SongGuessr character (headphones + note tuft).
 * Self-authored Lottie at /mascot/noot.json. CC0. Not affiliated with Duolingo.
 */
interface MascotProps {
  difficulty: Difficulty
  mood: MascotMood
}

let cachedTemplate: unknown | null = null
let cachedPromise: Promise<unknown> | null = null

function loadTemplate() {
  if (cachedTemplate) return Promise.resolve(cachedTemplate)
  if (!cachedPromise) {
    cachedPromise = fetch('/mascot/noot.json?v=4')
      .then((response) => {
        if (!response.ok) throw new Error('Mascot animation missing.')
        return response.json() as Promise<unknown>
      })
      .then((data) => {
        cachedTemplate = data
        return data
      })
  }
  return cachedPromise
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function playMood(animation: AnimationItem, mood: MascotMood, reduceMotion: boolean) {
  const [start, end] = MASCOT_SEGMENTS[mood]
  animation.removeEventListener('complete')
  if (reduceMotion) {
    animation.goToAndStop(Math.round((start + end) / 2), true)
    return
  }
  const play = () => {
    animation.playSegments([start, end], true)
  }
  if (MASCOT_LOOPING[mood]) {
    animation.addEventListener('complete', play)
  }
  animation.loop = false
  play()
}

export function Mascot({ difficulty, mood }: MascotProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const animRef = useRef<AnimationItem | null>(null)
  const moodRef = useRef(mood)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    moodRef.current = mood
  }, [mood])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let cancelled = false
    let animation: AnimationItem | null = null
    setReady(false)

    void loadTemplate()
      .then((template) => {
        if (cancelled || !hostRef.current) return
        hostRef.current.innerHTML = ''
        const animationData = tintMascotData(template, MASCOT_PALETTES[difficulty])
        const reduceMotion = prefersReducedMotion()
        animation = lottie.loadAnimation({
          container: hostRef.current,
          renderer: 'svg',
          loop: false,
          autoplay: false,
          animationData,
        })
        animRef.current = animation
        playMood(animation, moodRef.current, reduceMotion)
        setReady(true)
      })
      .catch(() => {
        setReady(false)
      })

    return () => {
      cancelled = true
      animation?.destroy()
      animRef.current = null
    }
  }, [difficulty])

  useEffect(() => {
    const animation = animRef.current
    if (!animation) return
    playMood(animation, mood, prefersReducedMotion())
  }, [mood])

  return (
    <div className={`mascot mascot-${mood} mascot-${difficulty}`} aria-hidden="true">
      <NootFallback mood={mood} />
      <div ref={hostRef} className={`mascot-lottie${ready ? ' ready' : ''}`} />
    </div>
  )
}

function NootFallback({ mood }: { mood: MascotMood }) {
  const sad = mood === 'lose' || mood === 'skip'
  const grin = mood === 'win' || mood === 'streak'

  return (
    <svg className="mascot-fallback" viewBox="0 0 240 240" width="180" height="180">
      <ellipse className="mascot-shadow" cx="120" cy="214" rx="48" ry="11" />
      <g className={`mascot-body-group mascot-mood-${mood}`}>
        <ellipse className="mascot-outline" cx="94" cy="196" rx="14" ry="8" />
        <ellipse className="mascot-outline" cx="146" cy="196" rx="14" ry="8" />
        <ellipse className="mascot-outline" cx="58" cy="148" rx="17" ry="11" />
        <ellipse className="mascot-fill" cx="58" cy="148" rx="14" ry="9" />
        <ellipse className="mascot-outline" cx="182" cy="148" rx="17" ry="11" />
        <ellipse className="mascot-fill" cx="182" cy="148" rx="14" ry="9" />
        <ellipse className="mascot-outline" cx="120" cy="132" rx="64" ry="73" />
        <ellipse className="mascot-fill" cx="120" cy="132" rx="58" ry="67" />
        <ellipse className="mascot-belly" cx="120" cy="156" rx="29" ry="20" />
        <ellipse cx="142" cy="128" rx="11" ry="24" fill="rgba(20,16,12,0.1)" />
        <path
          className="mascot-ink"
          d="M68 92c24-28 80-28 104 0"
          fill="none"
          strokeWidth="11"
          strokeLinecap="round"
        />
        <ellipse className="mascot-ink" cx="50" cy="116" rx="17" ry="19" />
        <ellipse className="mascot-cup" cx="50" cy="116" rx="13" ry="15" />
        <ellipse className="mascot-cup-pad" cx="50" cy="116" rx="8" ry="9" />
        <ellipse className="mascot-ink" cx="190" cy="116" rx="17" ry="19" />
        <ellipse className="mascot-cup" cx="190" cy="116" rx="13" ry="15" />
        <ellipse className="mascot-cup-pad" cx="190" cy="116" rx="8" ry="9" />
        <ellipse className="mascot-ink" cx="160" cy="70" rx="10" ry="7.5" transform="rotate(-24 160 70)" />
        <rect className="mascot-ink" x="167" y="18" width="10" height="54" rx="5" transform="rotate(18 172 44)" />
        <path className="mascot-ink" d="M176 18c18-8 34-2 38 14-14-4-24 0-36 8z" />
        <rect className="mascot-ink" x="86" y="96" width="20" height="5" rx="3" transform="rotate(-14 96 98)" />
        <rect className="mascot-ink" x="134" y="96" width="20" height="5" rx="3" transform="rotate(14 144 98)" />
        <ellipse className="mascot-cheek" cx="80" cy="144" rx="10" ry="6" />
        <ellipse className="mascot-cheek" cx="160" cy="144" rx="10" ry="6" />
        <ellipse cx="98" cy="118" rx="18" ry="20" fill="#fff" />
        <ellipse cx="142" cy="118" rx="18" ry="20" fill="#fff" />
        <ellipse className="mascot-ink" cx="99" cy="121" rx="9" ry="10" />
        <ellipse className="mascot-ink" cx="143" cy="121" rx="9" ry="10" />
        <ellipse cx="96" cy="115" rx="4" ry="4.5" fill="#fff" />
        <ellipse cx="140" cy="115" rx="4" ry="4.5" fill="#fff" />
        {sad ? (
          <path
            className="mascot-ink"
            d="M106 160c8-8 20-8 28 0"
            fill="none"
            strokeWidth="5"
            strokeLinecap="round"
          />
        ) : grin ? (
          <ellipse className="mascot-ink" cx="120" cy="156" rx="14" ry="9" />
        ) : (
          <path
            className="mascot-ink"
            d="M104 150c8 12 24 12 32 0"
            fill="none"
            strokeWidth="5"
            strokeLinecap="round"
          />
        )}
      </g>
    </svg>
  )
}
