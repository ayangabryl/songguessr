export interface PlaylistMix {
  id: string
  spotifyId: string
  name: string
  matched: number
  total: number
  partial: boolean
}
export function spotifyPlaylistId(value: string): string | null {
  const text = value.trim()
  const uri = text.match(/^spotify:playlist:([a-zA-Z0-9]{22})$/)
  if (uri) return uri[1]
  try {
    const url = new URL(text)
    if (url.protocol !== 'https:' || url.hostname !== 'open.spotify.com' || url.username || url.password || url.port) return null
    return url.pathname.match(/^\/(?:intl-[a-z-]+\/)?playlist\/([a-zA-Z0-9]{22})\/?$/)?.[1] ?? null
  } catch { return null }
}
export function parsePlaylistMix(value: unknown): PlaylistMix | null {
  if (!value || typeof value !== 'object') return null
  const p = value as Record<string, unknown>
  if (typeof p.id !== 'string' || !/^[a-f0-9]{64}$/.test(p.id) || typeof p.spotifyId !== 'string' || !/^[a-zA-Z0-9]{22}$/.test(p.spotifyId)) return null
  if (typeof p.name !== 'string' || !p.name.trim() || p.name.length > 200 || typeof p.partial !== 'boolean') return null
  if (!Number.isSafeInteger(p.matched) || !Number.isSafeInteger(p.total) || Number(p.matched) < 1 || Number(p.matched) > Number(p.total) || Number(p.total) > 20_000) return null
  return { id:p.id, spotifyId:p.spotifyId, name:p.name, matched:Number(p.matched), total:Number(p.total), partial:p.partial }
}
