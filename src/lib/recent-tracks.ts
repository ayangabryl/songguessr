import { removeMigratedItem } from './storage'

const RECENT_TRACKS_KEY = 'songguessr-recent-tracks-v2'
const LEGACY_RECENT_TRACKS_KEYS = ['songgussr-recent-tracks-v2', 'songless-recent-track-ids']
const MAX_RECENT_TRACKS = 20

interface RecentTrack {
  trackId: string
  songKey: string
}

export interface RecentExcludes {
  trackIds: string[]
  songKeys: string[]
}

function parseStoredRecentTracks(raw: string | null): RecentTrack[] {
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []

    if (parsed.length > 0 && typeof parsed[0] === 'object' && parsed[0] !== null) {
      return parsed
        .map((entry) => {
          const record = entry as { trackId?: unknown; songKey?: unknown }
          const trackId = typeof record.trackId === 'string' ? record.trackId.trim() : ''
          const songKey = typeof record.songKey === 'string' ? record.songKey.trim() : ''
          if (!trackId) return null
          return { trackId, songKey }
        })
        .filter((entry): entry is RecentTrack => entry !== null)
    }

    return parsed
      .filter((id): id is string => typeof id === 'string' && id.length > 0)
      .map((trackId) => ({ trackId, songKey: '' }))
  } catch {
    return []
  }
}

function dropDurableRecentTracks() {
  removeMigratedItem(localStorage, RECENT_TRACKS_KEY, LEGACY_RECENT_TRACKS_KEYS)
}

function readStoredRecentTracks(): RecentTrack[] {
  dropDurableRecentTracks()
  return parseStoredRecentTracks(sessionStorage.getItem(RECENT_TRACKS_KEY))
}

function writeStoredRecentTracks(entries: RecentTrack[]) {
  dropDurableRecentTracks()
  sessionStorage.setItem(RECENT_TRACKS_KEY, JSON.stringify(entries))
}

export function loadRecentExcludes(): RecentExcludes {
  const entries = readStoredRecentTracks()
  const trackIds: string[] = []
  const songKeys: string[] = []

  for (const entry of entries) {
    trackIds.push(entry.trackId)
    if (entry.songKey) songKeys.push(entry.songKey)
  }

  return { trackIds, songKeys }
}

export function loadRecentTrackIds(): string[] {
  return loadRecentExcludes().trackIds
}

export function rememberTrack(trackId: string, songKey: string): RecentExcludes {
  const withoutCurrent = readStoredRecentTracks().filter((entry) => entry.trackId !== trackId)
  const next = [{ trackId, songKey }, ...withoutCurrent].slice(0, MAX_RECENT_TRACKS)
  writeStoredRecentTracks(next)

  return {
    trackIds: next.map((entry) => entry.trackId),
    songKeys: next.map((entry) => entry.songKey).filter((key) => key.length > 0),
  }
}

export function rememberTrackId(trackId: string, songKey = ''): string[] {
  return rememberTrack(trackId, songKey).trackIds
}

export function clearRecentTrackIds() {
  dropDurableRecentTracks()
  sessionStorage.removeItem(RECENT_TRACKS_KEY)
}
