import type { Difficulty } from '../api'
import type { MascotPose } from '../mascot'

export type NootAction = MascotPose | 'dance' | 'happy-song' | 'sad-song' | 'walk' | 'run' | 'sleepy' | 'listen-close' | 'shrug' | 'cheer'
export type NootHeadgear = 'headphones' | 'cat-earphones' | 'daisy' | 'none'
export type NootMood = 'chill' | 'happy' | 'sad' | 'dance'
export interface NootState {
  pose: NootAction
  difficulty: Difficulty
  variant?: string
  headgear?: NootHeadgear
  mood?: NootMood
  theme?: 'light' | 'dark'
  viewYaw?: number
  comparison?: boolean
  eventId?: number
  speed?: number
  paused?: boolean
  direction?: number
  /** The game's ruler moves the entire canvas; the studio uses world-space travel. */
  onRuler?: boolean
  /** Measured ruler translation, converted to model units per second. */
  travelSpeed?: number
}
export const HEADGEAR: { id: NootHeadgear; label: string; description: string }[] = [
  { id: 'headphones', label: 'Studio', description: 'Soft charcoal headphones' },
  { id: 'cat-earphones', label: 'Kitten', description: 'Peach headphones with little ears' },
  { id: 'daisy', label: 'Daisy', description: 'A little flower, just for Noot' },
  { id: 'none', label: 'Just Noot', description: 'No accessories' },
]
