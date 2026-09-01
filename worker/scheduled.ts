import { syncSpotifyMetrics } from './spotify-sync'
import type { Env } from './types'

export async function handleScheduled(_event: ScheduledEvent, env: Env): Promise<void> {
  try {
    const result = await syncSpotifyMetrics(env)
    console.log('[scheduled] spotify metrics sync finished', result)
  } catch (error) {
    console.error('[scheduled] spotify metrics sync failed:', error)
  }
}
