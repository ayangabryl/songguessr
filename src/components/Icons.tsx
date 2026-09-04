import { ArrowClockwise } from '@phosphor-icons/react/ArrowClockwise'
import { ArrowCounterClockwise } from '@phosphor-icons/react/ArrowCounterClockwise'
import { ChatCircle } from '@phosphor-icons/react/ChatCircle'
import { DiceFive } from '@phosphor-icons/react/DiceFive'
import { Faders } from '@phosphor-icons/react/Faders'
import { GearSix } from '@phosphor-icons/react/GearSix'
import { Moon } from '@phosphor-icons/react/Moon'
import { Repeat } from '@phosphor-icons/react/Repeat'
import { SkipForward } from '@phosphor-icons/react/SkipForward'
import { SpeakerHigh } from '@phosphor-icons/react/SpeakerHigh'
import { Sun } from '@phosphor-icons/react/Sun'
import { Timer } from '@phosphor-icons/react/Timer'
import { UsersThree } from '@phosphor-icons/react/UsersThree'
import { Waveform } from '@phosphor-icons/react/Waveform'
import type { Icon, IconProps } from '@phosphor-icons/react/lib'

type AppIconProps = Pick<IconProps, 'className' | 'size' | 'weight'>

function renderIcon(
  IconComponent: Icon,
  { className, size = 16, weight = 'regular' }: AppIconProps,
) {
  return <IconComponent className={className} size={size} weight={weight} aria-hidden />
}

export function ReplayIcon() {
  return renderIcon(ArrowClockwise, { className: 'action-icon replay-icon' })
}

export function FilterIcon() {
  return renderIcon(Faders, { className: 'action-icon filter-icon' })
}

export function FeedbackIcon() {
  return renderIcon(ChatCircle, { className: 'action-icon' })
}

export function WaveformIcon() {
  return renderIcon(Waveform, { className: 'label-icon waveform-icon', size: 14 })
}

export function StopwatchIcon() {
  return renderIcon(Timer, { className: 'label-icon stopwatch-icon', size: 12 })
}

export function AutoRerollIcon() {
  return renderIcon(Repeat, { className: 'label-icon auto-reroll-icon', size: 13 })
}

export function VolumeIcon() {
  return renderIcon(SpeakerHigh, { className: 'label-icon volume-icon', size: 13 })
}

export function PlayControlIcon({ state }: { state: 'play' | 'pause' | 'loading' }) {
  const className = [
    'play-glyph',
    state === 'play' ? 'play-icon' : '',
    state === 'pause' ? 'pause-icon' : '',
    state === 'loading' ? 'loading-icon' : '',
  ]
    .filter(Boolean)
    .join(' ')

  if (state === 'loading') {
    return (
      <svg className={className} viewBox="0 0 24 24" width="28" height="28" aria-hidden>
        <circle
          cx="12"
          cy="12"
          r="8"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="32 18"
        />
      </svg>
    )
  }

  if (state === 'pause') {
    return (
      <svg className={className} viewBox="0 0 24 24" width="28" height="28" aria-hidden>
        <rect x="6" y="5" width="4.5" height="14" rx="1.2" fill="currentColor" />
        <rect x="13.5" y="5" width="4.5" height="14" rx="1.2" fill="currentColor" />
      </svg>
    )
  }

  return (
    <svg className={className} viewBox="0 0 24 24" width="28" height="28" aria-hidden>
      <path d="M8 5.2v13.6c0 .7.76 1.12 1.35.74l10.2-6.8a.88.88 0 0 0 0-1.48l-10.2-6.8A.88.88 0 0 0 8 5.2Z" fill="currentColor" />
    </svg>
  )
}

export function SkipIcon() {
  return renderIcon(SkipForward, { className: 'skip-icon', size: 14, weight: 'bold' })
}

export function ResetIcon() {
  return renderIcon(ArrowCounterClockwise, {
    className: 'reset-icon',
    size: 12,
    weight: 'bold',
  })
}

export function RetryIcon() {
  return renderIcon(ArrowClockwise, { className: 'action-icon replay-icon' })
}

export function NextSongIcon() {
  return renderIcon(DiceFive, { className: 'action-icon dice-icon' })
}

export function GearIcon() {
  return renderIcon(GearSix, { className: 'action-icon', size: 22, weight: 'bold' })
}

export function SunIcon() {
  return renderIcon(Sun, { className: 'action-icon', size: 22, weight: 'bold' })
}

export function MoonIcon() {
  return renderIcon(Moon, { className: 'action-icon', size: 22, weight: 'bold' })
}

export function SitIcon() {
  return renderIcon(UsersThree, { className: 'action-icon', size: 22, weight: 'bold' })
}
