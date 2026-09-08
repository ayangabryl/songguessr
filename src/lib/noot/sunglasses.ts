import * as THREE from 'three'
import data from './sunglasses-data.ts'
import type { NootState } from './types.ts'

function decode(encoded: string, indices = false) {
  const bytes = Uint8Array.from(atob(encoded), c => c.charCodeAt(0)), view = new DataView(bytes.buffer)
  const values = indices ? new Uint16Array(bytes.length / 2) : new Float32Array(bytes.length / 2)
  for (let i = 0; i < values.length; i++) values[i] = indices ? view.getUint16(i * 2, true) : view.getInt16(i * 2, true) / 10000
  return new THREE.BufferAttribute(values, indices ? 1 : 3)
}
const templates = Object.fromEntries(Object.entries(data).map(([name, source]) => {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', decode(source.position)); geometry.setAttribute('normal', decode(source.normal)); geometry.setIndex(decode(source.index, true))
  if ('fit' in source) {
    geometry.morphTargetsRelative = true
    geometry.morphAttributes.position = [decode(source.fit)]
    geometry.morphAttributes.position[0].name = 'HeadphonesFit'
  }
  return [name, geometry]
}))

export function createSunglasses() {
  const root = new THREE.Group(); root.name = 'sunglasses'
  const acetate = new THREE.MeshPhysicalMaterial({color:'#293431',roughness:.26,clearcoat:.5,clearcoatRoughness:.22})
  // Opaque smoked lenses give reliable depth and reflections without transparency
  // sorting against eyelids or expensive screen-space transmission in a crowd.
  const glass = new THREE.MeshPhysicalMaterial({color:'#172f32',roughness:.14,metalness:.1,clearcoat:1,clearcoatRoughness:.08,envMapIntensity:1.15})
  for (const [name, geometry] of Object.entries(templates)) {
    const mesh = new THREE.Mesh(geometry.clone(), name === 'lenses' ? glass : acetate)
    mesh.name = `Noot_Sunglasses_${name}`; root.add(mesh)
  }
  const temples = root.getObjectByName('Noot_Sunglasses_temples') as THREE.Mesh
  return {
    root,
    tint(color: string) { acetate.color.set(color) },
    fit(headgear: NootState['headgear']) {
      temples.morphTargetInfluences![0] = headgear === 'headphones' || headgear === 'cat-earphones' ? 1 : 0
    },
  }
}
