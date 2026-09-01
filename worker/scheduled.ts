import { runCatalogBuild } from './catalog-builder'
import type { Env } from './types'

export async function handleScheduled(_event: ScheduledEvent, env: Env): Promise<void> {
  try {
    const result = await runCatalogBuild(env)
    console.log('[scheduled] catalog build finished', result)
  } catch (error) {
    console.error('[scheduled] catalog build failed:', error)
  }
}
