import * as THREE from 'three'
import type { NootHeadgear } from './types.ts'
import { spring } from './motion.ts'
import { HEAD_Y } from './geometry.ts'

export function createHeadgear(head: THREE.Bone) {
  const mount = new THREE.Group(); mount.name = 'accessory-mount'; mount.position.y = -HEAD_Y; head.add(mount)
  const groups = {} as Record<NootHeadgear, THREE.Group>
  const joints: {object: THREE.Object3D; side: number; kind: 'cup'|'decoration'; rest: number; spring: ReturnType<typeof spring>}[] = []
  const sway = spring(0,3,.8)
  const sphere = new THREE.SphereGeometry(1, 32, 24)
  const material = (color: string, roughness = .65, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness })
  const charcoal = material('#414746'), cream = material('#dadcd7'), metal = material('#a2a8aa', .42, .42)
  const peach = material('#dba899'), blush = material('#b9746c'), warmWhite = material('#f0e4c5'), yellow = material('#dba947')
  function ellipsoid(parent: THREE.Object3D, mat: THREE.Material, position: number[], scale: number[]) {
    const mesh = new THREE.Mesh(sphere, mat)
    mesh.position.set(position[0], position[1], position[2]); mesh.scale.set(scale[0], scale[1], scale[2]); parent.add(mesh)
    return mesh
  }
  for (const id of ['headphones', 'cat-earphones', 'daisy', 'none'] as const) {
    const group = new THREE.Group(); group.name = id; mount.add(group); groups[id] = group
    if (id === 'none') continue
    if (id === 'daisy') {
      const flower = new THREE.Group(); flower.position.set(-.61, 2.57, .17); flower.rotation.z = -.28; group.add(flower)
      for (let i = 0; i < 7; i++) {
        const angle = i / 7 * Math.PI * 2
        const petal = ellipsoid(flower, warmWhite, [Math.cos(angle) * .105, Math.sin(angle) * .105, 0], [.095, .051, .034]); petal.rotation.z = angle
      }
      ellipsoid(flower, yellow, [0, 0, .027], [.064, .064, .032])
      joints.push({object:flower,side:-1,kind:'decoration',rest:-.28,spring:spring(0,3.2,.6)})
      continue
    }
    // One continuous load path: padded bridge, telescoping rails, hinges, cups.
    const points = Array.from({length:40},(_,i)=>{
      const a = Math.PI*(.16+i/39*.68)
      return new THREE.Vector3(Math.cos(a)*1.20,1.97+Math.sin(a)*1.25,-.25)
    })
    const bandMaterial = id === 'headphones' ? charcoal : peach
    const band = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 80, .085, 16, false), bandMaterial)
    band.name = 'separate-padded-bridge'; group.add(band)
    // TubeGeometry leaves its ends open. Rounded end housings close both rims
    // and enclose the top of each adjustable rail, even in profile.
    for (const endpoint of [points[0], points[points.length-1]]) {
      const cap = ellipsoid(group, bandMaterial, endpoint.toArray(), [.086,.086,.086])
      cap.name = 'closed-band-end'
    }
    function link(a: THREE.Vector3, b: THREE.Vector3, radius: number, mat: THREE.Material) {
      const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, a.distanceTo(b), 6, 12), mat)
      mesh.position.copy(a).add(b).multiplyScalar(.5)
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize())
      group.add(mesh)
    }
    for (const side of [-1, 1]) {
      link(new THREE.Vector3(side*1.052,2.572,-.25),new THREE.Vector3(side*1.075,2.25,-.015),.031,metal)
      // The hinge overlaps both rail and shell. The soft pad nests into the cheek.
      ellipsoid(group, metal, [side*1.075,2.25,-.015],[.062,.066,.065])
      const cup = new THREE.Group(); cup.name = `earcup-hinge-${side}`
      cup.position.set(side*1.075,2.25,-.015); group.add(cup)
      ellipsoid(cup, cream, [side*(.89-1.075),-.235,.015], [.145,.405,.29])
      ellipsoid(cup, bandMaterial, [side*(1.015-1.075),-.235,.015], [.125,.35,.26])
      ellipsoid(cup, id === 'headphones' ? metal : blush, [side*(1.105-1.075),-.235,.015], [.065,.285,.215])
      joints.push({object:cup,side,kind:'cup',rest:0,spring:spring(0,4,.75)})
      if (id === 'cat-earphones') {
        const shape = new THREE.Shape()
        shape.moveTo(-.15, 0); shape.quadraticCurveTo(-.16, .1, -.09, .32); shape.quadraticCurveTo(-.06, .38, .01, .29); shape.lineTo(.17, .04); shape.quadraticCurveTo(.02, -.02, -.15, 0)
        const ear = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth:.06, bevelEnabled:true, bevelSegments:3, steps:1, bevelSize:.035, bevelThickness:.025, curveSegments:16 }), peach)
        ear.position.set(side * .68, 2.91, -.25); ear.rotation.z = side * -.35; group.add(ear)
        joints.push({object:ear,side,kind:'decoration',rest:side*-.35,spring:spring(0,3.5,.58)})
        const inner = ellipsoid(ear, blush, [-.025, .145, .093], [.055, .095, .01]); inner.rotation.z = .16
      }
    }
  }
  function select(id: NootHeadgear) { for (const [name, group] of Object.entries(groups)) group.visible = name === id }
  select('headphones')
  function update(dt: number, drive: number, contact: number, reduced: boolean) {
    mount.rotation.z = reduced ? sway.reset(0) : sway.step(THREE.MathUtils.clamp(drive*.018,-.018,.018),dt)
    for(const joint of joints) {
      const target = joint.kind==='cup'
        ? THREE.MathUtils.clamp(drive*.025 + (joint.side<0 ? contact*.055 : 0),-.04,.065)
        : THREE.MathUtils.clamp(-drive*.085,-.10,.10)
      const angle = reduced ? joint.spring.reset(0) : joint.spring.step(target,dt)
      if(joint.kind==='cup') joint.object.rotation.x=angle
      else joint.object.rotation.z=joint.rest+angle
    }
  }
  return { mount, select, update }
}
