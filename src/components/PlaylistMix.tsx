import { useEffect, useId, useRef, useState } from 'react'
import { ListMusic, X, ArrowUpRight } from 'lucide-react'
import { parsePlaylistMix, spotifyPlaylistId, type PlaylistMix as Selection } from '../../shared/playlist-mix'
import type { PlaylistProgress, PlaylistIssue } from '../../shared/playlist-import'
import '../playlist-mix.css'

export function PlaylistMix({value,onChange,onPending}:{value?:Selection;onChange:(value?:Selection)=>void;onPending:(pending:boolean)=>void}) {
  const id=useId(),request=useRef<AbortController|null>(null)
  const [link,setLink]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const [progress,setProgress]=useState<PlaylistProgress|null>(null)
  const [issues,setIssues]=useState<PlaylistIssue[]|null>(null)
  useEffect(()=>()=>request.current?.abort(),[])
  useEffect(()=>{onPending(busy||Boolean(link.trim()))},[busy,link,onPending])
  async function add() {
    if(!spotifyPlaylistId(link)){setError('Paste a Spotify playlist link, not a song or album.');return}
    request.current?.abort()
    const controller=new AbortController();request.current=controller
    setBusy(true);setError('');setIssues(null)
    const send=async(path:string,body?:unknown)=>{
      const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(65_000)])})
      const data=await response.json() as PlaylistProgress & {message?:string}
      if(!response.ok)throw new Error(data.message||'Could not prepare these songs. Please retry.')
      return data
    }
    try {
      let next=progress&&!progress.complete?progress:await send('/api/mix/playlist',{url:link,prepare:true})
      setProgress(next)
      while(!next.complete){
        controller.signal.throwIfAborted()
        next=await send(`/api/mix/playlist/prepare/${next.jobId}`)
        if(!controller.signal.aborted)setProgress(next)
      }
      const playlist=parsePlaylistMix(next.playlist)
      if(!playlist){setIssues(next.issues);throw new Error('No playable previews were found. See the unavailable songs below or try another playlist.')}
      if(!controller.signal.aborted){onChange(playlist);setLink('')}
    }catch(error){if(!controller.signal.aborted)setError(error instanceof Error&&error.name!=='TimeoutError'?error.message:'This batch took too long. Retry to continue where you left off.')}
    finally{if(!controller.signal.aborted)setBusy(false)}
  }
  function cancel(){request.current?.abort();setBusy(false);setLink('');setError('');setProgress(null);setIssues(null)}
  async function showIssues(){
    if(!value?.reportId)return
    try {
      const response=await fetch(`/api/mix/playlist/prepare/${value.reportId}`,{signal:AbortSignal.timeout(10_000)})
      const data=await response.json() as PlaylistProgress & {message?:string}
      if(!response.ok)throw new Error(data.message)
      setIssues(data.issues)
    }catch{setError('This report is unavailable. Refresh the playlist to check its songs again.')}
  }
  return <section className="playlist-mix" aria-labelledby={id}>
    <h3 id={id}>Your playlist</h3>
    <p className="playlist-help">Paste a public Spotify playlist. We’ll add missing songs and check their audio.</p>
    {value&&<div className="playlist-selection">
      <ListMusic size={23} aria-hidden="true"/>
      <div><a href={`https://open.spotify.com/playlist/${value.spotifyId}`} target="_blank" rel="noreferrer">{value.name}<ArrowUpRight size={13} aria-hidden="true"/></a>
        <span>{value.matched} playable {value.matched===1?'song':'songs'} · playlist only</span></div>
      <button type="button" className="playlist-remove" aria-label={`Remove ${value.name}`} onClick={()=>{cancel();onChange(undefined)}}><X size={17}/></button>
    </div>}
    {value?.added ? <p className="playlist-note">{value.added} {value.added===1?'song added':'songs added'} to the library.</p>:null}
    {value?.partial&&<p className="playlist-note">Spotify shared a limited playlist preview. Songs it hasn’t shared cannot be imported.</p>}
    {value?.unavailable ? <button type="button" className="playlist-cancel" onClick={()=>void showIssues()}>View {value.unavailable} unavailable {value.unavailable===1?'song':'songs'}</button>:null}
    {value&&!link&&<button type="button" className="playlist-refresh" onClick={()=>{cancel();setLink(`https://open.spotify.com/playlist/${value.spotifyId}`)}}>Refresh playlist</button>}
    {!value||link?<div className="playlist-input-row">
      <input aria-label="Spotify playlist link" type="url" value={link} disabled={busy} placeholder="https://open.spotify.com/playlist/…" autoComplete="off" spellCheck={false}
        aria-invalid={Boolean(error)} aria-describedby={error?`${id}-error`:undefined}
        onChange={e=>{setLink(e.target.value);setProgress(null);setError('')}} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();if(!busy)void add()}}}/>
      <button type="button" disabled={busy||!link.trim()} onClick={()=>void add()}>{busy?'Adding…':progress&&!progress.complete?'Retry':'Add'}</button>
    </div>:null}
    {busy&&<div className="playlist-import-progress" role="status">
      <p className="playlist-note">{progress?`Checked ${progress.processed} of ${progress.total} songs · ${progress.playable} ready`:'Reading your playlist…'}</p>
      {progress&&<progress aria-label="Checking playlist audio" value={progress.processed} max={progress.total}/>}
    </div>}
    {error&&<p className="playlist-error" id={`${id}-error`} role="alert">{error}</p>}
    {issues&&issues.length>0&&<ul className="playlist-issues" aria-label="Unavailable playlist songs" tabIndex={0}>{issues.map(song=><li key={song.id}><strong>{song.title||'Unavailable track'}</strong><span>{song.artist}</span><small>{song.reason}</small></li>)}</ul>}
    {link&&<button className="playlist-cancel" type="button" onClick={cancel}>Cancel</button>}
  </section>
}
