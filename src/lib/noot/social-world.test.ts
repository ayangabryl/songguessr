import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createSocialWorld, type NootParticipant } from './social-world.ts'
const participants: NootParticipant[] = ['a','b','c'].map(id=>({id,name:id,state:{pose:'idle',difficulty:'easy'}}))
function advance(world: ReturnType<typeof createSocialWorld>, seconds: number, roster=participants, hz=60) { for(let i=0;i<seconds*hz;i++)world.step(1/hz,roster) }

test('friends turn toward one another, make contact gestures and return facing their direction of travel',()=>{
  const world=createSocialWorld('test');world.step(0,participants)
  assert(world.interact('a','b','high-five'))
  advance(world,3)
  const a=world.actors.get('a')!,b=world.actors.get('b')!
  assert(a.yaw>.65&&b.yaw< -.65,'friends angle toward each other for palm contact')
  assert.equal(world.stateFor(a).interactionHand,'R'); assert.equal(world.stateFor(b).interactionHand,'L')
  assert.equal(a.pose,'high-five');assert.equal(b.pose,'high-five')
  assert(Math.abs(a.x-b.x)>=1.9,'bodies retain clearance')
  advance(world,3.9)
  assert(a.yaw<0,'left friend turns left to walk home')
  advance(world,2.8)
  assert(Math.abs(a.x-a.home)<.15)
})
test('drop resolves against floor, triggers recovery and returns to standing',()=>{
 const world=createSocialWorld('drop');world.step(0,participants.slice(0,2));world.lift('a');world.drag('a',-1.5,2.6);world.drop('a')
 let recovery=false
 for(let i=0;i<360;i++){world.step(1/60,participants.slice(0,2));const a=world.actors.get('a')!;assert(a.y>=0);assert(Number.isFinite(a.vy));if(a.pose==='tumble')recovery=true}
 assert(recovery);assert.equal(world.actors.get('a')!.y,0);assert.equal(world.actors.get('a')!.pose,'idle')
})
test('dragging into a friend separates bodies without moving the held actor',()=>{
 const world=createSocialWorld('contact');world.step(0,participants.slice(0,2));world.lift('a');world.drag('a',1.5,0);world.step(.016,participants.slice(0,2));
 assert.equal(world.actors.get('a')!.x,1.5);assert(Math.abs(world.actors.get('b')!.x-1.5)>=1.89)
})
test('floor dynamics stay consistent at 30 and 120 Hz, and reduced motion cancels play',()=>{
 const worlds=[30,120].map(hz=>{const w=createSocialWorld('timing');w.step(0,participants.slice(0,2));w.lift('a');w.drag('a',-1.5,2);w.drop('a');advance(w,1,participants.slice(0,2),hz);return w})
 assert(Math.abs(worlds[0].actors.get('a')!.y-worlds[1].actors.get('a')!.y)<.07)
 worlds[0].step(.016,participants.slice(0,2),true);assert.equal(worlds[0].activePlay,undefined)
 assert.equal(worlds[0].actors.get('a')!.held,false);assert.equal(worlds[0].actors.get('a')!.yaw,0)
 worlds[0].step(0,[]);assert.equal(worlds[0].actors.size,0)
})

test('outfit gestures follow the items actually worn',async()=>{
 const {outfitGestures}=await import('./character-mind.ts')
 assert.deepEqual(outfitGestures({pose:'idle',difficulty:'easy',headgear:'none'}),[])
 assert.deepEqual(outfitGestures({pose:'idle',difficulty:'easy',headgear:'headphones',clothing:'bandana'}).map(g=>g.clip),['Listen','FabricCheck'])
 assert.deepEqual(outfitGestures({pose:'idle',difficulty:'easy',headgear:'beanie',clothing:'shirt'}).map(g=>g.clip),['HatTip','TeeTug'])
})

test('jump anticipates, lands without being held, and can be replayed or interrupted',()=>{
 const w=createSocialWorld('jump'); const roster=participants.slice(0,2); w.step(0,roster)
 const a=w.actors.get('a')!
 for(let repetition=0;repetition<3;repetition++){
  assert(w.jump('a'));assert.equal(w.jump('a'),false)
  advance(w,.12,roster);assert(a.squash<1);assert.equal(a.y,0)
  advance(w,.4,roster);assert(a.y>.4);assert.equal(a.held,false)
  advance(w,1.8,roster);assert.equal(a.y,0);assert.equal(a.vy,0);assert.equal(a.jumpAt,undefined)
 }
 assert(w.jump('a'));advance(w,.4,roster);w.lift('a');w.drop('a');advance(w,4,roster)
 assert.equal(a.y,0);assert.equal(a.jumpAt,undefined);assert.equal(a.held,false)
})

test('dropping directly above a friend slides aside instead of balancing on their head',()=>{
 const w=createSocialWorld('no-stacking');const roster=participants.slice(0,2);w.step(0,roster)
 const a=w.actors.get('a')!,b=w.actors.get('b')!
 w.lift('a');w.drag('a',b.x,2.8);w.drop('a')
 advance(w,5,roster)
 assert.equal(a.y,0);assert.equal(b.y,0);assert(Math.abs(a.x-b.x)>1.89)
})

test('contact waits for arrival and never routes through a third friend',()=>{
 const w=createSocialWorld('arrival');w.step(0,participants)
 assert.equal(w.interact('a','c','high-five'),false)
 assert(w.interact('a','c','hello'));advance(w,3);assert.equal(w.actors.get('a')!.pose,'laugh')
 w.actors.get('a')!.x=-6
 assert(w.interact('a','b','high-five'));advance(w,3)
 assert.notEqual(w.actors.get('a')!.pose,'high-five','still approaching')
 let contact=false
 for(let i=0;i<360;i++) {w.step(1/60,participants);if(w.actors.get('a')!.pose==='high-five'){contact=true;assert(Math.abs(w.actors.get('a')!.x-w.actors.get('b')!.x)<2.46)}}
 assert(contact)
})

test('three to six friends all join group variations and autonomous play fairly',()=>{
 for(const size of [3,4,6]){
  const roster=Array.from({length:size},(_,i)=>({id:String(i),name:String(i),state:{pose:'idle' as const,difficulty:'easy' as const}}))
  const w=createSocialWorld('group-'+size);w.step(0,roster)
  for(const kind of ['wave-chain','group-dance'] as const){
   const seen=new Set<string>();assert(w.groupInteract(kind))
   for(let i=0;i<(kind==='group-dance'?17:8)*60;i++){w.step(1/60,roster);for(const a of w.actors.values())if(kind==='wave-chain'?a.pose==='wave-small':['groove','body-roll','charleston','hip-sway'].includes(a.pose))seen.add(a.id)}
   assert.equal(seen.size,size);assert.equal(w.activePlay,undefined)
  }
  const before=new Map([...w.actors.values()].map(a=>[a.id,a.lastPlay]))
  advance(w,150,roster,30)
  for(const a of w.actors.values()){assert(a.lastPlay>before.get(a.id)!,'each friend gets a turn');assert.equal(a.y,0)}
  w.groupInteract('group-dance');w.step(.016,roster.slice(0,2));w.step(.016,roster.slice(0,2),true)
  assert.equal(w.actors.size,2);assert.equal(w.activePlay,undefined)
 }
})

test('greeting on the initial roster resolves a sender listed after the recipient',()=>{
 const w=createSocialWorld('first-event');w.step(0,[{...participants[0],event:{id:1,type:'greeting',from:'b'}},participants[1]])
 assert.equal(w.activePlay,'hello')
})

test('adding and removing friends reflows seats without spawning inside another Noot',()=>{
 const w=createSocialWorld('seats');w.step(0,participants.slice(0,2));w.interact('a','b','high-five');advance(w,3,participants.slice(0,2))
 const roster=Array.from({length:6},(_,i)=>({...participants[i%3],id:String(i)}))
 roster[0]=participants[0];roster[1]=participants[1]
 w.step(.016,roster)
 for(let i=0;i<6;i++){const a=w.actors.get(roster[i].id)!;assert.equal(a.x,a.home);assert.equal(a.y,0);if(i)assert(a.x-w.actors.get(roster[i-1].id)!.x>2.9)}
 w.step(.016,roster.slice(0,2));assert.equal(w.actors.size,2);assert.equal(w.activePlay,undefined)
})


test('group dance varies styles on one clock and interruption clears synchronization',()=>{
 const w=createSocialWorld('dance-clock');w.step(0,participants);assert(w.groupInteract('group-dance'))
 advance(w,1,participants)
 const actors=[...w.actors.values()];assert.equal(new Set(actors.map(a=>a.pose)).size,3)
 const times=actors.map(a=>w.stateFor(a).danceTime);assert(times[0]!>0);assert(times.every(t=>t===times[0]))
 const paused=w.time;w.step(0,participants);assert.equal(w.time,paused)
 w.lift(actors[0].id);assert(actors.every(a=>w.stateFor(a).danceTime===undefined));w.drop(actors[0].id)
 advance(w,3,participants);assert(actors.every(a=>a.y===0))
})


test('finishing a group dance restores the game listening mood',()=>{
 const roster=participants.map(p=>({...p,state:{...p.state,pose:'play' as const,mood:'dance' as const}}))
 const w=createSocialWorld('resume-music');w.step(0,roster);w.groupInteract('group-dance');advance(w,17,roster)
 for(const a of w.actors.values()){assert.equal(a.pose,'play');assert.equal(w.stateFor(a).mood,'dance');assert.equal(w.stateFor(a).danceTime,undefined)}
})
