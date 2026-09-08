import * as THREE from 'three'
import { createNootFromAsset, loadNootAsset } from './asset'
import { loadFashionData } from './fashion'
import type { NootState } from './types'

// One shared, short-lived renderer: lists use images, never a WebGL loop per seat.
const cache = new Map<string, Promise<string>>()
let queue: Promise<unknown> = Promise.resolve()
let renderer: THREE.WebGLRenderer | undefined
let release: ReturnType<typeof setTimeout> | undefined

export function nootPortrait(state: NootState): Promise<string> {
  const key = JSON.stringify(state)
  const existing = cache.get(key)
  if (existing) return existing
  const request = queue.then(async () => {
    const [asset] = await Promise.all([loadNootAsset(), loadFashionData([state.headgear ?? '', state.eyewear ?? ''])])
    clearTimeout(release)
    renderer ??= new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' })
    renderer.setSize(144, 144, false)
    renderer.setClearColor(0, 0)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.NeutralToneMapping
    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1.36, 1.36, 1.36, -1.36, .1, 20)
    camera.position.set(0, 2.62, 9)
    camera.lookAt(0, 2.62, 0)
    scene.add(new THREE.HemisphereLight('#fff9eb', '#87906c', 1.7))
    const light = new THREE.DirectionalLight('#fff8ed', 2.4)
    light.position.set(-3, 5, 6)
    scene.add(light)
    const noot = createNootFromAsset(asset, 'portrait')
    try {
      scene.add(noot.root)
      noot.update(0, 0, state, new THREE.Vector2(), true)
      renderer.render(scene, camera)
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 144
      const context = canvas.getContext('2d')!
      // A rounded chin below the smile; keep the antenna and headwear uncropped.
      context.beginPath()
      context.moveTo(0, 0); context.lineTo(144, 0); context.lineTo(144, 100)
      context.bezierCurveTo(144, 133, 108, 144, 72, 144)
      context.bezierCurveTo(36, 144, 0, 133, 0, 100); context.closePath()
      context.clip()
      context.drawImage(renderer.domElement, 0, 0)
      return canvas.toDataURL('image/png')
    } finally {
      noot.dispose()
      release = setTimeout(() => {
        renderer?.dispose(); renderer?.forceContextLoss(); renderer = undefined
      }, 500)
    }
  })
  queue = request.catch(() => {})
  cache.set(key, request)
  void request.catch(() => { if (cache.get(key) === request) cache.delete(key) })
  if (cache.size > 48) cache.delete(cache.keys().next().value!)
  return request
}
