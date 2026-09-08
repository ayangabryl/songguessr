import * as THREE from 'three'
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import { MASCOT_PALETTES } from '../mascot.ts'
import { createHeadgear } from './headgear.ts'
import { createSoftAccessories } from './soft-accessories.ts'
import { createWearables, styleFabric } from './wearables.ts'
import { smooth } from './motion.ts'
import { createCharacterMind, closingCrease, outfitGestures } from './character-mind.ts'
import { frontSurface } from './geometry.ts'
import { DANCE_CLIPS, danceFor } from './dance-library.ts'
import type { NootState } from './types.ts'

export const NOOT_ASSET_URL = '/mascot/noot.glb?v=20260908-bold-dances-2'
let template: Promise<GLTF> | undefined

/** One immutable download; every mounted Noot owns its skeleton, mixer and materials. */
export function loadNootAsset() {
  template ??= new GLTFLoader().loadAsync(NOOT_ASSET_URL).catch(error => {
    template = undefined
    throw error
  })
  return template
}

export function clipForState(state: NootState) {
  if (state.pose === 'outfit') { const gestures = outfitGestures(state); return gestures[(state.eventId ?? 0) % gestures.length]?.clip ?? 'WaveSmall' }
  if (state.pose === 'play') return { chill: 'Idle', happy: 'Happy', sad: 'Sad', dance: 'Dance' }[state.mood ?? 'chill']
  const clips = {
    groove: 'Groove', 'body-roll': 'BodyRoll', charleston: 'Charleston', 'hip-sway': 'HipSway', 'victory-dance': 'VictoryPump', 'friendly-wave': 'FriendlyWave',
    idle: 'Idle', walk: 'Walk', run: 'Run', skip: 'Run', dance: 'Dance',
    'happy-song': 'Happy', 'sad-song': 'Sad', sleepy: 'Sleepy',
    hover: 'Wave', tap: 'Pet', win: 'Celebrate', streak: 'Streak',
    lose: 'Lose', timeout: 'Lose', switch: 'Switch',
    'listen-close': 'Listen', shrug: 'Shrug', cheer: 'Cheer',
    'look-around': 'LookAround', stretch: 'Stretch', yawn: 'Yawn', 'wave-small': 'WaveSmall',
    'high-five': 'HighFive', boop: 'Boop', laugh: 'Laugh', angry: 'Angry',
    startled: 'Startled', tumble: 'Tumble', sit: 'Sit', 'get-up': 'GetUp', catch: 'Catch', samba: 'Samba', jump: 'Jump',
  }
  return clips[state.pose]
}

const loops = new Set<string>([...DANCE_CLIPS, 'Idle', 'Walk', 'WalkSoft', 'Run', 'Dance', 'DanceB', 'Samba', 'Happy', 'Sad', 'Listen', 'Sleepy'])
let instance = 0

/** Plays the authored Blender clips; runtime only adds gaze, palettes and game travel. */
export function createNootFromAsset(gltf: GLTF, identity = `noot-${++instance}`) {
  const root = new THREE.Group()
  root.name = 'Noot'
  const character = clone(gltf.scene)
  root.add(character)
  const materials = new Map<THREE.Material, THREE.Material>()
  const headphones: THREE.Object3D[] = []
  const pawDetails: THREE.Object3D[] = []
  const paintedCheeks: THREE.BufferGeometry[] = []
  const eyeMaps: THREE.Texture[] = []
  const mind = createCharacterMind(identity)
  let sharedSkeleton: THREE.Skeleton | undefined
  character.traverse(object => {
    if (/^Noot_(HandBean|HandPalm|SoleBean|SolePalm)/.test(object.name)) pawDetails.push(object)
    if (object.userData.headgear === 'headphones') headphones.push(object)
    if (object instanceof THREE.Mesh) {
      const copy = (m: THREE.Material) => {
        if (!materials.has(m)) materials.set(m, m.clone())
        return materials.get(m)!
      }
      object.material = Array.isArray(object.material) ? object.material.map(copy) : copy(object.material)
      if (object.userData.gaze_uv) {
        const material = object.material as THREE.MeshStandardMaterial
        if (material.map) {
          material.map = material.map.clone()
          material.map.needsUpdate = true
          eyeMaps.push(material.map)
        }
      }
      // Small eyelid morphs and arm gestures must not reuse a rest-pose culling bound.
      object.frustumCulled = false
      if (object.name.startsWith('Noot_Cheek_')) {
        object.geometry = object.geometry.clone()
        // Keep feathered alpha in the mesh; palette tint is a material uniform.
        // A settled palette must not rewrite/upload cheek vertices every frame.
        const colors = object.geometry.getAttribute('color')
        for (let i = 0; i < colors.count; i++) colors.setXYZ(i, 1, 1, 1)
        colors.needsUpdate = true
        paintedCheeks.push(object.geometry)
      }
    }
    if (object instanceof THREE.SkinnedMesh) {
      // SkeletonUtils copies a skeleton per mesh; this asset shares one armature.
      if (!sharedSkeleton) sharedSkeleton = object.skeleton
      else if (object.skeleton !== sharedSkeleton && object.skeleton.bones.every((b, i) => b === sharedSkeleton!.bones[i])) {
        object.skeleton.dispose()
        object.skeleton = sharedSkeleton
      }
    }
  })
  const head = character.getObjectByName('head') as THREE.Bone
  if (!head) throw new Error('Noot GLB is missing the head bone')
  // Existing wardrobe geometry is in Three.js world units. A dedicated anchor
  // cancels the imported bone's rest translation without affecting its animation.
  const wardrobeAnchor = new THREE.Bone()
  wardrobeAnchor.position.y = 1.4 - 1.7
  head.add(wardrobeAnchor)
  const gear = createHeadgear(wardrobeAnchor)
  const cat = gear.mount.getObjectByName('cat-earphones')!
  // Keep only kitten decorations; all headphone bodies use the Blender asset.
  for (const child of cat.children) {
    if (!(child instanceof THREE.Mesh && child.geometry.type === 'ExtrudeGeometry')) child.visible = false
  }
  const wearables = createWearables(wardrobeAnchor, (x, y) => frontSurface(x, y) * .84 / .72)
  const soft = createSoftAccessories(character)
  const mixer = new THREE.AnimationMixer(character)
  const clips = new Map(gltf.animations.map(clip => [clip.name, clip]))
  // Most Noots use only a few clips. Bind actions when played, not all 43 at mount.
  const actions = new Map<string, THREE.AnimationAction>()
  const gazeBones = ['gaze_L', 'gaze_R'].map(name => character.getObjectByName(name) as THREE.Bone)
  const gazeRest = gazeBones.map(b => b.position.clone())
  const blinkMeshes = ['L', 'R'].map(side => ({
    upper: character.getObjectByName('Noot_Lid_' + side) as THREE.Mesh,
    lower: character.getObjectByName('Noot_LowerLid_' + side) as THREE.Mesh,
    crease: character.getObjectByName('Noot_Lash_' + side) as THREE.Mesh,
  }))
  const tail = character.getObjectByName('tail_base') as THREE.Bone | undefined
  const tailRotation = tail?.quaternion.clone()
  const headBase = head.quaternion.clone(), tailBase = tail?.quaternion.clone()
  const facialBase = blinkMeshes.flatMap(({ upper, lower, crease }) => [upper, lower, crease].map(mesh => ({mesh, values: [...mesh.morphTargetInfluences!]})))
  const restBones = sharedSkeleton!.bones.map(bone => ({ bone, position: bone.position.clone(), quaternion: bone.quaternion.clone(), scale: bone.scale.clone() }))
  const socialArms = restBones.filter(({bone}) => /^(upper_arm|forearm|hand)_[LR]$/.test(bone.name)).map(item => ({...item,base:item.quaternion.clone()}))
  let current: THREE.AnimationAction | undefined
  let wardrobeStyle = ''
  let signature = '', started = 0, gazeX = 0, gazeY = 0
  const color = new THREE.Color()
  const materialList = [...materials.values()] as THREE.MeshStandardMaterial[]
  const fabrics = materialList.filter(m => /Noot_(Fabric|Knit)/.test(m.name)).map(material => ({material, pattern: styleFabric(material)}))
  const seams = materialList.filter(m => m.name.startsWith('Noot_Seam'))
  const paws = materialList.filter(m => m.name.startsWith('Noot_Paw'))
  const skin = materialList.find(m => m.name.startsWith('Noot_Lime'))!
  const belly = materialList.find(m => m.name.startsWith('Noot_Belly'))!
  const cheeks = materialList.find(m => m.name.startsWith('Noot_Cheeks'))!
  const cheekColor = new THREE.Color(MASCOT_PALETTES.easy.cheek)
  cheeks.color.set('#ffffff')
  cheeks.depthWrite = false
  const headphoneColors = new Map(materialList.map(m => [m, m.color.clone()]))
  const accessoryMaterials = new Set<THREE.Material>(), accessoryGeometry = new Set<THREE.BufferGeometry>()
  wardrobeAnchor.traverse(o => {
    if (o instanceof THREE.Mesh) {
      accessoryGeometry.add(o.geometry)
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) accessoryMaterials.add(m)
    }
  })

  function update(time: number, dt: number, state: NootState, pointer: THREE.Vector2, reduced: boolean) {
    // Restore authored values before evaluation: Three's mixer can skip unchanged
    // tracks, so an additive attention/blink layer must never become the new base.
    soft.restore()
    socialArms.forEach(item=>item.bone.quaternion.copy(item.base))
    head.quaternion.copy(headBase)
    if (tailBase) tail?.quaternion.copy(tailBase)
    for (const {mesh, values} of facialBase) mesh.morphTargetInfluences!.splice(0, values.length, ...values)
    const thought = mind.step(dt, state, pointer, reduced)
    const ageBeforeChange = time - started
    let name = clipForState(state)
    if (name === 'Dance') name = danceFor(identity, state.eventId ?? 0)
    if (thought.clip && clips.has(thought.clip)) name = thought.clip
    // Reactions finish, then Noot resumes breathing and looking instead of freezing.
    const requestedClip = clips.get(name)
    if (!loops.has(name) && !thought.clip && !state.directed && requestedClip && thought.actionAge > requestedClip.duration + .2) name = 'Idle'
    if (state.pose === 'skip' && (state.travelSpeed !== undefined ? Math.abs(state.travelSpeed) < .015 : ageBeforeChange > 1.2) && signature.startsWith(`skip:${state.eventId ?? 0}:`)) name = 'Idle'
    const nextSignature = `${state.pose}:${state.eventId ?? 0}:${name}:${reduced}`
    if (nextSignature !== signature) {
      const replay = !signature.startsWith(`${state.pose}:${state.eventId ?? 0}:`)
      if (replay) started = time
      signature = nextSignature
      let next = actions.get(name)
      if (!next && clips.has(name)) { next = mixer.clipAction(clips.get(name)!); actions.set(name, next) }
      if (next) {
        for (const action of actions.values()) if (action !== current && action !== next) action.stop()
        next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1)
        next.setLoop(loops.has(name) ? THREE.LoopRepeat : THREE.LoopOnce, loops.has(name) ? Infinity : 1)
        next.clampWhenFinished = !loops.has(name)
        next.play()
        if (current && current !== next && !reduced) current.crossFadeTo(next, .22, false)
        else if (current !== next) current?.stop()
        current = next
      }
    }
    if (reduced) {
      for (const action of actions.values()) if (action !== current) action.stop()
      if (current) { current.time = Math.min(.6, current.getClip().duration * .5); current.setEffectiveWeight(1); current.stopFading() }
      mixer.update(0)
      for (const { bone, position, quaternion, scale } of restBones) {
        bone.position.copy(position); bone.quaternion.copy(quaternion); bone.scale.copy(scale)
      }
    } else if (dt > 0) {
      // Match planted stride travel to the ruler's measured speed, including easing out.
      if (current) current.timeScale = state.travelSpeed !== undefined && ['Run', 'Walk', 'WalkSoft'].includes(name)
        ? THREE.MathUtils.clamp(Math.abs(state.travelSpeed) / (name === 'Run' ? 2 * .23 / .8 : 2 * .155 / 1.2), .2, 2.4)
        : (DANCE_CLIPS as readonly string[]).includes(name) ? 1 : loops.has(name) && name !== 'Walk' && name !== 'Run' ? thought.cadence : 1
      // A shared clock keeps different dance lengths on the same beat. Pausing
      // holds the director clock and mixer; there is no accumulated root travel.
      if (current && state.danceTime !== undefined && (DANCE_CLIPS as readonly string[]).includes(name)) {
        const duration = current.getClip().duration
        current.time = ((state.danceTime % duration) + duration) % duration - dt
      }
      mixer.update(dt)
    }
    const blend = reduced ? 1 : 1 - Math.exp(-dt * 10)
    const age = time - started
    const moving = ['walk', 'run', 'skip'].includes(state.pose) && name !== 'Idle'
    const direction = state.travelSpeed !== undefined && Math.abs(state.travelSpeed) > .02 ? Math.sign(state.travelSpeed) : state.direction ?? 1
    const yaw = reduced || state.directed ? 0 : moving ? direction * (state.pose === 'walk' ? .4 : 1.40) : thought.lookX * .045
    root.rotation.y = THREE.MathUtils.lerp(root.rotation.y, yaw, blend)
    const travel = !reduced && !state.directed && state.pose === 'skip' && !state.onRuler ? smooth((age - .10) / 1.0) * .8 * direction : 0
    root.position.x = THREE.MathUtils.lerp(root.position.x, travel, blend)
    gazeX = THREE.MathUtils.lerp(gazeX, reduced ? 0 : thought.lookX * .027, blend)
    gazeY = THREE.MathUtils.lerp(gazeY, reduced ? 0 : thought.lookY * .023, blend)
    gazeBones.forEach((bone, i) => {
      bone.position.copy(gazeRest[i])
      bone.position.x += gazeX
      bone.position.y += gazeY
    })
    for (const map of eyeMaps) map.offset.set(-gazeX * 1.8, -gazeY * 1.7)
    const setMorph = (mesh: THREE.Mesh, key: string, value: number) => {
      const index = mesh.morphTargetDictionary?.[key]
      if (index !== undefined) mesh.morphTargetInfluences![index] = value
    }
    for (const item of facialBase) item.values = [...item.mesh.morphTargetInfluences!]
    blinkMeshes.forEach(({ upper, lower, crease }, i) => {
      const authored = upper.morphTargetInfluences?.[upper.morphTargetDictionary?.Blink ?? 0] ?? 0
      const blink = reduced ? authored : Math.max(authored, i ? thought.blinkRight : thought.blink)
      setMorph(upper, 'Blink', blink); setMorph(lower, 'Blink', blink)
      setMorph(crease, 'Close', closingCrease(blink))
    })
    headBase.copy(head.quaternion)
    if (tailBase && tail) tailBase.copy(tail.quaternion)
    if (!reduced) {
      head.rotateZ(thought.tilt)
      tail?.rotateY(thought.tail)
    } else if (reduced && tailRotation) tail?.quaternion.copy(tailRotation)
    socialArms.forEach(item => {
      item.base.copy(item.bone.quaternion)
      if (state.pose === 'high-five' && state.interactionHand && !item.bone.name.endsWith(state.interactionHand)) {
        const reach = smooth((current?.time ?? 0)/.4) * (1-smooth(((current?.time ?? 0)-1.75)/.65))
        item.bone.quaternion.slerp(item.quaternion, reach)
      }
    })
    const clothDrive = soft.update(dt, state, reduced)
    const palette = MASCOT_PALETTES[state.difficulty]
    const colorBlend = state.paused ? 1 : blend
    skin.color.lerp(color.set(palette.body), colorBlend)
    belly.color.lerp(color.set(palette.belly), colorBlend)
    paws.forEach(material => material.color.lerp(color.set(palette.belly).multiplyScalar(.86), colorBlend))
    cheekColor.lerp(color.set(palette.cheek), colorBlend)
    cheeks.color.copy(cheekColor)
    const headgear = state.headgear ?? 'headphones'
    const nextWardrobeStyle = `${headgear}:${state.accessoryColor}:${state.pattern}`
    if (wardrobeStyle !== nextWardrobeStyle) {
    wardrobeStyle = nextWardrobeStyle
    headphones.forEach(object => { object.visible = headgear === 'headphones' || headgear === 'cat-earphones' })
    for (const material of materialList) {
      if (/Noot_(Headband|Shell|Silver|Plate)/.test(material.name)) {
        material.color.copy(headgear === 'cat-earphones' ? color.set(material.name.includes('Silver') ? '#b9746c' : '#dba899') : headphoneColors.get(material)!)
      }
    }
    gear.select(['headphones','beanie','bucket'].includes(headgear) ? 'none' : headgear)
    const fabricColor = {blue:'#7893ab',rose:'#b87985',gold:'#c5a05c',mint:'#71a58e',lavender:'#9c88b6',coral:'#c77d65',navy:'#4e647c'}[state.accessoryColor ?? 'blue']
    for (const {material,pattern} of fabrics) { material.color.set(fabricColor); pattern.value=['plain','stripes','dots','gingham','confetti'].indexOf(state.pattern ?? 'plain') }
    seams.forEach(material => material.color.set(fabricColor).multiplyScalar(.78))
    }
    gear.update(dt, reduced ? 0 : Math.sin(time * 2) * .15, 0, reduced)
    wearables.update(dt, clothDrive, state.clothing === 'bandana' && soft.wardrobe.length ? {...state,clothing:'none'} : state, reduced)
  }
  function dispose() {
    mixer.stopAllAction()
    mixer.uncacheRoot(character)
    const skeletons = new Set<THREE.Skeleton>()
    character.traverse(o => { if (o instanceof THREE.SkinnedMesh) skeletons.add(o.skeleton) })
    skeletons.forEach(s => s.dispose())
    materials.forEach(m => m.dispose())
    accessoryGeometry.forEach(g => g.dispose())
    accessoryMaterials.forEach(m => m.dispose())
    paintedCheeks.forEach(geometry => geometry.dispose())
    eyeMaps.forEach(map => map.dispose())
  }
  return { root, update, dispose,
    // Tiny paw pads do not read in a crowded stage; retain the full arm/foot mesh.
    setCompact(compact: boolean) { pawDetails.forEach(object => { object.visible = !compact }) },
    get elevation() { return Math.max(0, sharedSkeleton!.bones[0].position.y) } }
}
