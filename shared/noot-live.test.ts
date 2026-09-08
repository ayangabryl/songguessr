import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createNootRelay, parseNootMotion, type NootMotion } from './noot-live.ts'
const move = (action:NootMotion['action'],seq=0):NootMotion => ({type:'pet-motion',actor:'a',action,seq,x:1,y:2,vx:1,vy:1})
test('motion is finite, bounded and cannot contain forged game state',()=>{
  assert.equal(parseNootMotion({...move('drag'),x:NaN}),null)
  assert.equal(parseNootMotion({...move('jump'),seq:-1}),null)
  assert.equal(parseNootMotion({...move('jump'),action:'award-points'}),null)
  const p=parseNootMotion({...move('drop'),x:999,y:999,points:999})!
  assert.equal(p.x,18);assert.equal(p.y,2.8);assert.equal('points' in p,false)
})
test('one controller holds a Noot, stale packets and flooding are ignored',()=>{
  const r=createNootRelay(), members=['a','b','c']
  assert.equal(r.accept('intruder',move('lift'),members,0),null)
  assert.ok(r.accept('a',move('lift'),members,0))
  assert.equal(r.accept('b',move('lift'),members,10),null)
  assert.equal(r.accept('a',move('drag',1),members,10),null)
  assert.ok(r.accept('a',move('drag',2),members,60))
  assert.equal(r.accept('a',move('drag',1),members,120),null)
  assert.ok(r.accept('a',move('drop',3),members,121))
  assert.ok(r.accept('b',move('lift',1),members,122))
})
test('reconnect snapshots include a held character; disconnect releases and resets sequence',()=>{
  const r=createNootRelay(), members=['a','b']
  r.accept('b',move('lift',20),members,0)
  assert.equal(r.snapshot(100).length,1)
  assert.equal(r.snapshot(3000).length,0)
  assert.deepEqual(r.release('b',100).map(e=>[e.action,e.actor,e.vx,e.vy]),[['drop','a',0,0]])
  assert.equal(r.snapshot(100).length,0)
  assert.ok(r.accept('b',move('lift',0),members,101))
})
test('expired grabs can be taken over, and a drop is never lost to drag throttling',()=>{
  const r=createNootRelay(), members=['a','b']
  r.accept('a',move('lift'),members,0)
  assert.ok(r.accept('b',move('lift'),members,3000))
  assert.ok(r.accept('b',move('drop',1),members,3001))
})
