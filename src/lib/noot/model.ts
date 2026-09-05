import * as THREE from 'three'
import { MASCOT_PALETTES } from '../mascot.ts'
import { addSkinWeights, CROWN_Y, HEAD_Y, sculptBody, sculptLimb, surfaceOval } from './geometry.ts'
import { createFace } from './face.ts'
import { createHeadgear } from './headgear.ts'
import { blinkAmount, pulse, smooth, spring } from './motion.ts'
import type { NootAction, NootState } from './types.ts'

/** Noot's anatomy is independent of the accessory mount. +Z is forward. */
export function createNoot() {
  const root = new THREE.Group(); root.name = 'Noot'
  const torso = new THREE.Group(); torso.name = 'body-motion'; root.add(torso)
  const skin = new THREE.MeshPhysicalMaterial({ color: MASCOT_PALETTES.easy.body, roughness: .59, specularIntensity: .35, ior: 1.35, clearcoat: .025, clearcoatRoughness: .65 })
  const belly = new THREE.MeshStandardMaterial({ color: MASCOT_PALETTES.easy.belly, roughness: .85 })
  const body = new THREE.SkinnedMesh(sculptBody(), skin); body.name = 'continuous-body-and-note'; torso.add(body)
  const hips = new THREE.Bone(), head = new THREE.Bone(), crown = new THREE.Bone(), tip = new THREE.Bone()
  hips.name = 'hips'; head.name = 'head'; crown.name = 'note-stem'; tip.name = 'note-tip'
  head.position.y = HEAD_Y; crown.position.y = CROWN_Y - HEAD_Y
  tip.position.y = .58; crown.add(tip)
  hips.add(head); head.add(crown); body.add(hips)
  const skeleton = new THREE.Skeleton([hips, head, crown, tip]); body.bind(skeleton)
  const patch = new THREE.SkinnedMesh(addSkinWeights(surfaceOval(0, .985, .625, .565)), belly)
  patch.name = 'conforming-belly'; torso.add(patch); patch.bind(skeleton)
  const face = createFace(head, skin)
  const headgear = createHeadgear(head)
  const arms: { shoulder: THREE.Bone; wrist: THREE.Bone; skeleton: THREE.Skeleton; elbow: ReturnType<typeof spring>; pitch: ReturnType<typeof spring>; mesh: THREE.SkinnedMesh }[] = []
  const feet: THREE.Group[] = []
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Bone(), wrist = new THREE.Bone()
    shoulder.rotation.order = 'ZXY'
    shoulder.name = side < 0 ? 'left-shoulder' : 'right-shoulder'; wrist.name = 'wrist'
    wrist.position.set(side * .11, -.38, 0); shoulder.add(wrist)
    const geometry = sculptLimb('hand', side)
    const p = geometry.getAttribute('position'), indices = [], weights = []
    for (let i = 0; i < p.count; i++) {
      const w = THREE.MathUtils.smoothstep(-p.getY(i), .22, .65)
      indices.push(0,1,0,0); weights.push(1-w,w,0,0)
    }
    // Preserve the smooth SDF normals; recomputing an unindexed mesh makes every triangle flat.
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices,4)); geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4))
    const mesh = new THREE.SkinnedMesh(geometry, skin); mesh.name = 'soft-articulated-arm'
    mesh.position.set(side * .84, 1.53, -.005); mesh.add(shoulder); torso.add(mesh)
    const armSkeleton = new THREE.Skeleton([shoulder,wrist]); mesh.bind(armSkeleton)
    arms.push({ shoulder, wrist, skeleton: armSkeleton, elbow: spring(0,3), pitch: spring(0,3), mesh })
    const foot = new THREE.Group(); foot.name = side < 0 ? 'left-foot' : 'right-foot'
    foot.position.set(side * .45, .15, .075); root.add(foot)
    const boot = new THREE.Mesh(sculptLimb('foot'), skin); boot.name = 'continuous-foot'; foot.add(boot)
    feet.push(foot)
  }

  const springs = {
    x: spring(0,3), y: spring(0,4), yaw: spring(0,3), roll: spring(0,3), squash: spring(0,4),
    headRoll: spring(0,2.4), headPitch: spring(0,2.8), crown: spring(0,2.2,.48), crownPitch: spring(0,2.5,.52), tipRoll: spring(0,3,.5), tipPitch: spring(0,3.2,.5),
    leftArm: spring(0,3), rightArm: spring(0,3), stride: spring(0,3), smile: spring(1,3),
  }
  let action: NootAction = 'idle', eventId = -1, started = 0, blinkAt = -10, nextBlink = 2.5
  let nextLook = 3.2, lookX = 0, lookY = 0, gaitPhase = 0, previousHeadRoll = 0, previousArmAngle = 0
  const gaze = new THREE.Vector2(), color = new THREE.Color()
  function update(time: number, dt: number, state: NootState, pointer: THREE.Vector2, reduced: boolean) {
    if (state.pose !== action || (state.eventId ?? 0) !== eventId) { action = state.pose; eventId = state.eventId ?? 0; started = time }
    const age = time - started, direction = state.direction ?? 1
    const gesture = smooth(age/.65)
    const hasHeadphones = state.headgear==='headphones' || state.headgear==='cat-earphones' || !state.headgear
    const hold = hasHeadphones ? action==='listen-close' ? gesture : action==='play' && (state.mood??'chill')==='chill' ? pulse(age%12,1.1,4.5)*.9 : 0 : 0
    const shrug = action==='shrug' ? gesture : 0
    const cheer = action==='cheer' ? gesture : 0
    const listening = action === 'play'
    const music = listening ? state.mood ?? 'chill' : action === 'happy-song' ? 'happy' : action === 'sad-song' ? 'sad' : action === 'dance' ? 'dance' : null
    const party = music === 'dance', upbeat = music === 'happy', wistful = music === 'sad'
    const sad = action === 'lose' || action === 'timeout' || wistful
    const celebrate = action === 'win' || action === 'streak'
    const skip = action === 'skip', walk = action === 'walk', run = action === 'run'
    const skipStyle = Math.abs(eventId) % 3
    const hopping = skip && skipStyle !== 0
    const walking = walk || run || (skip && !hopping && age > .10 && age < 1.13)
    const measuredSpeed = state.travelSpeed === undefined ? undefined : Math.abs(state.travelSpeed)
    const moving = walking ? measuredSpeed === undefined ? 1 : THREE.MathUtils.smoothstep(measuredSpeed, .015, .18) : 0
    const stride = springs.stride.step(reduced ? 0 : moving, dt)
    gaitPhase += dt * (skip && state.travelSpeed !== undefined ? THREE.MathUtils.clamp(Math.abs(state.travelSpeed)*Math.PI/.26,0,60) : run || skip ? 16.8 : 9.2)
    const step = Math.sin(gaitPhase), strideLift = run || skip ? .085 : .055
    const beat = time * (party ? 8.6 : upbeat ? 6.5 : wistful ? 2.1 : 4.5)
    const sway = Math.sin(beat)
    const anticipation = pulse(age,0,.22), pet = action === 'tap' ? pulse(age,0,1.1) : 0
    const flight = (start: number, end: number, height: number) => { const t = (age-start)/(end-start); return t>0 && t<1 ? 4*height*t*(1-t) : 0 }
    const hop = hopping ? skipStyle===1 ? flight(.22,.54,.09)+flight(.73,1.05,.09) : flight(.36,.87,.16) : 0
    const landing = hopping ? pulse(age,skipStyle===1?1.05:.87,1.28) : 0
    const jump = hop + (celebrate ? pulse(age,.2,.9) * .25 + (action === 'streak' ? pulse(age,.98,1.58)*.2 : 0) : 0)
    const wave = action === 'hover' ? smooth(age/.55) * (1-smooth((age-1.75)/.65)) : 0
    const sleepy = action === 'sleepy'
    const breathe = Math.sin(time * 1.7) * .0035
    const groove = music ? (wistful ? .035 : party ? .10 : .05) : 0
    const idleShift = Math.sin(time * .64) * .009
    const travel = skip && !state.onRuler ? smooth((age-.17)/.85) * .8 * direction : 0
    const facing = state.travelSpeed !== undefined && Math.abs(state.travelSpeed)>.02 ? Math.sign(state.travelSpeed) : direction
    const yaw = walking || (hopping && age < 1.15) ? facing * (skip || run ? 1.40 : .55) : pointer.x * .075 + (music ? sway * groove : 0)
    const rootY = jump
    const roll = hold*.035 + shrug*Math.sin(time*1.8)*.012 - cheer*.055 + stride * step * .035 + sway * groove * .43 + idleShift
    const crouch = celebrate || skip || action === 'switch' ? anticipation * -.035 : 0
    const squash = crouch - landing*.055 + (hop>0 ? .018 : 0) - pet * .035 + breathe + (music && !wistful ? Math.cos(beat*2) * .012 : 0)
    if (reduced) {
      root.position.set(0,0,0); root.rotation.set(0,0,0); torso.position.y=0; torso.rotation.set(0,0,0); torso.scale.set(1,1,1)
      head.rotation.set(0,0,0); crown.rotation.set(0,0,0); tip.rotation.set(0,0,0)
    } else {
      root.position.x = springs.x.step(travel,dt)
      root.position.y = hopping ? rootY : springs.y.step(rootY,dt)
      root.rotation.y = springs.yaw.step(yaw,dt)
      torso.rotation.z = springs.roll.step(roll,dt)
      torso.rotation.x = stride * .055
      torso.position.y = stride * (Math.cos(gaitPhase*2) * -.018 + .018) + (music && !wistful ? Math.max(0,-Math.cos(beat*2))*.018 : 0)
      const s = springs.squash.step(squash,dt)
      torso.scale.set(1-s*.38,1+s,1-s*.38)
      head.rotation.z = springs.headRoll.step((sad ? .055 : hold ? -.045 : shrug ? .055 : wave ? -.055 : 0) + sway * groove * -.45 + pointer.x * -.035,dt)
      head.rotation.x = springs.headPitch.step((sad ? .08 : sleepy ? .06 : 0) - pointer.y * .035 + (music ? Math.sin(beat-.45)*.035 : 0),dt)
      const inertia = THREE.MathUtils.clamp((head.rotation.z - previousHeadRoll) / Math.max(dt,.001),-.6,.6)
      crown.rotation.z = springs.crown.step(-inertia*.24 - torso.rotation.z*.75 + stride*step*.08 + (pet ? Math.sin(age*13)*pet*.16 : 0),dt)
      crown.rotation.x = springs.crownPitch.step(stride*Math.cos(gaitPhase)*.065 + landing*.18 - hop*.16 + Math.sin(time*1.9)*.012,dt)
      tip.rotation.z = springs.tipRoll.step(crown.rotation.z*.60,dt)
      tip.rotation.x = springs.tipPitch.step(crown.rotation.x*.65,dt)
      previousHeadRoll = head.rotation.z
    }
    const armCelebrate = celebrate ? (pulse(age,.08,1.35) + (action==='streak' ? pulse(age,1.2,1.8)*.5 : 0)) * 1.5 : 0
    for(let i=0;i<2;i++) {
      const side = i===0 ? -1 : 1
      const lift = (i===0 ? hold*2.55 + cheer*2.15 : cheer*.6) + shrug*1.15 + armCelebrate + (hopping ? hop*.9 + landing*.12 : 0) + (i===1 ? wave * (1.12 + Math.sin(age*7)*.055) : 0) + (music ? party ? .50 + sway*side*.28 : wistful ? .05 : .16 + sway*side*.10 : .035)
      const target = reduced ? 0 : side * lift
      arms[i].shoulder.rotation.z = (i===0 ? springs.leftArm : springs.rightArm).step(target,dt)
      const reaching = (i === 1 ? wave : hold*1.4+cheer*1.7) + shrug*.55
      // The greeting reaches forward before lifting, clearing the removable earcup.
      arms[i].mesh.position.z = reduced ? -.005 : -.005 + reaching * .08
      arms[i].shoulder.rotation.x = reduced ? arms[i].pitch.reset(0) : arms[i].pitch.step(-reaching*.32 - step*side*stride*.24 + (music && !wistful ? Math.cos(beat)*side*.09 : 0),dt)
      arms[i].wrist.rotation.z = reduced ? arms[i].elbow.reset(0) : arms[i].elbow.step(side*(shrug*.85 + (i===0 ? hold*.10 : 0) + (wave && i===1 ? wave*Math.sin(age*7-.6)*.10 : .065)),dt)
      const phase = gaitPhase + (i===0 ? 0 : Math.PI)
      const cycle = ((phase/(Math.PI*2))%1+1)%1
      // Swing forward in the air, then move backward at constant speed in stance.
      // Each planted half-cycle covers .26 model units, matching the cadence above.
      const footTravel = cycle < .5 ? THREE.MathUtils.lerp(-.13,.13,smooth(cycle*2)) : THREE.MathUtils.lerp(.13,-.13,(cycle-.5)*2)
      const liftFoot = Math.max(0,Math.sin(phase)) * stride * strideLift
      feet[i].position.set(side*.45, .15 + (reduced ? 0 : liftFoot + (party ? Math.max(0,Math.sin(beat + i*Math.PI))*.025 : 0)), .075 + (reduced ? 0 : footTravel * stride))
      feet[i].rotation.x = reduced ? 0 : -Math.cos(phase)*stride*.12 + (party ? Math.sin(beat+side)*.06 : 0)
      feet[i].rotation.z = reduced ? 0 : (party ? Math.sin(beat)*side*.04 : 0)
    }
    if (time > nextLook && !reduced) { nextLook=time+2.4+Math.random()*3.5; lookX=(Math.random()-.5)*.12; lookY=(Math.random()-.5)*.065 }
    if (time > nextBlink && !reduced) { blinkAt=time; nextBlink=time+2.8+Math.random()*4.1 }
    const blink = reduced ? 0 : blinkAmount(time-blinkAt)
    gaze.set(reduced ? 0 : pointer.x*.16 + lookX, reduced ? 0 : pointer.y*.12 + lookY + (sad ? -.055 : 0))
    const smile = sad ? -.55 : shrug ? -.12 : pet ? 1.25 : 1
    const mouthOpen = shrug ? .72 : cheer ? 1 : celebrate ? .8 : party ? .7 : upbeat ? .35 : pet ? .45 : 0
    face.update(dt, sleepy ? Math.max(.68,blink) : blink, sad ? .25 : pet ? .55 : celebrate ? .38 : 0, smile, mouthOpen, sad ? 1 : shrug ? -.55 : 0, gaze)
    const armAngle = arms[0].shoulder.rotation.z+arms[1].shoulder.rotation.z
    const armImpulse = dt>0 ? THREE.MathUtils.clamp((armAngle-previousArmAngle)/dt,-2,2) : 0
    if(dt>0) previousArmAngle=armAngle
    const accessoryDrive = armImpulse*.22 + stride*step*.5 + (music ? sway*.35 : 0) + landing*1.2 + (wave ? Math.sin(age*7)*wave*.18 : 0) + cheer*Math.sin(age*4)*.25
    headgear.update(dt,accessoryDrive,hold,reduced)
    headgear.select(state.headgear ?? 'headphones')
    const palette = MASCOT_PALETTES[state.difficulty], t=state.paused ? 1 : 1-Math.exp(-dt*7)
    skin.color.lerp(color.set(palette.body),t); belly.color.lerp(color.set(palette.belly),t); face.pink.color.lerp(color.set(palette.cheek),t)
  }
  function dispose() {
    const geometries=new Set<THREE.BufferGeometry>(), materials=new Set<THREE.Material>()
    root.traverse(object=>{if(object instanceof THREE.Mesh){geometries.add(object.geometry);for(const mat of Array.isArray(object.material)?object.material:[object.material])materials.add(mat)}})
    geometries.forEach(g=>g.dispose()); materials.forEach(m=>m.dispose()); skeleton.dispose(); arms.forEach(a=>a.skeleton.dispose())
  }
  return { root, update, dispose }
}
