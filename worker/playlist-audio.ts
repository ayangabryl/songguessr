import { foldSearchText } from '../shared/search-text.ts'
import { r2KeyFromAudioUrl } from '../shared/playable-audio.ts'
import type { Env } from './types'
import type { PlaylistSourceTrack } from './playlist-mix'

export function allowedPlaylistPreview(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    const u = new URL(value)
    return u.protocol==='https:' && !u.username && !u.password && !u.port &&
      (u.hostname==='p.scdn.co' && u.pathname.startsWith('/mp3-preview/') || u.hostname.endsWith('.itunes.apple.com') || u.hostname.endsWith('.mzstatic.com'))
  } catch { return false }
}
export async function playlistAudioPlays(env:Env,url:string,signal?:AbortSignal):Promise<boolean> {
  const key=r2KeyFromAudioUrl(url)
  if(key){try {const file=await env.AUDIO_BUCKET.head(key);return Boolean(file && file.size>800)}catch{return false}}
  if(!allowedPlaylistPreview(url))return false
  try {
    const response=await fetch(url,{headers:{Range:'bytes=0-2047'},signal:signal?AbortSignal.any([signal,AbortSignal.timeout(4000)]):AbortSignal.timeout(4000),redirect:'manual'})
    try {
      if(!response.ok || !/audio\/|application\/octet-stream/i.test(response.headers.get('Content-Type')??''))return false
      const reader=response.body?.getReader()
      if(!reader)return false
      let bytes=0
      try {
        while(bytes<=512){const chunk=await reader.read();if(chunk.done)break;bytes+=chunk.value.byteLength}
        return bytes>512
      } finally {reader.releaseLock()}
    } finally {await response.body?.cancel()}
  } catch {return false}
}
export function samePreviewRecording(track:PlaylistSourceTrack,result:{trackName?:string;artistName?:string}) {
  // Never use the first search hit, a cover, or a partial-title match.
  return Boolean(track.title && track.artist && foldSearchText(track.title)===foldSearchText(result.trackName??'') &&
    foldSearchText(track.artist)===foldSearchText(result.artistName??''))
}
export async function resolvePlaylistAudio(env:Env,track:PlaylistSourceTrack):Promise<string|null> {
  const signal=AbortSignal.timeout(20_000)
  if(allowedPlaylistPreview(track.previewUrl) && await playlistAudioPlays(env,track.previewUrl,signal))return track.previewUrl
  try {
    const response=await fetch(`https://open.spotify.com/embed/track/${track.id}`,{signal:AbortSignal.any([signal,AbortSignal.timeout(4500)]),redirect:'manual'})
    if(response.ok){
      const html=await response.text()
      const json=html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)?.[1]
      const entity=json?JSON.parse(json)?.props?.pageProps?.state?.data?.entity:null
      if(entity?.uri===`spotify:track:${track.id}` || entity?.id===track.id){
        const url=entity.audioPreview?.url
        if(allowedPlaylistPreview(url) && await playlistAudioPlays(env,url,signal))return url
      }
    }
  } catch { /* Try the exact recording in the other public preview source. */ }
  if(!track.title || !track.artist)return null
  for(const country of ['US','PH']) {
    if(signal.aborted)return null
    try {
      const params=new URLSearchParams({term:`${track.title} ${track.artist}`,entity:'song',country,limit:'5'})
      const response=await fetch(`https://itunes.apple.com/search?${params}`,{signal:AbortSignal.any([signal,AbortSignal.timeout(3500)]),redirect:'manual'})
      if(!response.ok)continue
      const data=await response.json() as {results?:{trackName?:string;artistName?:string;previewUrl?:string}[]}
      for(const row of data.results??[])if(samePreviewRecording(track,row) && allowedPlaylistPreview(row.previewUrl) && await playlistAudioPlays(env,row.previewUrl,signal))return row.previewUrl
    }catch{ /* Report unavailable rather than substitute another song. */ }
  }
  return null
}
