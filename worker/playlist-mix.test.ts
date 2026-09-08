import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import { importPlaylistMix, readPlaylistEmbed } from './playlist-mix.ts'
import type { Env } from './types'

const a = 'a'.repeat(22), b = 'b'.repeat(22), c = 'c'.repeat(22)
const embed = (ids:string[]) => `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({props:{pageProps:{state:{data:{entity:{name:'Test playlist',trackList:ids.map(id=>({uri:`spotify:track:${id}`}))}}}}}})}</script>`

test('public preview deduplicates exact track IDs and is always marked partial', () => {
  assert.deepEqual(readPlaylistEmbed(embed([a,a,b])),{name:'Test playlist',ids:[a,b],total:2,partial:true})
  assert.throws(()=>readPlaylistEmbed('<html>Unavailable</html>'),/public/)
})

test('import stores only playable exact members; failed imports never create an unrestricted mix', async () => {
  const db = new DatabaseSync(':memory:')
  db.exec(readFileSync(new URL('../migrations/0008_playlist_mixes.sql',import.meta.url),'utf8'))
  db.exec('CREATE TABLE tracks (id TEXT PRIMARY KEY, preview_url TEXT, hook_preview_url TEXT)')
  const insert = db.prepare('INSERT INTO tracks VALUES (?, ?, ?)')
  insert.run(a,'https://audio.test/a',null)
  insert.run(b,null,null)
  insert.run(c,'https://audio.test/c',null)
  const DB = {prepare:(sql:string)=>({bind:(...params:unknown[])=>({
    all:async()=>({results:db.prepare(sql).all(...params as never[])}),
    run:async()=>db.prepare(sql).run(...params as never[]),
  })})}
  const env = {DB} as unknown as Env
  const originalFetch = globalThis.fetch
  const urls:string[] = []
  let html = embed([a,b])
  globalThis.fetch = async(input) => {urls.push(String(input));return new Response(html)}
  try {
    const link = 'https://open.spotify.com/playlist/37i9dQZEVXbNBz9cRCSFkY'
    const mix = await importPlaylistMix(env,link)
    assert.equal(mix.matched,1)
    assert.equal(mix.partial,true)
    assert.deepEqual(JSON.parse(String(db.prepare('SELECT track_ids FROM playlist_mixes WHERE id=?').get(mix.id)?.track_ids)),[a])
    assert.equal((await importPlaylistMix(env,link)).id,mix.id,'same membership produces same snapshot')
    html = embed([b])
    await assert.rejects(importPlaylistMix(env,link),/None of these songs/)
    html = embed([])
    await assert.rejects(importPlaylistMix(env,link),/no songs/)
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM playlist_mixes').get()?.n,1)
    assert(urls.every(url=>url==='https://open.spotify.com/embed/playlist/37i9dQZEVXbNBz9cRCSFkY'),'never use archived membership')
  } finally {globalThis.fetch=originalFetch;db.close()}
})
