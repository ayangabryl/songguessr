import { audioCandidates, r2KeyFromAudioUrl } from '../shared/playable-audio.ts'
import { pickRandomTrack } from './catalog'
import type { CatalogFilters } from './filters'
import type { Difficulty, Env, Track } from './types'

const PROBE_MS = 1800
const PICK_ATTEMPTS = 6

export interface LiveAudio {
  url: string
  offset: number
}

async function urlResponds(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Range: 'bytes=0-64' },
      signal: AbortSignal.timeout(PROBE_MS),
    })
    return response.ok || response.status === 206
  } catch {
    return false
  }
}

export async function probeAudioUrl(env: Env, url: string): Promise<boolean> {
  const key = r2KeyFromAudioUrl(url)
  if (key) {
    try {
      const object = await env.AUDIO_BUCKET.head(key)
      return Boolean(object && object.size > 800)
    } catch {
      return false
    }
  }
  return urlResponds(url)
}

export async function firstLiveAudio(env: Env, track: Track): Promise<LiveAudio | null> {
  for (const candidate of audioCandidates(track)) {
    if (await probeAudioUrl(env, candidate.url)) return candidate
  }
  return null
}

export async function pickPlayableTrack(
  env: Env,
  difficulty: Difficulty,
  filters: CatalogFilters,
  excludeIds: ReadonlySet<string> = new Set(),
  excludeSongKeys: ReadonlySet<string> = new Set(),
): Promise<{ track: Track; audio: LiveAudio } | null> {
  const skipped = new Set(excludeIds)
  for (let attempt = 0; attempt < PICK_ATTEMPTS; attempt += 1) {
    const track = await pickRandomTrack(env, difficulty, '', filters, skipped, excludeSongKeys)
    if (!track) return null
    skipped.add(track.id)
    const audio = await firstLiveAudio(env, track)
    if (audio) {
      return {
        track: {
          ...track,
          previewUrl: audio.url,
          introClipUrl: track.introClipUrl === audio.url ? track.introClipUrl : undefined,
          audioUrl: track.audioUrl === audio.url ? track.audioUrl : undefined,
          hookClipUrl: track.hookClipUrl === audio.url ? track.hookClipUrl : undefined,
          startAtMs: Math.round(audio.offset * 1000),
        },
        audio,
      }
    }
  }
  return null
}
