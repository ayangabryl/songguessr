import * as THREE from 'three'
type FashionData = typeof import('./fashion-data.ts')
let data: FashionData['default'] = [], fashionBones: string[] = []
let source: Promise<void> | undefined
export function loadFashionData() {
  source ??= import('./fashion-data.ts').then(module => { data = module.default; fashionBones = module.fashionBones }).catch(error => { source = undefined; throw error })
  return source
}
import { nootColorHex } from '../../../shared/noot-colors.ts'
import { styleFabric } from './wearables.ts'
import type { NootState } from './types.ts'

function decode(value: string, kind: 'position' | 'index' | 'weights' | 'joints') {
  const bytes = Uint8Array.from(atob(value), c => c.charCodeAt(0))
  if (kind === 'joints') return bytes
  const view = new DataView(bytes.buffer), out = kind === 'index' ? new Uint16Array(bytes.length / 2) : new Float32Array(bytes.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = kind === 'index' ? view.getUint16(i * 2, true) : (kind === 'weights' ? view.getUint16(i * 2, true) : view.getInt16(i * 2, true)) / 10000
  return out
}
// Immutable vertex buffers are shared by every player. No per-frame cloth solver
// or vertex uploads; the same GPU skeleton that moves Noot also moves the outfit.
const templates = new Map<string, { style: string; role: string; geometry: THREE.BufferGeometry }[]>()
function geometries(skeleton: THREE.Skeleton, selected: string) {
  const key = selected + ':' + skeleton.bones.map(b => b.name).join(':')
  if (!templates.has(key)) {
    const mapping = fashionBones.map(name => skeleton.bones.findIndex(b => b.name === name))
    if (mapping.some(i => i < 0)) throw new Error('Noot fashion requires the matching Noot rig')
    templates.set(key, data.filter(source => source.style === selected).map(source => {
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.BufferAttribute(decode(source.position, 'position'), 3))
      if (source.sway) {
        geometry.morphTargetsRelative = true
        geometry.morphAttributes.position = [new THREE.BufferAttribute(decode(source.sway, 'position'), 3)]
        geometry.morphAttributes.position[0].name = 'HemSway'
      }
      geometry.setAttribute('normal', new THREE.BufferAttribute(decode(source.normal, 'position'), 3))
      geometry.setIndex(new THREE.BufferAttribute(decode(source.index, 'index'), 1))
      geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(Array.from(decode(source.joints, 'joints'), i => mapping[i]), 4))
      const weights = decode(source.weights, 'weights')
      for (let i = 0; i < weights.length; i += 4) { const total = weights[i] + weights[i + 1] + weights[i + 2] + weights[i + 3]; for (let j = 0; j < 4; j++) weights[i + j] /= total }
      geometry.setAttribute('skinWeight', new THREE.BufferAttribute(weights, 4))
      return { style: source.style, role: source.role, geometry }
    }))
  }
  return templates.get(key)!
}

export function createFashion(character: THREE.Object3D, skeleton: THREE.Skeleton) {
  const cloth = new THREE.MeshPhysicalMaterial({ roughness: .92, sheen: .3, sheenRoughness: .85 })
  const shoes = new THREE.MeshStandardMaterial({ roughness: .7 })
  const trim = new THREE.MeshStandardMaterial({ color: '#eee7d7', roughness: .88 })
  const lining = new THREE.MeshStandardMaterial({ color: '#eee7d7', roughness: .84 })
  const button = new THREE.MeshStandardMaterial({ color: '#baa981', roughness: .46, metalness: .28 })
  const pattern = styleFabric(cloth)
  const meshes: { mesh: THREE.SkinnedMesh; foot: boolean; style: string }[] = []
  const loaded = new Set<string>()
  function ensure(selected: string | undefined) {
    if (!selected || loaded.has(selected)) return
    loaded.add(selected)
    for (const { style, role, geometry } of geometries(skeleton, selected)) {
      const foot = ['sneakers', 'boots', 'high-tops', 'mary-janes'].includes(style)
      const mesh = new THREE.SkinnedMesh(geometry, role === 'lining' || (role === 'trim' && foot) ? lining : role === 'trim' ? trim : role === 'detail' ? button : foot ? shoes : cloth)
      mesh.name = `Noot_Fashion_${style}_${role}`
      mesh.userData.fashion = style; mesh.visible = false; mesh.frustumCulled = false
      character.add(mesh); mesh.bind(skeleton, new THREE.Matrix4())
      meshes.push({ mesh, foot, style })
    }
  }
  let signature = ''
  return {
    update(state: NootState, time = 0, reduced = false) {
      const next = `${state.clothing}:${state.footwear}:${state.accessoryColor}:${state.shoeColor}:${state.trimColor}:${state.pattern}`
      if (signature !== next) {
        signature = next
        ensure(state.clothing); ensure(state.footwear)
        for (const { mesh, foot, style } of meshes) mesh.visible = style === (foot ? state.footwear : state.clothing)
        cloth.color.set(nootColorHex(state.accessoryColor))
        trim.color.set(state.trimColor ? nootColorHex(state.trimColor) : '#eee7d7')
        shoes.color.set(nootColorHex(state.shoeColor ?? state.accessoryColor))
        cloth.roughness = state.clothing === 'raincoat' ? .52 : state.clothing === 'suit' ? .78 : .92
        pattern.value = ['plain', 'stripes', 'dots', 'gingham', 'confetti'].indexOf(state.pattern ?? 'plain')
      }
      if (state.paused && !reduced) return
      for (const {mesh} of meshes) if (mesh.visible && mesh.morphTargetInfluences) {
        // Only the hem moves; the waist and neckline remain pinned to the skin.
        mesh.morphTargetInfluences[0] = reduced ? 0 : Math.sin(time * 2.2) * (['walk','dance','groove'].includes(state.pose) ? .65 : .22)
      }
    },
    dispose() { meshes.forEach(({mesh}) => mesh.removeFromParent()); cloth.dispose(); shoes.dispose(); trim.dispose(); lining.dispose(); button.dispose() },
  }
}
