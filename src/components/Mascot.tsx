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
    cachedPromise = fetch('/mascot/noot.json')
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
        <path
          className="mascot-ink"
          d="M68 92c24-28 80-28 104 0"
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <ellipse className="mascot-outline" cx="58" cy="118" rx="19" ry="21" />
        <ellipse className="mascot-cup" cx="58" cy="118" rx="16" ry="18" />
        <ellipse className="mascot-outline" cx="182" cy="118" rx="19" ry="21" />
        <ellipse className="mascot-cup" cx="182" cy="118" rx="16" ry="18" />
        <rect className="mascot-ink" x="150" y="32" width="12" height="56" rx="6" transform="rotate(12 156 60)" />
        <path className="mascot-ink" d="M160 34c18-8 36-4 40 14-14-4-26 0-38 8z" />
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
