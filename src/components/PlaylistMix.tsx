import { useEffect, useId, useRef, useState } from 'react'
import { ListMusic, X, ArrowUpRight } from 'lucide-react'
import { parsePlaylistMix, spotifyPlaylistId, type PlaylistMix as Selection } from '../../shared/playlist-mix'
import '../playlist-mix.css'

export function PlaylistMix({value,onChange,onPending}:{value?:Selection;onChange:(value?:Selection)=>void;onPending:(pending:boolean)=>void}) {
  const id = useId(), request = useRef<AbortController | null>(null)
  const [link,setLink] = useState(''), [busy,setBusy] = useState(false), [error,setError] = useState('')
  useEffect(() => () => request.current?.abort(), [])
  useEffect(() => { onPending(busy || Boolean(link.trim())) }, [busy,link,onPending])
  async function add() {
    if (!spotifyPlaylistId(link)) {setError('Paste a Spotify playlist link, not a song or album.');return}
    request.current?.abort()
    const controller = new AbortController(); request.current = controller
    setBusy(true);setError('')
    try {
      const response = await fetch('/api/mix/playlist',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:link}),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(28_000)])})
      const data = await response.json() as {playlist?:unknown;message?:string}
      if (!response.ok) throw new Error(data.message || 'Could not load this playlist. Try again.')
      const playlist = parsePlaylistMix(data.playlist)
      if (!playlist) throw new Error('Could not load this playlist. Try again.')
      if (!controller.signal.aborted) {onChange(playlist);setLink('')}
    } catch(error) {
      if (!controller.signal.aborted) setError(error instanceof Error && error.name !== 'TimeoutError' ? error.message : 'Spotify took too long. Please try again.')
    } finally {if (!controller.signal.aborted) setBusy(false)}
  }
  function cancel() {request.current?.abort();setBusy(false);setLink('');setError('')}
  return <section className="playlist-mix" aria-labelledby={id}>
    <h3 id={id}>Your playlist</h3>
    <p className="playlist-help">Paste a public Spotify playlist. Play only its available songs.</p>
    {value && <div className="playlist-selection">
      <ListMusic size={23} aria-hidden="true"/>
      <div><a href={`https://open.spotify.com/playlist/${value.spotifyId}`} target="_blank" rel="noreferrer">{value.name}<ArrowUpRight size={13} aria-hidden="true"/></a>
        <span>{value.matched} playable {value.matched === 1 ? 'song' : 'songs'} · playlist only</span></div>
      <button type="button" className="playlist-remove" aria-label={`Remove ${value.name}`} onClick={()=>{cancel();onChange(undefined)}}><X size={17}/></button>
    </div>}
    {value?.partial && <p className="playlist-note">Spotify shared a preview of this playlist. Only the playable songs found in that preview will be used.</p>}
    {!value || link ? <div className="playlist-input-row">
      <input aria-label="Spotify playlist link" type="url" value={link} disabled={busy} placeholder="https://open.spotify.com/playlist/…" autoComplete="off" spellCheck={false}
        aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}
        onChange={e=>{setLink(e.target.value);setError('')}} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();void add()}}}/>
      <button type="button" disabled={busy || !link.trim()} onClick={()=>void add()}>{busy ? 'Adding…' : 'Add'}</button>
    </div> : null}
    {busy && <p className="playlist-note" role="status">Finding playable songs…</p>}
    {error && <p className="playlist-error" id={`${id}-error`} role="alert">{error}</p>}
    {link && <button className="playlist-cancel" type="button" onClick={cancel}>Cancel</button>}
  </section>
}
