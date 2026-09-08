import {test} from 'node:test'
import assert from 'node:assert/strict'
import {DatabaseSync} from 'node:sqlite'
import {readFileSync} from 'node:fs'
import {beginPlaylistImport,preparePlaylistBatch} from './playlist-prepare.ts'
import {allowedPlaylistPreview,samePreviewRecording,playlistAudioPlays} from './playlist-audio.ts'
import type {Env} from './types'

test('public preview sources cannot point at arbitrary hosts or substitute another recording',()=>{
  assert(allowedPlaylistPreview('https://p.scdn.co/mp3-preview/abc'))
  for(const url of ['http://p.scdn.co/mp3-preview/abc','https://p.scdn.co.evil.test/mp3-preview/abc','https://127.0.0.1/audio','https://user@p.scdn.co/mp3-preview/abc'])assert.equal(allowedPlaylistPreview(url),false)
  const song={id:'a',title:'夜に駆ける',artist:'YOASOBI'}
  assert(samePreviewRecording(song,{trackName:song.title,artistName:song.artist}))
  assert.equal(samePreviewRecording(song,{trackName:'群青',artistName:song.artist}),false)
  assert.equal(samePreviewRecording(song,{trackName:song.title,artistName:'Cover artist'}),false)
  assert.equal(samePreviewRecording({...song,title:'Hello again'},{trackName:'Hello',artistName:song.artist}),false)
})

test('preparation adds missing songs, repairs dead audio, preserves catalog rows and reports unavailable songs',async()=>{
  const db=new DatabaseSync(':memory:')
  for(const migration of ['0008_playlist_mixes.sql','0009_playlist_import_jobs.sql'])db.exec(readFileSync(new URL('../migrations/'+migration,import.meta.url),'utf8'))
  db.exec('CREATE TABLE tracks(id TEXT PRIMARY KEY,title TEXT,artist TEXT,preview_url TEXT,hook_preview_url TEXT,hook_start_seconds REAL,album_art TEXT,difficulty TEXT,genre_groups TEXT,song_key TEXT,updated_at TEXT,country TEXT,catalog TEXT)')
  const ids=['a','b','c','d'].map(c=>c.repeat(22))
  db.prepare('INSERT INTO tracks(id,title,artist,preview_url,country) VALUES (?,?,?,?,?)').run(ids[0],'Curated title','Artist','https://p.scdn.co/mp3-preview/dead','PH')
  db.prepare('INSERT INTO tracks(id,title,artist,preview_url) VALUES (?,?,?,?)').run(ids[3],'Existing','Artist','https://p.scdn.co/mp3-preview/good')
  const DB={prepare:(sql:string)=>{let args:unknown[]=[];const statement={bind:(...values:unknown[])=>{args=values;return statement},first:async()=>db.prepare(sql).get(...args as never[])??null,all:async()=>({results:db.prepare(sql).all(...args as never[])}),run:async()=>({meta:db.prepare(sql).run(...args as never[])})};return statement}}
  const env={DB} as unknown as Env
  const original=globalThis.fetch
  globalThis.fetch=async(input)=>{
    const url=String(input)
    if(url.includes('/embed/playlist/'))return new Response(`<script id="__NEXT_DATA__">${JSON.stringify({props:{pageProps:{state:{data:{entity:{name:'New songs',trackList:ids.map((id,i)=>({uri:`spotify:track:${id}`,title:'Song '+i,subtitle:'Artist',audioPreview:{url:'https://p.scdn.co/mp3-preview/'+(i===2?'missing':'good')}}))}}}}}})}</script>`)
    if(url.includes('/mp3-preview/good'))return new Response(new Uint8Array(2048),{headers:{'Content-Type':'audio/mpeg','Content-Length':'2048'}})
    if(url.includes('itunes.apple.com/search'))return Response.json({results:[{trackName:'Different song',artistName:'Artist',previewUrl:'https://p.scdn.co/mp3-preview/good'}]})
    return new Response('Not available',{status:404})
  }
  try{
    const initial=await beginPlaylistImport(env,'https://open.spotify.com/playlist/37i9dQZEVXbNBz9cRCSFkY')
    assert.equal(initial.total,4)
    const done=await preparePlaylistBatch(env,initial.jobId)
    assert.equal(done.complete,true);assert.equal(done.playable,3);assert.equal(done.added,1);assert.equal(done.unavailable,1)
    assert.equal(done.issues[0].id,ids[2])
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM tracks').get()?.n,3)
    const curated=db.prepare('SELECT * FROM tracks WHERE id=?').get(ids[0])
    assert.equal(curated?.title,'Curated title');assert.equal(curated?.country,'PH');assert.equal(curated?.preview_url,'https://p.scdn.co/mp3-preview/good')
    const members=JSON.parse(String(db.prepare('SELECT track_ids FROM playlist_mixes WHERE id=?').get(done.playlist!.id)?.track_ids))
    assert.deepEqual(members,[ids[0],ids[1],ids[3]])
    assert.deepEqual(await preparePlaylistBatch(env,initial.jobId),done,'completed imports are idempotent')
    db.prepare('DELETE FROM tracks WHERE id=?').run(ids[1])
    db.exec("WITH RECURSIVE numbers(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM numbers WHERE n<19998) INSERT INTO tracks(id) SELECT 'filler-'||n FROM numbers")
    db.prepare('UPDATE tracks SET preview_url=? WHERE id=?').run('https://p.scdn.co/mp3-preview/dead',ids[0])
    const full=await preparePlaylistBatch(env,(await beginPlaylistImport(env,'https://open.spotify.com/playlist/37i9dQZEVXbNBz9cRCSFkY')).jobId)
    assert.equal(full.playable,2,'existing audio can still be repaired at the catalog limit')
    assert.equal(full.added,0)
    assert(full.issues.some(issue=>issue.id===ids[1]&&issue.reason.includes('full')))
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM tracks').get()?.n,20000)
  }finally{globalThis.fetch=original;db.close()}
})

test('audio probes accept chunked audio but reject empty files and HTML errors',async()=>{
  const original=globalThis.fetch
  try{
    for(const [body,type,expected] of [[new Uint8Array(1024),'audio/mpeg',true],[new Uint8Array(0),'audio/mpeg',false],['<html>Error</html>','text/html',false]] as const){
      globalThis.fetch=async()=>new Response(body,{headers:{'Content-Type':type}})
      assert.equal(await playlistAudioPlays({} as Env,'https://p.scdn.co/mp3-preview/test'),expected)
    }
  }finally{globalThis.fetch=original}
})
