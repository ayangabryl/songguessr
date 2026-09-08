import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { createRequire } from 'node:module'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { createNootFromAsset, clipForState } from './asset.ts'
import type { NootState } from './types.ts'

const bytes = await readFile(new URL('../../../public/mascot/noot.glb', import.meta.url))
// Decode the actual embedded PNG in Node; rendering still gets reviewed in-browser.
const { PNG } = createRequire(import.meta.url)('pngjs')
Object.assign(globalThis, { self: globalThis, createImageBitmap: async (blob: Blob) => {
  const image = PNG.sync.read(Buffer.from(await blob.arrayBuffer()))
  return { ...image, close() {} }
} })
const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
const pointer = new THREE.Vector2()
const state: NootState = { pose: 'idle', difficulty: 'easy' }

test('GLB carries the shared rig with wrists and tail, normalized weights and expressions', () => {
  assert(bytes.byteLength < 5_000_000, 'asset stays below the 5 MB uncompressed budget including clothing')
  assert.equal(gltf.animations.length, 43)
  const skeletons = new Set<THREE.Skeleton>()
  gltf.scene.traverse(o => {
    if (!(o instanceof THREE.SkinnedMesh)) return
    skeletons.add(o.skeleton)
    const weights = o.geometry.getAttribute('skinWeight')
    for (let i = 0; i < weights.count; i++) {
      const sum = weights.getX(i) + weights.getY(i) + weights.getZ(i) + weights.getW(i)
      assert(Math.abs(sum - 1) < 1e-5, `${o.name} has an unbound vertex`)
    }
  })
  assert.equal(skeletons.size, 1)
  assert.equal([...skeletons][0].bones.length, 19)
  for (const name of ['hand_L', 'hand_R', 'tail_base', 'tail_mid', 'tail_tip']) assert(gltf.scene.getObjectByName(name))
  for (const clip of gltf.animations) {
    assert(clip.tracks.some(t => t.name.includes('morphTargetInfluences')))
    for (const track of clip.tracks) assert([...track.values].every(Number.isFinite))
  }
})

test('authored loops close without a pose or expression discontinuity', () => {
  for (const clip of gltf.animations.filter(c => ['Groove','BodyRoll','Charleston','HipSway','Idle', 'Walk', 'WalkSoft', 'Run', 'Dance', 'DanceB', 'Samba', 'Happy', 'Sad', 'Listen', 'Sleepy'].includes(c.name))) {
    for (const track of clip.tracks) {
      const size = track.getValueSize()
      for (let i = 0; i < size; i++) {
        assert(Math.abs(track.values[i] - track.values[track.values.length - size + i]) < 1e-4, `${clip.name}: ${track.name}`)
      }
    }
  }
})

test('the stage jump animates hands and feet, leaves flight to physics, and settles to rest', () => {
  const jump = gltf.animations.find(c => c.name === 'Jump')!
  assert(jump, 'the Blender jump is exported')
  assert.equal(clipForState({...state,pose:'jump'}),'Jump')
  const root = jump.tracks.find(t => t.name === 'root.position')!
  assert(root && [...root.values].every(v => Math.abs(v)<1e-6), 'no second root elevation can remain after physical landing')
  const feet = jump.tracks.find(t => t.name === 'foot_L.position')!
  const size = feet.getValueSize()
  assert(Math.max(...Array.from(feet.values).filter((_,i)=>i%size===1))-feet.values[1]>.05, 'feet tuck during the flight')
  for(let i=0;i<size;i++) assert(Math.abs(feet.values[i]-feet.values[feet.values.length-size+i])<1e-4)
  const model = createNootFromAsset(gltf,'jump-check')
  for(let frame=0;frame<120;frame++) model.update(frame/60,1/60,{...state,pose:frame<90?'jump':'idle',directed:true,eventId:frame<90?1:2},pointer,false)
  assert(model.elevation<.001)
  model.dispose()
})

test('turning retains a rounded body and a centered lower antenna', () => {
  const body = gltf.scene.getObjectByName('Noot_Body') as THREE.Mesh
  const positions = body.geometry.getAttribute('position')
  const torso = new THREE.Box3(), stem = new THREE.Box3(), point = new THREE.Vector3()
  for (let i = 0; i < positions.count; i++) {
    point.fromBufferAttribute(positions, i)
    if (point.y > .8 && point.y < 1.4) torso.expandByPoint(point)
    if (point.y > 2.78 && point.y < 2.82) stem.expandByPoint(point)
  }
  const size = torso.getSize(new THREE.Vector3())
  assert(size.z / size.x > .75, 'side profile must retain body volume')
  assert(Math.abs(stem.min.x + stem.max.x) < .025, 'lower antenna stays centered')
})

test('closed lids cover stable eyes, and blush fades to transparent skin edges', () => {
  const model = createNootFromAsset(gltf)
  model.update(0, 0, state, pointer, false)
  const lids = ['L', 'R'].flatMap(side => ['Noot_Lid_', 'Noot_LowerLid_'].map(prefix => model.root.getObjectByName(prefix + side) as THREE.Mesh))
  for (const lid of lids) lid.morphTargetInfluences![lid.morphTargetDictionary!.Blink] = 1
  model.root.updateMatrixWorld(true)
  model.root.traverse(o => { if (o instanceof THREE.SkinnedMesh) o.skeleton.update() })
  const ray = new THREE.Raycaster()
  const visibleMeshes: THREE.Object3D[] = []
  model.root.traverseVisible(o => { if (o instanceof THREE.Mesh) visibleMeshes.push(o) })
  for (const side of [-1, 1]) for (const dx of [-.11, 0, .11]) for (const dy of [-.12, 0, .12]) {
    ray.set(new THREE.Vector3(side * .42 + dx, 2.015 + dy, 4), new THREE.Vector3(0, 0, -1))
    const hit = ray.intersectObjects(visibleMeshes, false)[0]
    assert(hit && lids.includes(hit.object as THREE.Mesh), `closed eyelid must cover the eye at ${side},${dx},${dy}; hit ${hit?.object.name}`)
  }
  const cheek = model.root.getObjectByName('Noot_Cheek_L') as THREE.Mesh
  const colors = cheek.geometry.getAttribute('color')
  assert.equal(colors.itemSize, 4)
  const alpha = Array.from({ length: colors.count }, (_, i) => colors.getW(i))
  assert(Math.min(...alpha) < .01 && Math.max(...alpha) > .99)
  assert((cheek.material as THREE.MeshStandardMaterial).transparent)
  model.update(.4, .4, { ...state, difficulty: 'hard' }, pointer, false)
  assert.deepEqual(Array.from({ length: colors.count }, (_, i) => colors.getW(i)), alpha, 'palette changes retain the feathered edge')
  model.dispose()
})

test('walk alternates planted soles without penetrating the floor', () => {
  const model = createNootFromAsset(gltf)
  const feet = ['L', 'R'].map(s => model.root.getObjectByName('Noot_Foot_' + s) as THREE.SkinnedMesh)
  const vertex = new THREE.Vector3()
  let liftedLeft = false, liftedRight = false
  for (let i = 0; i < 180; i++) {
    model.update(i / 60, 1 / 60, { ...state, pose: 'walk' }, pointer, false)
    model.root.updateMatrixWorld(true)
    feet[0].skeleton.update()
    const lowest = feet.map(foot => {
      let min = Infinity
      for (let j = 0; j < foot.geometry.getAttribute('position').count; j++) {
        foot.getVertexPosition(j, vertex).applyMatrix4(foot.matrixWorld)
        min = Math.min(min, vertex.y)
      }
      return min
    })
    assert(Math.min(...lowest) > -.004, `sole penetrated: ${lowest}`)
    assert(Math.min(...lowest) < .008, `both feet floating: ${lowest}`)
    liftedLeft ||= lowest[0] > .04
    liftedRight ||= lowest[1] > .04
  }
  assert(liftedLeft && liftedRight)
  model.dispose()
})

test('multiple Noots have independent bones, morphs and palettes', () => {
  const a = createNootFromAsset(gltf), b = createNootFromAsset(gltf)
  a.update(.4, .4, { ...state, pose: 'dance', difficulty: 'hard' }, pointer, false)
  b.update(.4, .4, state, pointer, false)
  assert.notEqual(a.root.getObjectByName('head'), b.root.getObjectByName('head'))
  const ma = a.root.getObjectByName('Noot_Mouth') as THREE.Mesh
  const mb = b.root.getObjectByName('Noot_Mouth') as THREE.Mesh
  assert.notEqual(ma.morphTargetInfluences, mb.morphTargetInfluences)
  const sa = a.root.getObjectByName('Noot_Body') as THREE.SkinnedMesh
  const sb = b.root.getObjectByName('Noot_Body') as THREE.SkinnedMesh
  assert.notEqual(sa.material, sb.material)
  a.dispose()
  b.update(.5, .1, state, pointer, false)
  assert(b.root.getObjectByName('head')!.position.toArray().every(Number.isFinite))
  b.dispose()
})

test('pause holds animation and reduced motion holds the rest skeleton', () => {
  const model = createNootFromAsset(gltf)
  const dance = { ...state, pose: 'dance' as const }
  for (let i = 0; i < 30; i++) model.update(i / 60, 1 / 60, dance, pointer, false)
  const transforms = () => {
    model.root.updateMatrixWorld(true)
    const result: number[] = []
    model.root.traverse(o => result.push(...o.matrix.elements))
    return result
  }
  const before = transforms()
  for (let i = 0; i < 20; i++) model.update(.5, 0, { ...dance, paused: true }, pointer, false)
  assert.deepEqual(transforms(), before)
  model.update(1, .05, dance, pointer, true)
  const still = transforms()
  for (let i = 0; i < 20; i++) model.update(2+i, .05, dance, pointer, true)
  assert.deepEqual(transforms(), still)
  model.dispose()
})

test('game skips use ruler travel once and repeated gestures replay', () => {
  const model = createNootFromAsset(gltf)
  for (let i = 0; i < 90; i++) model.update(i/60, 1/60, {...state,pose:'skip',onRuler:true,travelSpeed:1.2},pointer,false)
  assert.equal(model.root.position.x,0)
  assert(model.root.rotation.y > 1.3)
  for (let i = 90; i < 130; i++) model.update(i/60, 1/60, {...state,pose:'skip',onRuler:true,travelSpeed:-1.2},pointer,false)
  assert(model.root.rotation.y < -1.2)
  model.update(3,.1,{...state,pose:'tap',eventId:1},pointer,false)
  model.update(4,1,{...state,pose:'tap',eventId:1},pointer,false)
  model.update(4.2,.2,{...state,pose:'tap',eventId:2},pointer,false)
  const chest = model.root.getObjectByName('chest')!
  assert(chest.scale.y < .99, 'replayed pet crouches again')
  model.dispose()
})

test('every UI action maps to an exported clip and headphones remain removable', () => {
  for (const pose of ['idle','play','walk','run','skip','dance','happy-song','sad-song','sleepy','hover','tap','win','streak','lose','timeout','switch','listen-close','shrug','cheer','samba','outfit','high-five','boop','catch','tumble','stretch','look-around','yawn','wave-small','laugh','angry','startled','sit','get-up'] as const) {
    assert(gltf.animations.some(c => c.name === clipForState({ ...state, pose })))
  }
  const model = createNootFromAsset(gltf)
  for (const headgear of ['headphones','cat-earphones','none','daisy','beanie','bucket'] as const) {
    model.update(0,0,{...state,headgear},pointer,false)
    model.root.traverse(o => {
      if (o.userData.headgear === 'headphones') assert.equal(o.visible,headgear==='headphones'||headgear==='cat-earphones')
    })
  }
  for (const clothing of ['none','shirt','bandana','bow','scarf'] as const) {
    model.update(0,0,{...state,headgear:'beanie',clothing},pointer,false)
    model.root.traverse(o=>{if(o.userData.wardrobe)assert.equal(o.visible,o.userData.wardrobe===clothing||o.userData.wardrobe==='beanie')})
  }
  assert((model.root.getObjectByName('Noot_Cushion_L') as THREE.Mesh).morphTargetDictionary?.Squish!==undefined)
  model.dispose()
})

test('attention and blinking recover after gestures without replacing iris pixels',()=>{
 const model=createNootFromAsset(gltf,'blink-check'), lid=model.root.getObjectByName('Noot_Lid_L') as THREE.Mesh
 const eye=model.root.getObjectByName('Noot_Eye_L') as THREE.Mesh
 const map=(eye?.material as THREE.MeshStandardMaterial)?.map
 let closes=0,reopens=0,previous=false
 for(let i=0;i<1200;i++){
  const pose=i<100?'hover':i<230?'listen-close':'idle'
  model.update(i/60,1/60,{...state,pose},new THREE.Vector2(Math.sin(i*.03),Math.cos(i*.03)),false)
  const blink=lid.morphTargetInfluences![lid.morphTargetDictionary!.Blink]
  if(blink>.95&&!previous){closes++;previous=true}if(blink<.1&&previous){reopens++;previous=false}
  if(map)assert(Math.abs(map.offset.x)<.06&&Math.abs(map.offset.y)<.05,'gaze stays within the painted iris texture')
 }
 assert(closes>=3&&reopens>=3,'blinks must repeatedly close and reopen after gestures');model.dispose()
})

test('three-quarter high five brings opposite palms together without overlapping bodies',()=>{
 const left=createNootFromAsset(gltf,'pair-left'),right=createNootFromAsset(gltf,'pair-right')
 const a=new THREE.Group(),b=new THREE.Group();a.add(left.root);b.add(right.root);a.position.x=-1.16;b.position.x=1.16;a.rotation.y=.72;b.rotation.y=-.72
 let closest=Infinity
 for(let i=0;i<100;i++){
  left.update(i/60,1/60,{...state,pose:'high-five',directed:true,interactionHand:'R'},pointer,false)
  right.update(i/60,1/60,{...state,pose:'high-five',directed:true,interactionHand:'L'},pointer,false)
  a.updateMatrixWorld(true);b.updateMatrixWorld(true)
  const p=left.root.getObjectByName('hand_R')!.getWorldPosition(new THREE.Vector3()),q=right.root.getObjectByName('hand_L')!.getWorldPosition(new THREE.Vector3())
  if(i>35)closest=Math.min(closest,p.distanceTo(q))
 }
 assert(closest<.18,`opposite palms should meet, gap ${closest}`);left.dispose();right.dispose()
})

test('headphone foam compresses under the listening hand and releases afterward',()=>{
 const model=createNootFromAsset(gltf,'foam'),pad=model.root.getObjectByName('Noot_Cushion_L') as THREE.Mesh
 const index=pad.morphTargetDictionary!.Squish
 let peak=0
 for(let i=0;i<220;i++){model.update(i/60,1/60,{...state,pose:'listen-close',directed:true},pointer,false);peak=Math.max(peak,pad.morphTargetInfluences![index])}
 assert(peak>.02,`hand contact must compress the pad, got ${peak}`)
 for(let i=220;i<430;i++)model.update(i/60,1/60,{...state,pose:'idle',directed:true,lookAt:{x:0,y:0}},pointer,false)
 assert(pad.morphTargetInfluences![index]<.01,'foam must recover after contact');model.dispose()
})


test('free dance clips keep one sole grounded, stay in place, and recover to idle', () => {
  for (const pose of ['groove','body-roll','charleston','hip-sway','victory-dance','friendly-wave'] as const) {
    const model=createNootFromAsset(gltf,'template-'+pose)
    const feet=['L','R'].map(side=>model.root.getObjectByName('Noot_Foot_'+side) as THREE.SkinnedMesh)
    const point=new THREE.Vector3()
    for(let i=0;i<300;i++) {
      model.update(i/30,1/30,{...state,pose,directed:true},pointer,false)
      model.root.updateMatrixWorld(true);feet[0].skeleton.update()
      const sole=feet.map(foot=>{
        let low=Infinity
        for(let v=0;v<foot.geometry.getAttribute('position').count;v++) {
          foot.getVertexPosition(v,point).applyMatrix4(foot.matrixWorld);low=Math.min(low,point.y)
        }
        return low
      })
      assert(Math.min(...sole)>-.006,`${pose} floor penetration: ${sole}`)
      assert(Math.min(...sole)<.015,`${pose} both feet floating: ${sole}`)
      assert(model.elevation<.001,`${pose} must not translate the root`)
    }
    for(let i=0;i<45;i++)model.update(10+i/30,1/30,{...state,lookAt:{x:0,y:0}},pointer,false)
    assert(Math.abs(model.root.getObjectByName('pelvis')!.position.x)<.005,`${pose} settles after interruption`)
    model.dispose()
  }
})

test('dance instances follow a shared clock and freeze while paused',()=>{
  const a=createNootFromAsset(gltf,'sync-a'),b=createNootFromAsset(gltf,'sync-b')
  for(let i=0;i<100;i++){
    const input={...state,pose:'charleston' as const,directed:true,danceTime:i/60}
    a.update(i/60,1/60,input,pointer,false);b.update(i/60,1/60,input,pointer,false)
  }
  for(const name of ['pelvis','foot_L','foot_R','upper_arm_L']) {
    const first=a.root.getObjectByName(name)!,second=b.root.getObjectByName(name)!
    assert(first.position.distanceTo(second.position)<1e-6)
    assert(first.quaternion.angleTo(second.quaternion)<1e-5)
  }
  const bone=a.root.getObjectByName('foot_L')!
  const before=bone.position.clone()
  for(let i=0;i<30;i++)a.update(5+i,0,{...state,pose:'charleston',directed:true,danceTime:100,paused:true},pointer,false)
  assert(bone.position.distanceTo(before)<1e-8,'paused dance ignores advancing external time')
  a.dispose();b.dispose()
})

test('each dance reads at small sizes through visible weight shifts, hands and foot lifts',()=>{
 for(const pose of ['groove','body-roll','charleston','hip-sway'] as const){
  const model=createNootFromAsset(gltf,'readable-'+pose)
  const hips=new THREE.Box3(),hands=new THREE.Box3(),feet=new THREE.Box3(),point=new THREE.Vector3()
  for(let frame=30;frame<540;frame++){
   model.update(frame/60,1/60,{...state,pose,directed:true},pointer,false)
   model.root.updateMatrixWorld(true)
   hips.expandByPoint(model.root.getObjectByName('pelvis')!.getWorldPosition(point))
   hands.expandByPoint(model.root.getObjectByName('hand_R')!.getWorldPosition(point))
   feet.expandByPoint(model.root.getObjectByName('foot_L')!.getWorldPosition(point))
  }
  assert(hips.max.x-hips.min.x>.16,`${pose}: weight shift must be legible`)
  assert(hands.getSize(point).length()>.35,`${pose}: hand gesture must be legible`)
  assert(feet.max.y-feet.min.y>.065,`${pose}: feet must visibly step`)
  model.dispose()
 }
})

test('settled blush uses a material tint without recurring vertex uploads',()=>{
 const model=createNootFromAsset(gltf,'blush-upload')
 const cheek=model.root.getObjectByName('Noot_Cheek_L') as THREE.Mesh
 const colors=cheek.geometry.getAttribute('color') as THREE.BufferAttribute
 model.update(0,0,state,pointer,false)
 const version=colors.version
 for(let i=1;i<120;i++)model.update(i/60,1/60,state,pointer,false)
 assert.equal(colors.version,version)
 const before=(cheek.material as THREE.MeshStandardMaterial).color.clone()
 for(let i=120;i<180;i++)model.update(i/60,1/60,{...state,difficulty:'hard'},pointer,false)
 assert(!before.equals((cheek.material as THREE.MeshStandardMaterial).color))
 assert.equal(colors.version,version)
 model.dispose()
})


test('crowd detail removes tiny paw draws and restores them without changing anatomy',()=>{
 const model=createNootFromAsset(gltf,'crowd-detail')
 const visible=()=>{let count=0;model.root.traverseVisible(o=>{if(o instanceof THREE.Mesh)count++});return count}
 const before=visible(),arm=model.root.getObjectByName('Noot_Arm_L')!,foot=model.root.getObjectByName('Noot_Foot_L')!
 model.setCompact(true);assert(before-visible()>=16);assert(arm.visible&&foot.visible)
 model.setCompact(false);assert.equal(visible(),before);model.dispose()
})
