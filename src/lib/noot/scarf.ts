import * as THREE from 'three'
import data from './scarf-data.ts'

// Compact quantized Blender data adds no asset request or cloth simulation.
function decode(encoded: string, indices = false) {
  const bytes = Uint8Array.from(atob(encoded), c => c.charCodeAt(0))
  const view = new DataView(bytes.buffer)
  const values = indices ? new Uint16Array(bytes.length / 2) : new Float32Array(bytes.length / 2)
  for (let i = 0; i < values.length; i++) values[i] = indices ? view.getUint16(i * 2, true) : view.getInt16(i * 2, true) / 10000
  return new THREE.BufferAttribute(values, indices ? 1 : 3)
}
const template = new THREE.BufferGeometry()
template.setAttribute('position', decode(data.position))
template.setAttribute('normal', decode(data.normal))
template.setIndex(decode(data.index, true))
template.morphTargetsRelative = true
template.morphAttributes.position = [decode(data.flutter)]
template.morphAttributes.position[0].name = 'Flutter'

export function createScarf(fabric: THREE.Material) {
  const mesh = new THREE.Mesh(template.clone(), fabric)
  mesh.name = 'Noot_DrapedScarf'
  return mesh
}
