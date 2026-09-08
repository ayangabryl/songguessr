import type { NootLiveChannel } from './live-channel.ts'
import type { NootLiveEvent, NootMotionAction } from '../../../shared/noot-live.ts'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { createNootFromAsset, loadNootAsset } from './asset.ts'
import { createSocialWorld, type NootParticipant, type PlayKind, type GroupKind } from './social-world.ts'

export interface PartyOptions { participants: NootParticipant[]; theme: 'light' | 'dark'; paused?: boolean; speed?: number; network?: NootLiveChannel }

/** A single floor, camera and physics world lets the characters meet each other. */
export function mountNootParty(canvas: HTMLCanvasElement, read: () => PartyOptions, onReady: (ready: boolean) => void, choose: (id: string) => void, placeLabel?: (id: string, x: number, y: number) => boolean | void, onError?: () => void) {
  const mountedAt = performance.now();
  const assetPromise = loadNootAsset();
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.setClearColor(0, 0)
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NeutralToneMapping
  const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(-5, 5, 3.5, -3.5, .1, 60)
  camera.position.set(0, 4.7, 18); camera.lookAt(0, 2.6, 0)
  const pmrem = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment()
  const environment = pmrem.fromScene(room, .04); scene.environment = environment.texture; scene.environmentIntensity = .35
  room.dispose(); pmrem.dispose()
  const fill = new THREE.HemisphereLight('#fff9e8', '#747b63', .8)
  const key = new THREE.DirectionalLight('#fff5df', 1.65); key.position.set(-4, 7, 6)
  const rim = new THREE.DirectionalLight('#edf5ff', .8); rim.position.set(4, 5, -3)
  scene.add(fill, key, rim)
  const shadowCanvas = document.createElement('canvas'); shadowCanvas.width = shadowCanvas.height = 128
  const context = shadowCanvas.getContext('2d')!, gradient = context.createRadialGradient(64, 64, 8, 64, 64, 64)
  gradient.addColorStop(0, 'rgba(40,55,15,.25)'); gradient.addColorStop(1, 'rgba(40,55,15,0)')
  context.fillStyle = gradient; context.fillRect(0, 0, 128, 128)
  const shadowTexture = new THREE.CanvasTexture(shadowCanvas), shadowGeometry = new THREE.PlaneGeometry(3, 2.2)
  const world = createSocialWorld('table:' + read().participants.map(p => p.id).sort().join(':'))
  const models = new Map<string, { noot: ReturnType<typeof createNootFromAsset>; wrapper: THREE.Group; shadow: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> }>()
  const pointer = new THREE.Vector2(), ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
  const point = new THREE.Vector3(), offset = new THREE.Vector2()
  const media = matchMedia('(prefers-reduced-motion: reduce)')
  let asset: Awaited<ReturnType<typeof loadNootAsset>> | undefined
  let disposed = false, visible = true, lost = false, ready = false, frame = 0, last = 0, selected = '', hovered = ''
  let down: { id: string; x: number; y: number; moved: boolean; pointerId: number } | undefined
  let canvasWidth = 1, canvasHeight = 1
  const labelCache = new Map<string, string>()
  const frameTimes: number[] = [], cpuTimes: number[] = []
  const remoteHeld = new Map<string, {x:number;y:number;at:number}>()
  let heldSentAt = 0, snapshotAt = 0
  function publish(id: string, action: NootMotionAction) {
    const a = world.actors.get(id)
    if (a) read().network?.send({actor:id, action, x:a.x, y:a.y, vx:a.vx, vy:a.vy})
    heldSentAt = performance.now()
  }
  function localDrop(id: string) { world.drop(id); publish(id, 'drop') }
  function localJump(id: string) { if (world.jump(id)) publish(id, 'jump') }
  function receive(event: NootLiveEvent) {
    if (disposed || media.matches) return
    world.step(0, read().participants, false, !read().network)
    if (event.type === 'pet-social') {
      if (event.action === 'group-dance' || event.action === 'wave-chain') world.groupInteract(event.action)
      else world.interact(event.actor, event.friend, event.action)
      wake(); return
    }
    const a = world.actors.get(event.actor)
    if (!a) return
    if (down?.id === event.actor && down.moved) {
      const pointerId = down.pointerId; down = undefined
      if (canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId)
    }
    if (event.action === 'lift' || event.action === 'drag') {
      if (!a.held) world.lift(a.id)
      remoteHeld.set(a.id, {x:event.x,y:event.y,at:performance.now()})
    } else {
      remoteHeld.delete(a.id)
      a.x = event.x; a.y = event.y; a.vx = event.vx; a.vy = event.vy
      if (event.action === 'drop') world.drop(a.id)
      else { a.jumpAt = undefined; world.jump(a.id) }
    }
    wake()
  }
  let sampledAt = 0
  const labelPosition = new THREE.Vector3(), restingPointer = new THREE.Vector2()

  function resize(schedule = true) {
    const { width, height } = canvas.getBoundingClientRect(); if (!width || !height) return
    canvasWidth = width; canvasHeight = height
    renderer.setPixelRatio(Math.min(devicePixelRatio, read().participants.length >= 4 ? 1.25 : 1.5))
    renderer.setSize(width, height, false)
    const halfWidth = Math.max(4.1, (read().participants.length - 1) * 1.5 + 2.4)
    const halfHeight = Math.max(3.3, halfWidth * height / width)
    const horizontal = Math.max(halfWidth, halfHeight * width / height)
    camera.left = -horizontal; camera.right = horizontal; camera.top = halfHeight; camera.bottom = -halfHeight
    camera.updateProjectionMatrix(); camera.updateMatrixWorld(); if (schedule) wake()
  }
  function remove(id: string) {
    const model = models.get(id); if (!model) return
    labelCache.delete(id)
    scene.remove(model.wrapper, model.shadow); model.noot.dispose(); model.shadow.material.dispose(); models.delete(id)
  }
  function render(timestamp: number) {
    frame = 0; if (disposed || lost || !visible || document.hidden || !asset) return
    const cpuStart = import.meta.env.DEV ? performance.now() : 0
    if (import.meta.env.DEV && sampledAt) frameTimes.push(timestamp - sampledAt)
    sampledAt = timestamp
    const options = read(), dt = options.paused ? 0 : Math.min((timestamp - last) / 1000 || 1 / 60, .2) * (options.speed ?? 1)
    last = timestamp
    const ids = new Set(options.participants.map(p => p.id))
    let rosterChanged = false
    for (const id of models.keys()) if (!ids.has(id)) { remove(id); rosterChanged = true }
    for (const participant of options.participants) if (!models.has(participant.id)) {
      const noot = createNootFromAsset(asset, participant.id, wake), wrapper = new THREE.Group(); wrapper.add(noot.root)
      const shadow = new THREE.Mesh(shadowGeometry, new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false }))
      shadow.rotation.x = -Math.PI / 2; shadow.position.y = -.013
      models.set(participant.id, { noot, wrapper, shadow }); scene.add(wrapper, shadow); rosterChanged = true
    }
    if (rosterChanged) {
      for (const model of models.values()) model.noot.setCompact(models.size >= 4)
      resize(false)
    }
    for (const [id, target] of remoteHeld) {
      const a = world.actors.get(id)
      if (!a || timestamp-target.at > 2500) { world.drop(id); remoteHeld.delete(id); continue }
      const ease = 1-Math.exp(-dt*32)
      world.drag(id, a.x+(target.x-a.x)*ease, a.y+(target.y-a.y)*ease)
    }
    if (down?.moved && timestamp-heldSentAt > 350) publish(down.id, 'drag')
    const ticks = Math.max(1,Math.ceil(dt/.033))
    for (let i=0;i<ticks;i++) world.step(dt/ticks, options.participants, media.matches, !options.network)
    for (const a of world.actors.values()) {
      const model = models.get(a.id)!
      model.noot.update(world.time, dt, { ...world.stateFor(a), paused: options.paused }, hovered === a.id ? pointer : restingPointer, media.matches)
      model.wrapper.position.set(a.x, a.y, 0); model.wrapper.rotation.set(0, a.yaw, a.tilt)
      model.wrapper.scale.set(1/Math.sqrt(a.squash),a.squash,1/Math.sqrt(a.squash))
      model.shadow.position.x = a.x; model.shadow.scale.setScalar(Math.max(.65, 1 - a.y * .1))
      model.shadow.material.opacity = Math.max(.12, 1 - a.y * .26)
      labelPosition.set(a.x, -.12, 0).project(camera)
      const labelX = Math.round((labelPosition.x + 1) * canvasWidth * 50) / 100
      const labelY = Math.round((1 - labelPosition.y) * canvasHeight * 50) / 100
      const labelKey = `${labelX}:${labelY}`
      if (labelCache.get(a.id) !== labelKey && placeLabel?.(a.id, labelX, labelY) !== false) labelCache.set(a.id, labelKey)
    }
    const dark = options.theme === 'dark'
    renderer.toneMappingExposure = dark ? .86 : .97; fill.intensity = dark ? .58 : .8; key.intensity = dark ? 1.1 : 1.65
    renderer.render(scene, camera)
    if (!ready) { ready = true; if (import.meta.env.DEV) canvas.dataset.nootReadyMs = String(Math.round(performance.now() - mountedAt)); onReady(true) }
    if (import.meta.env.DEV) {
      if (timestamp-snapshotAt > 250) {
        snapshotAt=timestamp
        canvas.dataset.nootPositions=JSON.stringify([...world.actors.values()].map(a=>({id:a.id,x:models.get(a.id)!.wrapper.position.x,y:models.get(a.id)!.wrapper.position.y,held:a.held})))
      }
      cpuTimes.push(performance.now() - cpuStart)
      if (frameTimes.length >= 120) {
        const sorted = [...frameTimes].sort((a,b) => a-b), cpu = [...cpuTimes].sort((a,b) => a-b)
        canvas.dataset.nootPerformance = JSON.stringify({characters:models.size,frameMedianMs:sorted[60],frameP95Ms:sorted[114],cpuP95Ms:cpu[Math.floor(cpu.length*.95)],drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,pixelRatio:renderer.getPixelRatio()})
        frameTimes.length = cpuTimes.length = 0
      }
    }
    if (!options.paused && !media.matches) frame = requestAnimationFrame(render)
  }
  function wake() {
    if (!frame && !disposed && !lost && visible && !document.hidden) { sampledAt = 0; frameTimes.length = cpuTimes.length = 0; last = performance.now(); frame = requestAnimationFrame(render) }
  }
  function locate(event: PointerEvent) {
    const rect = canvas.getBoundingClientRect()
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2)
    ray.setFromCamera(pointer, camera); ray.ray.intersectPlane(plane, point)
    return [...world.actors.values()].filter(a => Math.abs(point.x - a.x) < 1.2 && point.y > a.y && point.y < a.y + 3.8)
      .sort((a, b) => Math.abs(point.x - a.x) - Math.abs(point.x - b.x))[0]
  }
  function pointerDown(event: PointerEvent) {
    const actor = locate(event); if (!actor || event.button !== 0) return
    selected = actor.id; down = { id: actor.id, x: event.clientX, y: event.clientY, moved: false, pointerId: event.pointerId }
    offset.set(point.x - actor.x, point.y - actor.y)
    canvas.setPointerCapture(event.pointerId); canvas.focus(); wake()
  }
  function pointerMove(event: PointerEvent) {
    const hit = locate(event); hovered = hit?.id ?? ''
    if (down && !media.matches) {
      if (!down.moved && Math.hypot(event.clientX - down.x, event.clientY - down.y) > 5) { remoteHeld.delete(down.id); world.lift(down.id); down.moved = true; publish(down.id, 'lift') }
      if (down.moved) { world.drag(down.id, point.x - offset.x, point.y - offset.y); publish(down.id, 'drag') }
    }
    canvas.style.cursor = down?.moved ? 'grabbing' : hovered ? 'grab' : 'default'; wake()
  }
  function release(event: PointerEvent) {
    if (!down || event.pointerId !== down.pointerId) return
    const current = down; down = undefined
    if (current.moved) localDrop(current.id)
    else if (event.type === 'pointerup') choose(current.id)
    if (canvas.hasPointerCapture(current.pointerId)) canvas.releasePointerCapture(current.pointerId)
    canvas.style.cursor = 'grab'; wake()
  }
  function leave() { hovered = ''; pointer.set(0, 0); wake() }
  function releaseAll() {
    const current = down; down = undefined
    if (current?.moved) localDrop(current.id)
    for (const a of world.actors.values()) if (a.held && !remoteHeld.has(a.id)) localDrop(a.id)
    if (current && canvas.hasPointerCapture(current.pointerId)) canvas.releasePointerCapture(current.pointerId)
    canvas.style.cursor = 'grab'; wake()
  }
  function visibilityChanged() { if (document.hidden) releaseAll(); else wake() }
  function keyboard(event: KeyboardEvent) {
    const list = [...world.actors.values()]; if (!list.length) return
    let a = world.actors.get(selected) ?? list[0]; selected = a.id
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Enter', 'Escape'].includes(event.key)) return
    event.preventDefault()
    if (event.key === 'Enter') choose(a.id)
    else if (event.key === 'Escape' && a.held) localDrop(a.id)
    else if (event.key === ' ' && !media.matches) {
      if (a.held) localDrop(a.id)
      else if (!event.repeat) localJump(a.id)
    } else if (a.held && !media.matches) { world.drag(a.id, a.x + (event.key === 'ArrowLeft' ? -.35 : event.key === 'ArrowRight' ? .35 : 0), a.y + (event.key === 'ArrowUp' ? .3 : event.key === 'ArrowDown' ? -.3 : 0)); publish(a.id, 'drag') }
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      const index = list.indexOf(a), next = (index + (event.key === 'ArrowRight' ? 1 : list.length - 1)) % list.length
      a = list[next]; selected = a.id
    }
    canvas.setAttribute('aria-label', `${a.source.name} selected. Arrows choose a friend; Space jumps; Enter waves.`)
    wake()
  }
  function contextLost(event: Event) { event.preventDefault(); releaseAll(); lost = true; ready = false; cancelAnimationFrame(frame); frame = 0; onReady(false) }
  function contextRestored() { lost = false; wake() }
  const resizeObserver = new ResizeObserver(() => resize()); resizeObserver.observe(canvas)
  const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; wake() }); intersection.observe(canvas)
  const handlers = { pointerdown: pointerDown, pointermove: pointerMove, pointerup: release, pointercancel: release, lostpointercapture: release, pointerleave: leave, keydown: keyboard, webglcontextlost: contextLost, webglcontextrestored: contextRestored }
  for (const [name, handler] of Object.entries(handlers)) canvas.addEventListener(name, handler as EventListener)
  document.addEventListener('visibilitychange', visibilityChanged); window.addEventListener('blur', releaseAll); media.addEventListener('change', wake)
  assetPromise.then(result => { if (disposed) return; asset = result; resize(); wake() }).catch(error => { if (disposed) return; console.warn('Noot party unavailable', error); onReady(false); onError?.() })
  return {
    wake, receive,
    interact(a: string, b: string, kind: PlayKind) { world.step(0, read().participants); world.interact(a, b, kind); wake() },
    groupInteract(kind: GroupKind) { world.step(0, read().participants); world.groupInteract(kind); wake() },
    jump(id: string) { if (media.matches) return; world.step(0, read().participants); localJump(id); wake() },
    lift(id: string) { if (media.matches) return; world.lift(id); const actor = world.actors.get(id); if (actor) world.drag(id, actor.x, 2.4); wake() },
    drop(id: string) { localDrop(id); wake() },
    dispose() {
      releaseAll(); remoteHeld.clear()
      disposed = true; cancelAnimationFrame(frame); resizeObserver.disconnect(); intersection.disconnect()
      document.removeEventListener('visibilitychange', visibilityChanged); window.removeEventListener('blur', releaseAll); media.removeEventListener('change', wake)
      for (const [name, handler] of Object.entries(handlers)) canvas.removeEventListener(name, handler as EventListener)
      for (const id of models.keys()) remove(id)
      shadowGeometry.dispose(); shadowTexture.dispose(); environment.dispose(); renderer.dispose()
    },
  }
}
