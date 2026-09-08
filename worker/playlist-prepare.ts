import { spotifyPlaylistId, type PlaylistMix } from '../shared/playlist-mix.ts'
import type { PlaylistProgress, PlaylistIssue } from '../shared/playlist-import'
import { songIdentityKey } from './track-dedupe.ts'
import { readSpotifyPlaylist, PlaylistMixError, type PlaylistSource } from './playlist-mix.ts'
import { playlistAudioPlays, resolvePlaylistAudio } from './playlist-audio.ts'
import type { Env } from './types'

interface Progress { ids:string[]; added:number; issues:PlaylistIssue[]; playlist?:PlaylistMix }
interface Job { id:string; spotify_id:string; source:string; progress:string; cursor:number; expires_at:number }
const JOB_ID=/^[a-f0-9]{64}$/
function view(job:Job):PlaylistProgress {
  const source:PlaylistSource=JSON.parse(job.source), progress:Progress=JSON.parse(job.progress)
  return {jobId:job.id,processed:job.cursor,total:source.ids.length,playable:progress.ids.length,added:progress.added,
    unavailable:progress.issues.length,complete:job.cursor===source.ids.length,playlist:progress.playlist,issues:progress.issues}
}
async function readJob(env:Env,id:string):Promise<Job> {
  if(!JOB_ID.test(id))throw new PlaylistMixError('Invalid playlist import.')
  const job=await env.DB.prepare('SELECT * FROM playlist_import_jobs WHERE id=? AND expires_at>?').bind(id,Date.now()).first<Job>()
  if(!job)throw new PlaylistMixError('This import has expired. Add the playlist again.')
  return job
}
export async function beginPlaylistImport(env:Env,link:string):Promise<PlaylistProgress> {
  const spotifyId=spotifyPlaylistId(link)
  if(!spotifyId)throw new PlaylistMixError('Paste a public Spotify playlist link.')
  const source=await readSpotifyPlaylist(env,spotifyId)
  if(!source.ids.length)throw new PlaylistMixError('Spotify shared no songs from this playlist. Check that it is public.')
  const id=crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','')
  const progress=JSON.stringify({ids:[],added:0,issues:[]})
  const job:Job={id,spotify_id:spotifyId,source:JSON.stringify(source),progress,cursor:0,expires_at:Date.now()+7*86400_000}
  await env.DB.prepare('DELETE FROM playlist_import_jobs WHERE expires_at<?').bind(Date.now()).run()
  await env.DB.prepare('INSERT INTO playlist_import_jobs (id,spotify_id,source,progress,cursor,expires_at) VALUES (?,?,?,?,?,?)').bind(job.id,job.spotify_id,job.source,job.progress,job.cursor,job.expires_at).run()
  return view(job)
}
export async function getPlaylistImport(env:Env,id:string) {return view(await readJob(env,id))}
export async function preparePlaylistBatch(env:Env,id:string):Promise<PlaylistProgress> {
  const job=await readJob(env,id), source:PlaylistSource=JSON.parse(job.source), progress:Progress=JSON.parse(job.progress)
  if(job.cursor===source.ids.length)return view(job)
  const batch=source.ids.slice(job.cursor,job.cursor+4)
  const existing=await env.DB.prepare('SELECT id,preview_url,hook_preview_url FROM tracks WHERE id IN (SELECT value FROM json_each(?))').bind(JSON.stringify(batch)).all<{id:string;preview_url:string;hook_preview_url:string}>()
  const work=async(trackId:string)=>{
    const track=source.tracks?.find(t=>t.id===trackId) ?? {id:trackId,title:'',artist:''}
    const row=existing.results.find(r=>r.id===trackId)
    for(const url of [row?.preview_url,row?.hook_preview_url].filter(Boolean) as string[])if(await playlistAudioPlays(env,url)){progress.ids.push(trackId);return}
    if(!track.title || !track.artist){progress.issues.push({...track,reason:'Spotify did not share track details.'});return}
    const preview=await resolvePlaylistAudio(env,track)
    if(!preview){progress.issues.push({...track,reason:'No playable preview is available.'});return}
    // Keep exact Spotify membership. Never replace/delete another catalog recording.
    const result=row
      ? await env.DB.prepare('UPDATE tracks SET preview_url=? WHERE id=?').bind(preview,trackId).run()
      : await env.DB.prepare(`INSERT INTO tracks (id,title,artist,preview_url,hook_start_seconds,album_art,difficulty,genre_groups,song_key,updated_at,country,catalog)
      SELECT ?,?,?,?,12,?,'hard','["other"]',?,?,'GLOBAL',''
      WHERE (SELECT COUNT(*) FROM tracks)<20000
      ON CONFLICT(id) DO UPDATE SET preview_url=excluded.preview_url`)
      .bind(trackId,track.title,track.artist,preview,track.albumArt??'',songIdentityKey(track),new Date().toISOString()).run()
    if(!result.meta.changes){progress.issues.push({...track,reason:'The song library is full. Please try later.'});return}
    if(!row)progress.added++
    progress.ids.push(trackId)
  }
  // Four tracks per request bound provider calls; two concurrent audio checks.
  for(let i=0;i<batch.length;i+=2)await Promise.all(batch.slice(i,i+2).map(work))
  progress.ids.sort()
  const cursor=job.cursor+batch.length
  if(cursor===source.ids.length && progress.ids.length){
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([job.spotify_id,source.name,source.total,source.partial,progress.ids])))
    const snapshot=[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('')
    progress.playlist={id:snapshot,spotifyId:job.spotify_id,name:source.name,matched:progress.ids.length,total:Math.max(source.total,source.ids.length),partial:source.partial,added:progress.added,unavailable:progress.issues.length,reportId:job.id}
    await env.DB.prepare('INSERT OR IGNORE INTO playlist_mixes (id,metadata,track_ids,created_at) VALUES (?,?,?,?)').bind(snapshot,JSON.stringify(progress.playlist),JSON.stringify(progress.ids),Date.now()).run()
  }
  await env.DB.prepare('UPDATE playlist_import_jobs SET cursor=?,progress=? WHERE id=? AND cursor=?').bind(cursor,JSON.stringify(progress),job.id,job.cursor).run()
  return getPlaylistImport(env,id)
}
