import type { GameRound } from './api'
import type { StartMode } from './game-state'

const DEFAULT_HOOK_MS = 12_000

/** Seek position in ms on the full Spotify track. */
export function spotifyStartPositionMs(round: GameRound, startMode: StartMode): number {
  if (startMode === 'hook') {
    return round.hookStartMs ?? DEFAULT_HOOK_MS
  }
  return round.startAtMs ?? 0
}
