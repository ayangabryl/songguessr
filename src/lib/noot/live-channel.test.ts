import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createNootLiveChannel } from './live-channel.ts'
import type { NootLiveEvent, NootMotion } from '../../../shared/noot-live.ts'
const move = {actor:'friend',action:'drag' as const,x:1,y:2,vx:0,vy:0}
test('movement is throttled, but lifting and dropping are immediate',t=>{
  t.mock.timers.enable({apis:['Date'],now:1000})
  const sent:NootMotion[]=[];const c=createNootLiveChannel(packet=>sent.push(packet),'me')
  c.send({...move,action:'lift'});c.send(move);c.send(move);c.send({...move,action:'drop'})
  assert.deepEqual(sent.map(p=>p.action),['lift','drag','drop'])
  assert.deepEqual(sent.map(p=>p.seq),[0,1,2])
})
test('own echoes are not reapplied; fresh held snapshots use receipt time, not client clock',t=>{
  t.mock.timers.enable({apis:['Date'],now:100000})
  const c=createNootLiveChannel(()=>{},'me'), seen:NootLiveEvent[]=[]
  const stop=c.subscribe(event=>seen.push(event))
  c.receive({...move,type:'pet-motion',action:'lift',seq:0,from:'me',at:1})
  assert.equal(seen.length,0)
  c.receive({...move,type:'pet-motion',seq:1,from:'other',at:1})
  assert.equal(seen.length,1)
  const replay:NootLiveEvent[]=[];const stop2=c.subscribe(event=>replay.push(event))
  assert.equal(replay.length,1)
  c.reset();assert.equal(replay.at(-1)?.type,'pet-motion')
  assert.equal((replay.at(-1) as NootMotion).action,'drop')
  stop();stop2();c.receive({...move,type:'pet-motion',seq:2,from:'other',at:1})
  assert.equal(seen.length,2)
})
