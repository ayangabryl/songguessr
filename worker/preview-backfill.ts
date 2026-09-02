import {
  applyPreviewPatches as applyD1PreviewPatches,
  listTracksMissingPreview,
} from './catalog-d1'
import { applyPreviewPatches as applyR2PreviewPatches } from './catalog-r2'
import { resolvePreviewSourcesForTrack } from './preview-sources'
import type { Env } from './types'

const CONCURRENCY = 3
const MAX_ERROR_MESSAGES = 8

export interface PreviewBackfillProgress {
  processed: number
  total: number
  filled: number
  stillMissing: number
  hookFilled: number
  failed: number
}

export interface PreviewBackfillResult extends PreviewBackfillProgress {
  missingAtStart: number
  d1Updated: number
  r2Updated: number
  errors: string[]
}

export interface PreviewPatch {
  id: string
  previewUrl: string
  hookPreviewUrl?: string
  hookStartSeconds: number
}

function pushError(errors: string[], message: string): void {
  if (errors.length < MAX_ERROR_MESSAGES) {
    errors.push(message)
    return
  }
  if (errors.length === MAX_ERROR_MESSAGES) {
    errors.push('Additional errors omitted')
  }
}

async function mapPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return
  let next = 0
  const run = async (): Promise<void> => {
    while (next < items.length) {
      const index = next
      next += 1
      const item = items[index]
      if (item === undefined) return
      await worker(item)
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => run()),
  )
}

export async function backfillMissingPreviews(
  env: Env,
  onProgress?: (progress: PreviewBackfillProgress) => void,
): Promise<PreviewBackfillResult> {
  const missing = await listTracksMissingPreview(env)
  const total = missing.length
  const empty: PreviewBackfillResult = {
    missingAtStart: total,
    processed: 0,
    total,
    filled: 0,
    stillMissing: total,
    hookFilled: 0,
    failed: 0,
    d1Updated: 0,
    r2Updated: 0,
    errors: [],
  }

  if (total === 0) {
    onProgress?.(empty)
    return empty
  }

  const patches: PreviewPatch[] = []
  const errors: string[] = []
  let processed = 0
  let filled = 0
  let hookFilled = 0
  let failed = 0

  const report = (): void => {
    onProgress?.({
      processed,
      total,
      filled,
      stillMissing: total - filled,
      hookFilled,
      failed,
    })
  }

  report()

  await mapPool(missing, CONCURRENCY, async (track) => {
    try {
      const previews = await resolvePreviewSourcesForTrack({
        title: track.title,
        artist: track.artist,
        spotifyId: track.id,
      })
      if (!previews.previewUrl) {
        processed += 1
        report()
        return
      }
      patches.push({
        id: track.id,
        previewUrl: previews.previewUrl,
        ...(previews.hookPreviewUrl ? { hookPreviewUrl: previews.hookPreviewUrl } : {}),
        hookStartSeconds: previews.hookStartSeconds,
      })
      filled += 1
      if (previews.hookPreviewUrl && !track.hookPreviewUrl) hookFilled += 1
    } catch (error) {
      failed += 1
      pushError(
        errors,
        `${track.title}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
    processed += 1
    report()
  })

  let d1Updated = 0
  try {
    d1Updated = await applyD1PreviewPatches(env, patches)
  } catch (error) {
    pushError(
      errors,
      `D1 preview write failed: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  let r2Updated = 0
  try {
    r2Updated = await applyR2PreviewPatches(env.AUDIO_BUCKET, patches)
  } catch (error) {
    pushError(
      errors,
      `R2 preview write failed: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  return {
    missingAtStart: total,
    processed,
    total,
    filled,
    stillMissing: total - filled,
    hookFilled,
    failed,
    d1Updated,
    r2Updated,
    errors,
  }
}
