import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { createNoot } from './model'
import type { NootState } from './types'
export type { NootState } from './types'

/** Owns one renderer and releases all GPU and browser resources on unmount. */
export function mountNoot(canvas: HTMLCanvasElement, readState: () => NootState, onReady: (ready: boolean) => void) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setClearColor(0x000000, 0)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.NeutralToneMapping
  renderer.toneMappingExposure = 1
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 30)
  camera.position.set(0, 2.31, 8.5)
  camera.lookAt(0, 1.93, 0)
  const pmrem = new THREE.PMREMGenerator(renderer)
  const room = new RoomEnvironment()
  const environment = pmrem.fromScene(room, 0.04)
  scene.environment = environment.texture
  scene.environmentIntensity = 0.38
  room.dispose(); pmrem.dispose()
  const fill = new THREE.HemisphereLight('#f7f4e8', '#747564', .7); scene.add(fill)
  const key = new THREE.DirectionalLight('#fff6e6', 1.65)
  key.position.set(-3, 5, 5); scene.add(key)
  const rim = new THREE.DirectionalLight('#e9f3ff', .85)
  rim.position.set(3, 4, -3); scene.add(rim)
  const noot = createNoot()
  const turntable = new THREE.Group(); turntable.add(noot.root); scene.add(turntable)
  const shadowCanvas = document.createElement('canvas')
  shadowCanvas.width = shadowCanvas.height = 128
  const ctx = shadowCanvas.getContext('2d')!
  const gradient = ctx.createRadialGradient(64, 64, 8, 64, 64, 64)
  gradient.addColorStop(0, 'rgba(29,40,13,.24)'); gradient.addColorStop(0.5, 'rgba(29,40,13,.1)'); gradient.addColorStop(1, 'rgba(29,40,13,0)')
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128)
  const shadowTexture = new THREE.CanvasTexture(shadowCanvas)
  const shadowMaterial = new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false })
  const shadowGeometry = new THREE.PlaneGeometry(2.9, 1.7)
  const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial)
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = -0.012; scene.add(shadow)
  const pointer = new THREE.Vector2()
  const floorOrigin = new THREE.Vector3(), floorUnit = new THREE.Vector3()
  let canvasWidth = 1
  function frameCamera(state: NootState) {
    if (state.comparison) {
      const distance = 4.06 * Math.max(1, 1/camera.aspect) / (2*Math.tan(THREE.MathUtils.degToRad(16)))
      camera.position.set(0,1.91,distance); camera.lookAt(0,1.91,0)
    } else { camera.position.set(0,2.31,8.5); camera.lookAt(0,1.93,0) }
    camera.updateMatrixWorld()
  }
  const media = window.matchMedia('(prefers-reduced-motion: reduce)')
  let frame = 0, previousTime = 0, elapsed = 0, visible = true, lost = false, disposed = false
  let settleUntil = 0, signature = '', ready = false, previousLeft: number | undefined
  function render(timestamp: number) {
    frame = 0
    if (disposed || lost || !visible || document.hidden) return
    const dt = Math.min((timestamp - previousTime) / 1000 || 1 / 60, 0.05)
    previousTime = timestamp
    const state = readState()
    const animationDt = dt * (state.speed ?? 1)
    if (!state.paused) elapsed += animationDt
    const nextSignature = `${state.pose}:${state.eventId}:${state.headgear}:${state.mood}:${state.theme}:${state.paused}:${state.viewYaw}:${state.comparison}:${media.matches}`
    if (nextSignature !== signature) { signature = nextSignature; settleUntil = timestamp + 1800 }
    frameCamera(state)
    let travelSpeed: number | undefined
    if (state.onRuler && state.pose === 'skip') {
      const rect = canvas.getBoundingClientRect()
      floorOrigin.set(0,0,0).project(camera); floorUnit.set(1,0,0).project(camera)
      const pixelsPerUnit = Math.abs(floorUnit.x-floorOrigin.x)*canvasWidth/2
      // Use ruler-relative position: scrolling the page must not create footsteps.
      const rulerLeft = canvas.closest('.stage-ruler')?.getBoundingClientRect().left ?? 0
      const localLeft = rect.left-rulerLeft
      if (previousLeft !== undefined && pixelsPerUnit > 0) travelSpeed = (localLeft-previousLeft)/Math.max(animationDt,.001)/pixelsPerUnit
      previousLeft = localLeft
    } else previousLeft = undefined
    noot.update(elapsed, state.paused ? 0 : animationDt, {...state, travelSpeed}, pointer, media.matches)
    const dark = state.theme === 'dark'
    const lightBlend = 1 - Math.exp(-dt * 7)
    renderer.toneMappingExposure = THREE.MathUtils.lerp(renderer.toneMappingExposure, dark ? .82 : .97, lightBlend)
    key.intensity = THREE.MathUtils.lerp(key.intensity, dark ? 1.05 : 1.65, lightBlend)
    fill.intensity = THREE.MathUtils.lerp(fill.intensity, dark ? .50 : .7, lightBlend)
    rim.intensity = THREE.MathUtils.lerp(rim.intensity, dark ? .6 : .85, lightBlend)
    scene.environmentIntensity = THREE.MathUtils.lerp(scene.environmentIntensity, dark ? .28 : .38, lightBlend)
    turntable.rotation.y = state.viewYaw ?? 0
    shadow.scale.setScalar(1 - noot.root.position.y * 0.3)
    shadow.position.x = noot.root.position.x
    shadowMaterial.opacity = (state.theme === 'dark' ? .6 : 1) * (1 - noot.root.position.y * .7)
    renderer.render(scene, camera)
    if (!ready) { ready = true; onReady(true) }
    // Reduced motion stops drawing once the static expression/colour has settled.
    if ((!media.matches && !state.paused) || timestamp < settleUntil) frame = requestAnimationFrame(render)
  }
  function wake() {
    if (!frame && !disposed && !lost && visible && !document.hidden) { previousTime = performance.now(); frame = requestAnimationFrame(render) }
  }
  function resize() {
    const { width, height } = canvas.getBoundingClientRect()
    if (!width || !height) return
    previousLeft = undefined; canvasWidth = width
    renderer.setSize(width, height, false)
    camera.aspect = width / height; camera.updateProjectionMatrix(); wake()
  }
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(canvas)
  const intersectionObserver = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; wake() })
  intersectionObserver.observe(canvas)
  function move(event: PointerEvent) {
    const rect = canvas.getBoundingClientRect()
    pointer.set(THREE.MathUtils.clamp((event.clientX - rect.left) / rect.width * 2 - 1, -1, 1), THREE.MathUtils.clamp(1 - (event.clientY - rect.top) / rect.height * 2, -1, 1)); wake()
  }
  function leave() { pointer.set(0, 0); wake() }
  function contextLost(event: Event) { event.preventDefault(); lost = true; ready = false; cancelAnimationFrame(frame); frame = 0; onReady(false) }
  function contextRestored() { lost = false; wake() }
  canvas.addEventListener('pointermove', move)
  canvas.addEventListener('pointerleave', leave)
  canvas.addEventListener('webglcontextlost', contextLost)
  canvas.addEventListener('webglcontextrestored', contextRestored)
  document.addEventListener('visibilitychange', wake)
  media.addEventListener('change', wake)
  resize()
  return {
    wake,
    dispose() {
      disposed = true; cancelAnimationFrame(frame)
      resizeObserver.disconnect(); intersectionObserver.disconnect()
      canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerleave', leave)
      canvas.removeEventListener('webglcontextlost', contextLost); canvas.removeEventListener('webglcontextrestored', contextRestored)
      document.removeEventListener('visibilitychange', wake); media.removeEventListener('change', wake)
      noot.dispose(); environment.dispose(); shadowTexture.dispose(); shadowMaterial.dispose(); shadowGeometry.dispose(); renderer.dispose()
    },
  }
}
