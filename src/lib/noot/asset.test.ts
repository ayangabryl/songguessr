import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { createRequire } from 'node:module'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { createNootFromAsset, clipForState } from './asset.ts'
import { loadFashionData } from './fashion.ts'
await loadFashionData()
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

// Check the skinned arm vertices against the actual convex cup surfaces, not
// the runtime's simpler safety volumes, so this catches bad proxy assumptions.
test('raised arms clear earcup surfaces through gestures and interruptions', () => {
  const reference = createNootFromAsset(gltf, 'cup-reference')
  reference.root.updateMatrixWorld(true)
  const head = reference.root.getObjectByName('head')!
  const point = new THREE.Vector3()
  const volumes = ['L', 'R'].flatMap(side => ['Cushion', 'Shell', 'SilverRim', 'Plate'].map(part => {
    const mesh = reference.root.getObjectByName(`Noot_${part}_${side}`) as THREE.SkinnedMesh
    mesh.skeleton.update()
    const vertices = Array.from({ length: mesh.geometry.attributes.position.count }, (_, i) => {
      mesh.getVertexPosition(i, point).applyMatrix4(mesh.matrixWorld)
      return head.worldToLocal(point).clone()
    })
    const box = new THREE.Box3().setFromPoints(vertices), center = box.getCenter(new THREE.Vector3())
    const planes: THREE.Plane[] = [], indices = mesh.geometry.index!
    for (let i = 0; i < indices.count; i += 3) {
      const plane = new THREE.Plane().setFromCoplanarPoints(vertices[indices.getX(i)], vertices[indices.getX(i+1)], vertices[indices.getX(i+2)])
      if (plane.normal.lengthSq() < .5) continue
      if (plane.distanceToPoint(center) > 0) plane.negate()
      planes.push(plane)
    }
    return { box, planes, name: mesh.name }
  }))
  reference.dispose()
  const poses = ['idle', 'high-five', 'hover', 'wave-small', 'stretch', 'cheer', 'win', 'listen-close'] as const
  for (const headgear of ['headphones', 'cat-earphones'] as const) {
    const model = createNootFromAsset(gltf, 'cup-contact-'+headgear)
    const head = model.root.getObjectByName('head')!
    const arms = ['L','R'].map(side => model.root.getObjectByName('Noot_Arm_'+side) as THREE.SkinnedMesh)
    for (let frame = 0; frame < poses.length * 90; frame++) {
      const pose = poses[Math.floor(frame / 90)]
      model.update(frame/30, 1/30, { ...state, pose, headgear, directed:true }, pointer, false)
      model.root.updateMatrixWorld(true); arms[0].skeleton.update()
      for (const arm of arms) for (let i = 0; i < arm.geometry.attributes.position.count; i += 2) {
        arm.getVertexPosition(i, point).applyMatrix4(arm.matrixWorld); head.worldToLocal(point)
        for (const volume of volumes) {
          if (!volume.box.containsPoint(point)) continue
          assert(!volume.planes.every(plane => plane.distanceToPoint(point) < -.003), `${headgear} ${pose} frame ${frame}: arm inside ${volume.name}`)
        }
      }
    }
    model.dispose()
  }
})

test('Blender fashion binds to the existing rig, shares immutable buffers, and keeps player colors independent', () => {
  const a = createNootFromAsset(gltf, 'fashion-a'), b = createNootFromAsset(gltf, 'fashion-b')
  const outfit = {...state,clothing:'varsity',footwear:'sneakers',accessoryColor:'forest',headgear:'bucket',headColor:'yellow',shoeColor:'ivory',paused:true} as NootState
  a.update(0,0,outfit,pointer,false); b.update(0,0,{...outfit,accessoryColor:'rose'},pointer,false)
  const mesh = a.root.getObjectByName('Noot_Fashion_varsity_base') as THREE.SkinnedMesh
  const other = b.root.getObjectByName(mesh.name) as THREE.SkinnedMesh
  assert.equal(mesh.geometry, other.geometry); assert.notEqual(mesh.skeleton,other.skeleton); assert.notEqual(mesh.material,other.material)
  assert.notEqual((mesh.material as THREE.MeshStandardMaterial).color.getHex(),(other.material as THREE.MeshStandardMaterial).color.getHex())
  const skeletons = new Set<THREE.Skeleton>()
  let visibleTriangles = 0, visibleDraws = 0
  a.root.updateMatrixWorld(true)
  a.root.traverse(o => {
    if (o instanceof THREE.SkinnedMesh) skeletons.add(o.skeleton)
    if (!(o instanceof THREE.SkinnedMesh) || !o.userData.fashion) return
    const weight = o.geometry.getAttribute('skinWeight'), indices=o.geometry.getAttribute('skinIndex')
    for (let i=0;i<weight.count;i++) {
      const total=weight.getX(i)+weight.getY(i)+weight.getZ(i)+weight.getW(i)
      assert(Math.abs(total-1)<1e-5,`${o.name} has an unbound vertex`)
      for(const k of [indices.getX(i),indices.getY(i),indices.getZ(i),indices.getW(i)]) assert(k<o.skeleton.bones.length)
    }
    if(o.visible){visibleTriangles+=o.geometry.index!.count/3;visibleDraws++}
  })
  assert.equal(skeletons.size,1); assert(visibleDraws<=5); assert(visibleTriangles<15000)
  const shoes=a.root.getObjectByName('Noot_Fashion_sneakers_base') as THREE.SkinnedMesh
  assert(shoes.visible); assert.equal((shoes.material as THREE.MeshStandardMaterial).color.getHexString(),'e9dfc9')
  a.dispose()
  b.update(.1,.1,{...outfit,clothing:'overalls',footwear:'boots'},pointer,false)
  assert(b.root.getObjectByName('Noot_Fashion_overalls_base')!.visible)
  assert(!b.root.getObjectByName('Noot_Fashion_varsity_base')!.visible)
  b.dispose()
})

test('fashion follows animated feet and arms without rewriting shared geometry', () => {
  const model = createNootFromAsset(gltf, 'fashion-motion')
  const s: NootState = {...state,clothing:'cardigan',footwear:'boots'}
  model.update(0,0,s,pointer,false)
  const mesh=model.root.getObjectByName('Noot_Fashion_cardigan_base') as THREE.SkinnedMesh
  const positions=mesh.geometry.getAttribute('position'), revision=positions.version
  const shoe=model.root.getObjectByName('Noot_Fashion_boots_base') as THREE.SkinnedMesh
  const foot=model.root.getObjectByName('foot_L') as THREE.Bone
  model.root.updateMatrixWorld(true); shoe.skeleton.update()
  const before=new THREE.Vector3().fromBufferAttribute(shoe.geometry.getAttribute('position'),0)
  const after=before.clone(); shoe.applyBoneTransform(0,before)
  foot.position.y+=.4; model.root.updateMatrixWorld(true); shoe.skeleton.update();shoe.applyBoneTransform(0,after)
  assert(Math.abs(after.y-before.y-.4)<1e-5,'shoe follows its foot, not the head or chest')
  for(const pose of ['walk','high-five','groove','jump'] as const) {
    for(let i=0;i<30;i++) model.update(i/30,1/30,{...s,pose,eventId:3,directed:true},pointer,false)
    model.root.updateMatrixWorld(true);mesh.skeleton.update()
    for(let i=0;i<positions.count;i+=31) {
      const vertex=new THREE.Vector3().fromBufferAttribute(positions,i);mesh.applyBoneTransform(i,vertex)
      assert([...vertex].every(Number.isFinite));assert(vertex.length()<6)
    }
  }
  assert.equal(positions.version,revision,'no recurring CPU vertex upload')
  model.dispose()
})

test('every expanded outfit stays within the crowd budget and replaces the previous look', () => {
  const model=createNootFromAsset(gltf,'expanded-fashion')
  for(const clothing of ['dress','ballet','suit','hoodie','tracksuit','raincoat'] as const) {
    model.update(0,0,{...state,clothing,footwear:'high-tops',trimColor:'#123456'},pointer,false)
    let draws=0,triangles=0
    model.root.traverse(o=>{
      if(!(o instanceof THREE.SkinnedMesh)||!o.userData.fashion||!o.visible)return
      assert([clothing,'high-tops'].includes(o.userData.fashion),'previous outfit remains visible')
      draws++;triangles+=o.geometry.index!.count/3
      const weights=o.geometry.getAttribute('skinWeight')
      for(let i=0;i<weights.count;i++)assert(Math.abs(weights.getX(i)+weights.getY(i)+weights.getZ(i)+weights.getW(i)-1)<1e-5)
    })
    assert(draws>0&&draws<=7,`${clothing}: ${draws} draws`)
    assert(triangles<=16000,`${clothing}: ${triangles} triangles`)
  }
  model.dispose()
})

test('clothing details change independently of fabric, soles and other players',()=>{
  const a=createNootFromAsset(gltf,'trim-a'),b=createNootFromAsset(gltf,'trim-b')
  const input: NootState={...state,clothing:'suit',footwear:'mary-janes',accessoryColor:'navy',trimColor:'#112233',shoeColor:'rose'}
  a.update(0,0,input,pointer,false);b.update(0,0,input,pointer,false)
  const color=(model:typeof a,name:string)=>((model.root.getObjectByName(name) as THREE.Mesh).material as THREE.MeshStandardMaterial).color.getHexString()
  const fabric=color(a,'Noot_Fashion_suit_base'),sole=color(a,'Noot_Fashion_mary-janes_trim')
  a.update(1,0,{...input,trimColor:'#fedcba'},pointer,false)
  assert.equal(color(a,'Noot_Fashion_suit_trim'),'fedcba')
  assert.equal(color(b,'Noot_Fashion_suit_trim'),'112233')
  assert.equal(color(a,'Noot_Fashion_suit_base'),fabric)
  assert.equal(color(a,'Noot_Fashion_mary-janes_trim'),sole)
  a.dispose();b.dispose()
})

test('dress hems sway below the waist, freeze on pause and use immutable GPU buffers',()=>{
  for(const clothing of ['dress','ballet'] as const){
    const model=createNootFromAsset(gltf,'hem-'+clothing)
    const input: NootState={...state,clothing,pose:'groove',directed:true}
    model.update(.5,.016,input,pointer,false)
    const mesh=model.root.getObjectByName(`Noot_Fashion_${clothing}_base`) as THREE.SkinnedMesh
    const positions=mesh.geometry.getAttribute('position'),morph=mesh.geometry.morphAttributes.position[0]
    const version=positions.version,morphVersion=morph.version
    for(let i=0;i<positions.count;i++){
      if(positions.getY(i)>=1.10) assert.equal(Math.abs(morph.getX(i))+Math.abs(morph.getY(i))+Math.abs(morph.getZ(i)),0)
      assert(positions.getY(i)-Math.abs(morph.getY(i))>.3,'hem must clear the resting feet')
      assert(Math.abs(morph.getX(i))<.05,'bounded cloth motion')
    }
    const before=mesh.morphTargetInfluences![0];assert(Math.abs(before)>.1)
    model.update(2,0,{...input,paused:true},pointer,false)
    assert.equal(mesh.morphTargetInfluences![0],before)
    model.update(3,.016,input,pointer,true);assert.equal(mesh.morphTargetInfluences![0],0)
    for(let i=0;i<90;i++)model.update(i/30,1/30,input,pointer,false)
    assert.equal(positions.version,version);assert.equal(morph.version,morphVersion)
    model.dispose()
  }
})
