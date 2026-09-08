import { spotifyPlaylistId, type PlaylistMix } from '../shared/playlist-mix.ts'
import type { Env } from './types'

export interface PlaylistSource { name: string; ids: string[]; total: number; partial: boolean }
export class PlaylistMixError extends Error {}
const ID = /^[a-zA-Z0-9]{22}$/
export function readPlaylistEmbed(html: string): PlaylistSource {
  const json = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)?.[1]
  if (!json) throw new PlaylistMixError('Spotify could not show this playlist. Check that it is public and try again.')
  let entity
  try { entity = JSON.parse(json)?.props?.pageProps?.state?.data?.entity } catch { /* An unavailable embed has no usable playlist. */ }
  if (!Array.isArray(entity?.trackList)) throw new PlaylistMixError('Spotify could not show this playlist. Check that it is public and try again.')
  const ids: string[] = [...new Set<string>(entity.trackList.map((t: {uri?:string}) => t.uri?.match(/^spotify:track:([a-zA-Z0-9]{22})$/)?.[1]).filter(Boolean))]
  return {name:String(entity.name || entity.title || 'Spotify playlist').slice(0,200), ids, total:ids.length, partial:true}
}

async function readSpotifyPlaylist(env: Env, id: string): Promise<PlaylistSource> {
  // Only live Spotify sources: archived playlists cannot guarantee membership.
  if (env.SPOTIFY_CLIENT_ID && env.SPOTIFY_CLIENT_SECRET) {
    try {
      const signal = AbortSignal.timeout(12_000)
      const auth = await fetch('https://accounts.spotify.com/api/token', {method:'POST', signal,
        headers:{Authorization:`Basic ${btoa(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`)}`, 'Content-Type':'application/x-www-form-urlencoded'},
        body:'grant_type=client_credentials'})
      if (!auth.ok) throw new Error('Spotify unavailable')
      const token = (await auth.json() as {access_token:string}).access_token
      const get = async (path:string) => {
        const r = await fetch(`https://api.spotify.com/v1/${path}`, {signal,headers:{Authorization:`Bearer ${token}`}})
        if (!r.ok) throw new Error('Spotify playlist access unavailable')
        return r.json() as Promise<Record<string, any>>
      }
      const meta = await get(`playlists/${id}?fields=name,public`)
      if (meta.public === false) throw new Error('Public playlist required')
      const ids = new Set<string>(); let total = 0
      for (let offset=0; offset<2000; offset+=50) {
        const page = await get(`playlists/${id}/items?limit=50&offset=${offset}`)
        if (!Array.isArray(page.items) || !Number.isSafeInteger(page.total)) throw new Error('Incomplete playlist')
        total = page.total
        for (const entry of page.items) { const item = entry.item ?? entry.track; if (!entry.is_local && item?.type === 'track' && ID.test(item.id ?? '')) ids.add(item.id) }
        if (!page.next) return {name:String(meta.name || 'Spotify playlist').slice(0,200),ids:[...ids],total,partial:false}
      }
      return {name:String(meta.name || 'Spotify playlist').slice(0,200),ids:[...ids],total:Math.min(total,20000),partial:true}
    } catch { /* A public embed can still expose a useful, explicitly partial mix. */ }
  }
  const response = await fetch(`https://open.spotify.com/embed/playlist/${id}`, {
    signal:AbortSignal.timeout(10_000), headers:{Accept:'text/html'}, redirect:'manual',
  })
  if (!response.ok) throw new PlaylistMixError('Spotify could not show this playlist. Check that it is public and try again.')
  return readPlaylistEmbed(await response.text())
}

export async function importPlaylistMix(env: Env, link: string): Promise<PlaylistMix> {
  const spotifyId = spotifyPlaylistId(link)
  if (!spotifyId) throw new PlaylistMixError('Paste a Spotify playlist link, such as open.spotify.com/playlist/…')
  const source = await readSpotifyPlaylist(env, spotifyId)
  if (!source.ids.length) throw new PlaylistMixError('This playlist has no songs Spotify can share. Try a public playlist with songs.')
  const result = await env.DB.prepare(`SELECT id FROM tracks WHERE id IN (SELECT value FROM json_each(?))
    AND ((preview_url IS NOT NULL AND preview_url != '') OR (hook_preview_url IS NOT NULL AND hook_preview_url != '')) ORDER BY id`)
    .bind(JSON.stringify(source.ids)).all<{id:string}>()
  const ids = (result.results ?? []).map(row => row.id)
  if (!ids.length) throw new PlaylistMixError('None of these songs are playable in SongGuessr yet. Try another playlist.')
  const digest = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([spotifyId,source.name,ids,source.total,source.partial])))
  const id = [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('')
  const mix: PlaylistMix = {id,spotifyId,name:source.name,matched:ids.length,total:Math.max(source.total,ids.length),partial:source.partial}
  await env.DB.prepare('INSERT OR IGNORE INTO playlist_mixes (id, metadata, track_ids, created_at) VALUES (?, ?, ?, ?)')
    .bind(id,JSON.stringify(mix),JSON.stringify(ids),Date.now()).run()
  return mix
}
