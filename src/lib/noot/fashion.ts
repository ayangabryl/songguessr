import * as THREE from 'three'
import { fashionBones, fashionStyles } from './fashion-data.ts'
type EncodedMesh = { style: string; role: string; position: string; normal: string; index: string; joints: string; weights: string; sway?: string }
const data = new Map<string, EncodedMesh[]>()
const requests = new Map<string, Promise<void>>()
export function loadFashionData(selected: readonly string[] = Object.keys(fashionStyles)) {
  return Promise.all(selected.map(style => {
    const loader = fashionStyles[style as keyof typeof fashionStyles]
    if (!loader || data.has(style)) return Promise.resolve()
    let request = requests.get(style)
    if (!request) {
      request = loader().then(module => { data.set(style,module.default) }).catch(error => { requests.delete(style); throw error })
      requests.set(style,request)
    }
    return request
  })).then(()=>{})
}
import { NOOT_FASHION_HATS, NOOT_FASHION_EYES, NOOT_FOOTWEAR } from '../../../shared/noot-profile.ts'
import { spring } from './motion.ts'
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
    templates.set(key, (data.get(selected) ?? []).map(source => {
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

export function createFashion(character: THREE.Object3D, skeleton: THREE.Skeleton, onReady: () => void = () => {}) {
  const cloth = new THREE.MeshPhysicalMaterial({ roughness: .92, sheen: .3, sheenRoughness: .85 })
  const shoes = new THREE.MeshStandardMaterial({ roughness: .7 })
  const trim = new THREE.MeshStandardMaterial({ color: '#eee7d7', roughness: .88 })
  const lining = new THREE.MeshStandardMaterial({ color: '#eee7d7', roughness: .84 })
  const sole = new THREE.MeshStandardMaterial({ color: '#35302a', roughness: .85 })
  const button = new THREE.MeshStandardMaterial({ color: '#baa981', roughness: .46, metalness: .28 })
  const pattern = styleFabric(cloth)
  const hat = new THREE.MeshPhysicalMaterial({ roughness: .8, sheen: .25 })
  const frames = new THREE.MeshPhysicalMaterial({ roughness: .25, clearcoat: .6 })
  const lenses = new THREE.MeshPhysicalMaterial({color:'#17343b',roughness:.14,metalness:.12,clearcoat:1})
  const clearGlass = new THREE.MeshPhysicalMaterial({color:'#dcebed',roughness:.1,transparent:true,opacity:.14,depthWrite:false,clearcoat:1})
  const meshes: { mesh: THREE.SkinnedMesh; slot: 'clothing' | 'footwear' | 'headgear' | 'eyewear'; style: string }[] = []
  const hem = spring(0, 2.6, .78)
  let lastTime: number | undefined
  const loaded = new Set<string>(), pending = new Set<string>()
  let disposed = false, selection: NootState = { pose: 'idle', difficulty: 'easy' }
  function ensure(selected: string | undefined) {
    if (!selected || loaded.has(selected) || pending.has(selected) || !(selected in fashionStyles)) return
    if (!data.has(selected)) {
      pending.add(selected)
      void loadFashionData([selected]).then(() => {
        pending.delete(selected)
        if (disposed) return
        ensure(selected)
        for (const { mesh, slot, style } of meshes) mesh.visible = style === selection[slot]
        onReady()
      }).catch(error => { pending.delete(selected); if (!disposed) console.warn('Noot wearable could not load.', error) })
      return
    }
    loaded.add(selected)
    for (const { style, role, geometry } of geometries(skeleton, selected)) {
      const slot = (NOOT_FOOTWEAR as readonly string[]).includes(style) ? 'footwear' : (NOOT_FASHION_HATS as readonly string[]).includes(style) ? 'headgear' : (NOOT_FASHION_EYES as readonly string[]).includes(style) ? 'eyewear' : 'clothing'
      const material = role === 'sole' ? sole : role === 'lens' ? lenses : role === 'glass' ? clearGlass : role === 'lining' || (role === 'trim' && slot !== 'clothing') ? lining : role === 'trim' ? trim : role === 'detail' ? button : slot === 'footwear' ? shoes : slot === 'headgear' ? hat : slot === 'eyewear' ? frames : cloth
      const mesh = new THREE.SkinnedMesh(geometry, material)
      mesh.name = `Noot_Fashion_${style}_${role}`
      mesh.userData.fashion = style; mesh.visible = false; mesh.frustumCulled = false
      character.add(mesh); mesh.bind(skeleton, new THREE.Matrix4())
      meshes.push({ mesh, slot, style })
    }
  }
  let signature = ''
  return {
    update(state: NootState, time = 0, reduced = false, drive = 0) {
      selection = state
      const next = `${state.clothing}:${state.footwear}:${state.headgear}:${state.eyewear}:${state.accessoryColor}:${state.shoeColor}:${state.headColor}:${state.eyeColor}:${state.trimColor}:${state.pattern}`
      if (signature !== next) {
        signature = next
        ensure(state.clothing); ensure(state.footwear); ensure(state.headgear); ensure(state.eyewear)
        for (const { mesh, slot, style } of meshes) mesh.visible = style === state[slot]
        cloth.color.set(nootColorHex(state.accessoryColor))
        trim.color.set(state.trimColor ? nootColorHex(state.trimColor) : '#eee7d7')
        shoes.color.set(nootColorHex(state.shoeColor ?? state.accessoryColor))
        shoes.roughness = state.footwear === 'loafers' || state.footwear === 'mary-janes' ? .38 : state.footwear === 'slippers' ? .98 : .7
        hat.color.set(nootColorHex(state.headColor ?? state.accessoryColor))
        hat.roughness = state.headgear === 'crown' ? .4 : .84
        hat.metalness = state.headgear === 'crown' ? .2 : 0
        frames.color.set(state.eyeColor ? nootColorHex(state.eyeColor) : '#293431')
        cloth.roughness = state.clothing === 'raincoat' ? .52 : state.clothing === 'suit' ? .78 : .92
        pattern.value = ['plain', 'stripes', 'dots', 'gingham', 'confetti'].indexOf(state.pattern ?? 'plain')
      }
      const dt = lastTime === undefined ? 0 : Math.max(0, Math.min(.1, time - lastTime))
      lastTime = time
      if (state.paused && !reduced) return
      const moving = ['walk','run','dance','groove','samba','charleston','hip-sway','body-roll','outfit'].includes(state.pose)
      const target = THREE.MathUtils.clamp(Math.sin(time * 2.2) * (moving ? .55 : .06) + drive * .65, -.85, .85)
      const motion = reduced ? hem.reset(0) : THREE.MathUtils.clamp(hem.step(target, dt), -1, 1)
      for (const {mesh} of meshes) if (mesh.visible && mesh.morphTargetInfluences) {
        // Only the hem moves; the waist and neckline remain pinned to the skin.
        mesh.morphTargetInfluences[0] = motion
      }
    },
    dispose() { disposed = true; meshes.forEach(({mesh}) => mesh.removeFromParent()); cloth.dispose(); shoes.dispose(); trim.dispose(); lining.dispose(); button.dispose(); sole.dispose(); hat.dispose(); frames.dispose(); lenses.dispose(); clearGlass.dispose() },
  }
}
