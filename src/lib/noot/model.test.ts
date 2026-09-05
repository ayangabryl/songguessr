import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import * as THREE from 'three'
import { createNoot } from './model.ts'
import { blinkAmount, spring } from './motion.ts'
import type { NootState } from './types.ts'

const rig = createNoot()
const pointer = new THREE.Vector2()
let time = 0, eventId = 0
function simulate(change: Partial<NootState>, duration = 1.5, fps = 60) {
  const state: NootState = { pose: 'idle', difficulty: 'easy', eventId: ++eventId, ...change }
  for (let i = 0; i < duration * fps; i++) { time += 1 / fps; rig.update(time, 1 / fps, state, pointer, false) }
  rig.root.updateMatrixWorld(true)
  return state
}
after(() => rig.dispose())

test('the pear and note are a closed, connected surface with normalized skin weights', () => {
  const body = rig.root.getObjectByName('continuous-body-and-note') as THREE.SkinnedMesh
  const pos = body.geometry.getAttribute('position'), weights = body.geometry.getAttribute('skinWeight')
  const edges = new Map<string, number>(), neighbors = new Map<string, Set<string>>()
  const key = (i: number) => [pos.getX(i), pos.getY(i), pos.getZ(i)].map(n=>Math.round(n*10000)).join(',')
  for (let i=0;i<pos.count;i++) {
    assert([pos.getX(i),pos.getY(i),pos.getZ(i)].every(Number.isFinite))
    assert(Math.abs(weights.getX(i)+weights.getY(i)+weights.getZ(i)+weights.getW(i)-1)<1e-6)
  }
  for (let i=0;i<pos.count;i+=3) {
    const ids=[key(i),key(i+1),key(i+2)]
    if (new Set(ids).size !== 3) continue
    for(let j=0;j<3;j++) {
      const a=ids[j],b=ids[(j+1)%3],edge=[a,b].sort().join('|')
      edges.set(edge,(edges.get(edge)??0)+1)
      if(!neighbors.has(a))neighbors.set(a,new Set())
      if(!neighbors.has(b))neighbors.set(b,new Set())
      neighbors.get(a)!.add(b); neighbors.get(b)!.add(a)
    }
  }
  assert([...edges.values()].every(n=>n===2),'no open edges or detached antenna cap')
  const visited=new Set<string>(), stack=[neighbors.keys().next().value!]
  while(stack.length){const id=stack.pop()!;if(visited.has(id))continue;visited.add(id);stack.push(...neighbors.get(id)!)}
  assert.equal(visited.size,neighbors.size,'one connected sculpt')
})

test('skip travels in the requested direction and its replay can restart without a remount', () => {
  simulate({pose:'skip',direction:1})
  assert(rig.root.position.x>.7)
  simulate({pose:'skip',direction:-1})
  assert(rig.root.position.x<-.7)
  simulate({pose:'skip',direction:1,onRuler:true})
  assert(Math.abs(rig.root.position.x)<.02,'ruler owns translation in the game')
})

test('walking alternates planted feet; both never float at once', () => {
  const state=simulate({pose:'walk'},.5)
  const left=rig.root.getObjectByName('left-foot')!,right=rig.root.getObjectByName('right-foot')!
  let leftLift=false,rightLift=false
  for(let i=0;i<120;i++) {
    time+=1/60; rig.update(time,1/60,state,pointer,false)
    assert(Math.min(left.position.y,right.position.y)<=.15001)
    leftLift ||= left.position.y>.19; rightLift ||= right.position.y>.19
  }
  assert(leftLift&&rightLift)
})

test('pause preserves gait and rig transforms', () => {
  const state=simulate({pose:'dance'})
  rig.update(time,0,{...state,paused:true},pointer,false); rig.root.updateMatrixWorld(true)
  const transforms=new Map<string,number[]>()
  rig.root.traverse(o=>transforms.set(o.uuid,[...o.matrixWorld.elements]))
  for(let i=0;i<10;i++)rig.update(time,0,{...state,paused:true},pointer,false)
  rig.root.updateMatrixWorld(true)
  rig.root.traverse(o=>assert.deepEqual(o.matrixWorld.elements,transforms.get(o.uuid)))
})

test('outfits are exclusive and changing them keeps the same character', () => {
  const body=rig.root.getObjectByName('continuous-body-and-note')
  for(const headgear of ['headphones','cat-earphones','daisy','none'] as const) {
    simulate({headgear},.1)
    for(const name of ['headphones','cat-earphones','daisy','none'])assert.equal(rig.root.getObjectByName(name)!.visible,name===headgear)
    assert.equal(rig.root.getObjectByName('continuous-body-and-note'),body)
  }
})

test('all reactions remain finite at low frame rates and under rapid interruptions', () => {
  for(const pose of ['idle','play','win','lose','timeout','skip','streak','switch','hover','tap','dance','happy-song','sad-song','walk','run','sleepy','listen-close','shrug','cheer'] as const) {
    simulate({pose,difficulty:'impossible'},.35,20)
    rig.root.traverse(o=>assert(o.matrixWorld.elements.every(Number.isFinite)))
  }
})

test('reduced motion holds the body and feet still', () => {
  const state: NootState={pose:'dance',difficulty:'easy',eventId:++eventId}
  for(let i=0;i<100;i++){time+=1/60;rig.update(time,1/60,state,pointer,true)}
  assert.deepEqual(rig.root.position.toArray(),[0,0,0])
  assert.equal(rig.root.getObjectByName('left-foot')!.position.y,.15)
  assert.equal(rig.root.getObjectByName('right-foot')!.position.y,.15)
})

test('springs settle consistently at 20 and 120 fps; blink closes faster than it opens', () => {
  const low=spring(),high=spring()
  let a=0,b=0
  for(let i=0;i<40;i++)a=low.step(1,1/20)
  for(let i=0;i<240;i++)b=high.step(1,1/120)
  assert(Math.abs(a-b)<.001)
  assert.equal(blinkAmount(.09),1)
  assert(blinkAmount(.19)>0)
  assert.equal(blinkAmount(.32),0)
})

test('successive skips include grounded running and two ballistic variations', () => {
  const peaks: number[] = []
  for(let variant=0;variant<3;variant++) {
    const state: NootState={pose:'skip',difficulty:'easy',eventId:300+variant}
    let peak=0
    for(let i=0;i<90;i++) {
      time+=1/60;rig.update(time,1/60,state,pointer,false)
      peak=Math.max(peak,rig.root.position.y)
      assert(rig.root.position.y>=-.001,'jump never passes through the floor')
    }
    peaks.push(peak)
    assert(Math.abs(rig.root.position.y)<.02,'returns to ground after each skip')
  }
  assert(peaks[0]<.02)
  assert(peaks[1]>.08 && peaks[1]<.10)
  assert(peaks[2]>.15 && peaks[2]<.17)
})

test('arm normals stay smooth across shared triangle corners', () => {
  const arm=rig.root.getObjectByName('soft-articulated-arm') as THREE.SkinnedMesh
  const positions=arm.geometry.getAttribute('position'), normals=arm.geometry.getAttribute('normal')
  const seen=new Map<string,THREE.Vector3>()
  let shared=0
  for(let i=0;i<positions.count;i++) {
    const key=[positions.getX(i),positions.getY(i),positions.getZ(i)].map(v=>v.toFixed(6)).join(',')
    const normal=new THREE.Vector3(normals.getX(i),normals.getY(i),normals.getZ(i)).normalize()
    const previous=seen.get(key)
    if(previous) { assert(previous.dot(normal)>.999,'no flat triangle seam'); shared++ }
    else seen.set(key,normal)
  }
  assert(shared>100)
})

test('ruler motion determines facing and stops footsteps when travel stops', () => {
  simulate({pose:'skip',eventId:600,onRuler:true,travelSpeed:-1,direction:1},.65)
  assert(rig.root.rotation.y<-.9,'faces actual measured travel, not the stale target direction')
  simulate({pose:'skip',eventId:603,onRuler:true,travelSpeed:0},.9)
  const left=rig.root.getObjectByName('left-foot')!,right=rig.root.getObjectByName('right-foot')!
  assert(Math.abs(left.position.y-.15)<.002 && Math.abs(right.position.y-.15)<.002)
})


test('contact pivots earcups within hinge limits and releases without changing anatomy', () => {
  const body=rig.root.getObjectByName('continuous-body-and-note') as THREE.SkinnedMesh
  const geometry=body.geometry
  simulate({pose:'listen-close',headgear:'headphones'},1.3)
  const hinge=rig.root.getObjectByName('earcup-hinge--1')!
  assert(hinge.rotation.x>.02 && hinge.rotation.x<.08)
  const state=simulate({pose:'idle',headgear:'headphones'},2)
  assert(Math.abs(hinge.rotation.x)<.005)
  assert.equal(body.geometry,geometry)
  rig.update(time,0,{...state,paused:true},pointer,false)
  const rotation=hinge.rotation.x
  rig.update(time,0,{...state,paused:true},pointer,false)
  assert.equal(hinge.rotation.x,rotation)
})
