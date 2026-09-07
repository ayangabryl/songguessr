/** URLs that exist in the catalog but fail in the browser often enough to skip. */
export function isUnreliableAudioUrl(url: string | undefined): boolean {
  if (!url || !url.trim()) return true
  return url.includes('dzcdn.net')
}

export interface AudioCandidate {
  url: string
  offset: number
}

export function audioCandidates(track: {
  introClipUrl?: string
  audioUrl?: string
  previewUrl?: string
  hookPreviewUrl?: string
  hookClipUrl?: string
  startAtMs?: number
}): AudioCandidate[] {
  const seen = new Set<string>()
  const out: AudioCandidate[] = []
  const add = (url: string | undefined, offset: number) => {
    if (isUnreliableAudioUrl(url) || seen.has(url!)) return
    seen.add(url!)
    out.push({ url: url!, offset })
  }
  add(track.introClipUrl, 0)
  add(track.hookClipUrl, 0)
  add(track.audioUrl, (track.startAtMs ?? 0) / 1000)
  add(track.previewUrl, 0)
  add(track.hookPreviewUrl, 0)
  return out
}

export function r2KeyFromAudioUrl(url: string): string | null {
  try {
    const path = url.startsWith('http://') || url.startsWith('https://')
      ? new URL(url).pathname
      : url
    const match = /^\/api\/audio\/(.+)$/.exec(path)
    return match?.[1] ? decodeURIComponent(match[1]) : null
  } catch {
    return null
  }
}
