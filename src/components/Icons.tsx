import { ArrowClockwise } from '@phosphor-icons/react/ArrowClockwise'
import { ArrowCounterClockwise } from '@phosphor-icons/react/ArrowCounterClockwise'
import { ChatCircle } from '@phosphor-icons/react/ChatCircle'
import { DiceFive } from '@phosphor-icons/react/DiceFive'
import { Faders } from '@phosphor-icons/react/Faders'
import { Heart } from '@phosphor-icons/react/Heart'
import { Repeat } from '@phosphor-icons/react/Repeat'
import { SkipForward } from '@phosphor-icons/react/SkipForward'
import { SpeakerHigh } from '@phosphor-icons/react/SpeakerHigh'
import { Timer } from '@phosphor-icons/react/Timer'
import { Waveform } from '@phosphor-icons/react/Waveform'
import type { Icon, IconProps } from '@phosphor-icons/react/lib'
import { Loader2, Pause, Play } from 'lucide'
import { MorphIcon } from 'morphicons/react'

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

export function SupportIcon() {
  return renderIcon(Heart, { className: 'action-icon' })
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

const PLAY_CONTROL_ICONS = {
  play: Play,
  pause: Pause,
  loading: Loader2,
} as const

export function PlayControlIcon({ state }: { state: 'play' | 'pause' | 'loading' }) {
  const className = [
    'play-glyph',
    state === 'play' ? 'play-icon' : '',
    state === 'pause' ? 'pause-icon' : '',
    state === 'loading' ? 'loading-icon' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <MorphIcon
      icon={PLAY_CONTROL_ICONS[state]}
      className={className}
      size={28}
      strokeWidth={2.5}
      color="currentColor"
      spring="snappy"
      aria-hidden
    />
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
