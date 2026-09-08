import * as THREE from 'three'

/** Kinematic contact, in the moving head's space. No rigid-body simulation or
 * per-frame mesh scans: a few arm samples sweep around fitted earcup volumes. */
export function createHeadphoneClearance(character: THREE.Object3D) {
  const arms = ['L', 'R'].map(side => ({
    shoulder: character.getObjectByName('upper_arm_' + side) as THREE.Bone,
    elbow: character.getObjectByName('forearm_' + side) as THREE.Bone,
    hand: character.getObjectByName('hand_' + side) as THREE.Bone,
    sign: side === 'L' ? -1 : 1,
  }))
  const start = new THREE.Vector3(), end = new THREE.Vector3(), point = new THREE.Vector3(), palm = new THREE.Vector3()
  const target = new THREE.Vector3(), from = new THREE.Vector3(), to = new THREE.Vector3()
  const rotation = new THREE.Quaternion()
  const contacts = [0, 0]
  // The pad, shell and rim form an elliptical cylinder. The margin includes
  // palm thickness, so a wrist outside the cup cannot leave fingers inside it.
  function project(p: THREE.Vector3, radius: number, sign: number) {
    const x = p.x * sign
    if (x < .775 - radius || x > 1.25 + radius) return false
    const y = (p.y - .315) / (.418 + radius)
    if (Math.abs(y) >= 1) return false
    const front = Math.sqrt(1 - y * y) * (.335 + radius)
    if (Math.abs(p.z) >= front) return false
    p.z = front + .012
    return true
  }
  function turn(joint: THREE.Bone, sample: THREE.Vector3, goal: THREE.Vector3) {
    // Upper arms are direct children of head: solve locally, avoiding repeated
    // scene-matrix walks for every sample on every character.
    from.copy(sample).sub(joint.position).normalize(); to.copy(goal).sub(joint.position).normalize()
    rotation.setFromUnitVectors(from, to)
    joint.quaternion.premultiply(rotation)
  }

  function update() {
    contacts.fill(0)
    for (let index = 0; index < arms.length; index++) {
      const arm = arms[index]
      // The original shoulder cap starts inside the bottom of the pad even at
      // rest. Seat it just below the cup before resolving the moving limb.
      arm.shoulder.position.y -= .10
      palm.set(0, -.13, 0).multiply(arm.hand.scale).applyQuaternion(arm.hand.quaternion).add(arm.hand.position)
      palm.multiply(arm.elbow.scale).applyQuaternion(arm.elbow.quaternion).add(arm.elbow.position)
      for (let pass = 0; pass < 8; pass++) {
        let contact = false
        start.copy(arm.shoulder.position)
        end.copy(arm.elbow.position).multiply(arm.shoulder.scale).applyQuaternion(arm.shoulder.quaternion).add(start)
        for (const t of [.3, .6, 1]) {
          point.lerpVectors(start, end, t); target.copy(point)
          if (project(target, t < .4 ? .075 : .12, arm.sign)) {
            contacts[index] = Math.max(contacts[index], Math.min(1, target.distanceTo(point) / .12))
            turn(arm.shoulder, point, target); contact = true; break
          }
        }
        if (contact) continue
        // Include the palm beyond the wrist, not just the joint location.
        point.copy(palm).multiply(arm.shoulder.scale).applyQuaternion(arm.shoulder.quaternion).add(start)
        target.copy(point)
        if (project(target, .155, arm.sign)) {
          contacts[index] = Math.max(contacts[index], Math.min(1, target.distanceTo(point) / .12))
          turn(arm.shoulder, point, target); contact = true
        }
        if (!contact) break
      }
      arm.shoulder.updateWorldMatrix(false, true)
    }
    return contacts
  }
  return { update }
}
