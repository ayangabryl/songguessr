import { NOOT_TAILORED } from '../../../shared/noot-profile.ts'
import * as THREE from 'three'
import { spring } from './motion.ts'
import type { NootState } from './types.ts'
import { createHeadphoneClearance } from './headphone-clearance.ts'

/** Bounded secondary dynamics and body clearance, evaluated after authored posing. */
export function createSoftAccessories(character: THREE.Object3D) {
  const clearance = createHeadphoneClearance(character)
  const wardrobe: THREE.Mesh[] = [], foam: THREE.Mesh[] = []
  character.traverse(o => { if (o instanceof THREE.Mesh) { if (o.userData.wardrobe) wardrobe.push(o); if (o.name.startsWith('Noot_Cushion_')) { o.geometry.computeBoundingBox(); foam.push(o) } } })
  const hands = ['L','R'].map(s => character.getObjectByName('hand_'+s) as THREE.Bone)
  const forearms = ['L','R'].map(s => character.getObjectByName('forearm_'+s) as THREE.Bone)
  const armBase = forearms.map(b => b.quaternion.clone())
  const chest = character.getObjectByName('chest')!
  const chestRest = chest.position.clone()
  const head = character.getObjectByName('head')!
  const previous = new THREE.Quaternion(), current = new THREE.Quaternion()
  const flutter = spring(0, 2.7, .7), cushions = foam.map(() => spring(0, 5.2, .9))
  const position = new THREE.Vector3(), target = new THREE.Vector3(), pivot = new THREE.Vector3(), direction = new THREE.Vector3(), desired = new THREE.Vector3()
  const correction = new THREE.Quaternion(), cup = new THREE.Vector3(), hand = new THREE.Vector3()
  let initialized = false, lastSpeed = 0
  function restore() { forearms.forEach((bone, i) => bone.quaternion.copy(armBase[i])) }
  function update(dt: number, state: NootState, reduced: boolean) {
    forearms.forEach((bone, i) => armBase[i].copy(bone.quaternion))
    wardrobe.forEach(mesh => { mesh.visible = mesh.userData.wardrobe === state.clothing || mesh.userData.wardrobe === state.headgear })
    character.updateMatrixWorld(true)
    head.getWorldQuaternion(current)
    const turn = initialized && dt > 0 ? Math.min(5, current.angleTo(previous) / dt) : 0
    const speed = state.travelSpeed ?? 0
    const acceleration = initialized && dt > 0 ? Math.min(5, Math.abs(speed-lastSpeed)/dt) : 0
    previous.copy(current); lastSpeed = speed; initialized = true
    const amount = reduced ? flutter.reset(0) : flutter.step(THREE.MathUtils.clamp(turn*.22+acceleration*.08, 0, 1), Math.min(dt,.1))
    for (const mesh of wardrobe) {
      const i = mesh.morphTargetDictionary?.Flutter
      if (i !== undefined) mesh.morphTargetInfluences![i] = THREE.MathUtils.clamp(amount,0,1)
    }
    // Soft front garments sit on the torso. Resolve a hand that enters the fitted
    // chest envelope with a small forearm correction; retain the authored shoulder.
    if (!reduced && ['shirt','bandana','scarf',...NOOT_TAILORED].includes(state.clothing ?? '')) {
      for (let i=0; i<hands.length; i++) for (let pass=0; pass<2; pass++) {
        hands[i].getWorldPosition(position); character.worldToLocal(position)
        const height = position.y - (chest.position.y - chestRest.y)
        if (height < .65 || height > 1.67 || position.z < .08) break
        const radius = height < 1 ? .99 : 1.01 - (height-1)*.09
        const envelope = (position.x/radius)**2 + (position.z/(radius*.84))**2
        if (envelope >= 1.05) break
        target.copy(position)
        const factor = Math.sqrt(1.065 / Math.max(.1,envelope))
        target.x *= factor; target.z *= factor
        // Corrections are bounded to avoid a joint pop when another clip interrupts.
        target.sub(position).clampLength(0,.085).add(position)
        character.localToWorld(target); forearms[i].getWorldPosition(pivot); hands[i].getWorldPosition(position)
        const parent = forearms[i].parent!
        parent.worldToLocal(target); parent.worldToLocal(position); parent.worldToLocal(pivot)
        direction.copy(position).sub(pivot).normalize(); desired.copy(target).sub(pivot).normalize()
        correction.setFromUnitVectors(direction,desired)
        forearms[i].quaternion.premultiply(correction)
        character.updateMatrixWorld(true)
      }
    }
    const contacts = ['headphones', 'cat-earphones'].includes(state.headgear ?? 'headphones') ? clearance.update() : undefined
    foam.forEach((mesh,i) => {
      // The pad geometry uses character-space coordinates and a shared head bone.
      mesh.geometry.boundingBox!.getCenter(cup)
      if (mesh instanceof THREE.SkinnedMesh) { mesh.skeleton.update(); mesh.applyBoneTransform(0,cup) }
      mesh.localToWorld(cup)
      let proximity = 0
      for (const bone of hands) { bone.getWorldPosition(hand); proximity = Math.max(proximity,1-hand.distanceTo(cup)/.43) }
      const contact = contacts?.[mesh.name.endsWith('_L') ? 0 : 1] ?? 0
      const pressure = reduced ? cushions[i].reset(0) : cushions[i].step(THREE.MathUtils.clamp(Math.max(proximity*1.35, contact*.22),0,1),Math.min(dt,.1))
      const index = mesh.morphTargetDictionary?.Squish
      if (index !== undefined) mesh.morphTargetInfluences![index] = THREE.MathUtils.clamp(pressure,0,1)
    })
    return amount
  }
  return { wardrobe, restore, update }
}
