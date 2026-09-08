// Local end-to-end QA: live Spotify import, scoped picks and a private three-player table.
import assert from 'node:assert/strict'
import { readPlaylistEmbed } from '../worker/playlist-mix.ts'

const base = process.env.QA_BASE ?? 'http://127.0.0.1:3000'
assert(['localhost','127.0.0.1','[::1]'].includes(new URL(base).hostname),'Use a local test server')
const spotifyId = process.env.QA_PLAYLIST ?? '37i9dQZEVXbNBz9cRCSFkY'
const post = async(path,body) => fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(35_000)})
const imported = await post('/api/mix/playlist',{url:`https://open.spotify.com/playlist/${spotifyId}`})
const data = await imported.json()
assert(imported.ok,JSON.stringify(data))
const playlist = data.playlist
const source = readPlaylistEmbed(await (await fetch(`https://open.spotify.com/embed/playlist/${spotifyId}`)).text())
const members = new Set(source.ids)
assert(members.size)
const counts = (await (await fetch(`${base}/api/catalog/availability?playlistId=${playlist.id}`)).json()).counts
console.log('IMPORTED',playlist.name,playlist.matched,'playable; difficulty counts',counts)
for (const difficulty of ['easy','medium','hard','expert','impossible']) {
  for (let i=0;i<2;i++) {
    // Exhaust exclusions on the second pick to exercise the repeat fallback.
    const query = new URLSearchParams({playlistId:playlist.id,difficulty,...(i?{exclude:[...members].join(',')}:{})})
    const response = await fetch(`${base}/api/random?${query}`,{signal:AbortSignal.timeout(25_000)})
    const round = await response.json()
    assert(response.ok,JSON.stringify(round))
    assert(members.has(round.trackId),`Outside playlist: ${round.trackId}`)
  }
}
for (const query of [`playlistId=${'f'.repeat(64)}`,`playlistId=${playlist.id}&artists=NoSuchArtistPlaylistQA`]) {
  const response = await fetch(`${base}/api/random?${query}`)
  assert.equal(response.status,404,'empty scopes cannot fall back to the full catalog')
  const availability = await (await fetch(`${base}/api/catalog/availability?${query}`)).json()
  assert(Object.values(availability.counts).every(n=>n===0))
}
assert.equal((await post('/api/mix/playlist',{url:'https://example.com/playlist/test'})).status,422)
console.log('SOLO: 10 scoped picks across five difficulties; exclusion fallback and empty scopes passed')

const {code} = await (await post('/api/sitting',{})).json()
const peers = []
const delay = ms=>new Promise(resolve=>setTimeout(resolve,ms))
async function until(predicate) {
  for (let i=0;i<600;i++) {if(predicate())return;await delay(50)}
  throw Error('Timed out: '+JSON.stringify(peers.map(p=>({match:p.state?.match?.number,phase:p.state?.match?.phase,errors:p.errors}))))
}
async function connect(name,id=crypto.randomUUID(),token=crypto.randomUUID()) {
  const ws = new WebSocket(`${base.replace(/^http/,'ws')}/api/sitting/${code}/ws?${new URLSearchParams({name,playerId:id,token})}`)
  const peer = {ws,id,token,name,state:null,errors:[],send:command=>ws.send(JSON.stringify(command))}
  peers.push(peer)
  ws.onmessage = event => {if(event.data==='pong')return;const message=JSON.parse(event.data);if(message.type==='state')peer.state=message;if(message.type==='match-error')peer.errors.push(message.message)}
  await until(()=>peer.state?.players.some(p=>p.id===id))
  return peer
}
try {
  const host = await connect('Playlist QA host')
  const guest = await connect('Playlist QA guest')
  const third = await connect('Playlist QA third')
  host.send({type:'match-start',difficulty:'easy',length:5,filters:{playlist}})
  await until(()=>peers.every(p=>p.state?.match?.phase==='playing'))
  const firstRound = host.state.match.roundId
  assert(peers.every(p=>p.state.match.roundId===firstRound))
  const audio = host.state.match.audio
  assert(peers.every(p=>p.state.match.audio===audio))
  const audioResponse = await fetch(new URL(audio,base),{headers:{Range:'bytes=0-1023'},signal:AbortSignal.timeout(15_000)})
  assert(audioResponse.ok,'shared playlist audio plays')
  await audioResponse.body?.cancel()
  async function passRound(active) {
    const roundId = active[0].state.match.roundId
    await delay(Math.max(0,active[0].state.match.startsAt-Date.now()+80))
    for (let stage=0;stage<5;stage++) {
      for(const peer of active)peer.send({type:'match-skip',roundId,stage})
      await until(()=>active.every(peer=>{
        const entry=peer.state.match.entries.find(p=>p.id===peer.id)
        return stage===4?entry.status==='out':entry.stage===stage+1
      }))
    }
    await until(()=>active.every(p=>p.state.match.phase==='reveal'))
    assert(members.has(active[0].state.match.answer.id),'multiplayer answer belongs to playlist')
    assert(active.every(p=>p.state.match.filters.playlist.id===playlist.id))
  }
  await passRound([host,guest,third])
  guest.ws.close(1000,'QA reconnect')
  await until(()=>host.state.players.find(p=>p.id===guest.id)?.connected===false)
  const rejoined = await connect(guest.name,guest.id,guest.token)
  assert.equal(rejoined.state.match.filters.playlist.id,playlist.id)
  for (const peer of [host,rejoined,third])peer.send({type:'match-next',roundId:firstRound})
  await until(()=>[host,rejoined,third].every(p=>p.state.match.number===2))
  await passRound([host,rejoined,third])
  assert.equal(host.state.match.completedRounds.length,2)
  console.log('MULTIPLAYER: three peers, shared audio, two scoped rounds, history and reconnect passed; table',code)
} finally {for(const peer of peers)peer.ws.close(1000,'Playlist QA complete')}
