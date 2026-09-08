import { DANCE_POSES } from './dance-library.ts'
import { seededRandom } from './character-mind.ts'
import type { NootAction, NootState } from './types.ts'

export interface NootParticipant {
  id: string
  name: string
  state: NootState
  event?: { id: string | number; type: 'greeting' | 'success' | 'frustration'; from?: string }
}
export type PlayKind = 'hello' | 'high-five' | 'boop' | 'dance' | 'comfort'
export type GroupKind = 'wave-chain' | 'group-dance'
export interface SocialActor {
  id: string; home: number; x: number; y: number; vx: number; vy: number
  target: number; yaw: number; tilt: number; tiltVelocity: number
  pose: NootAction; until: number; eventId: number; held: boolean
  partner?: string; source: NootParticipant; stateKey: string; eventKey: string
  collisionAt: number; dragAt: number
  squash: number; jumpAt?: number; landedAt: number; lastPlay: number
}
interface Play { a: string; b: string; kind: PlayKind; start: number; phase: number; center: number; sign: number; variation: number }
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x))
const durations: Partial<Record<NootAction, number>> = {
  hover: 1.6, tap: 1.1, win: 1.4, cheer: 1.8, streak: 1.8, lose: 1.2,
  'victory-dance': 2.4, 'friendly-wave': 3.2,
  'wave-small': 2, 'high-five': 2.4, boop: 2, laugh: 2.4, angry: 2.8,
  startled: 1.1, tumble: 2.8, catch: 1.8, 'get-up': 2, shrug: 2.4,
}

/** Cosmetic local acting only. Scores, identity and greetings remain game-owned. */
export function createSocialWorld(seed = 'noot-table') {
  const actors = new Map<string, SocialActor>()
  const random = seededRandom(seed)
  let clock = 0, nextPlay = 7 + random() * 5, play: Play | undefined, bound = 4
  let group: { kind: GroupKind; start: number; ids: string[]; started: Set<string>; variation: number } | undefined
  let playCount = 0
  let rosterKey = ''

  function act(a: SocialActor, pose: NootAction, duration = durations[pose] ?? 3, replay = false) {
    if (a.pose !== pose || replay) { a.pose = pose; a.eventId++ }
    a.until = clock + duration
  }
  function finishPlay() {
    if (play) for (const id of [play.a, play.b]) {
      const a = actors.get(id)
      if (a) { a.partner = undefined; a.target = a.home; if (!a.held && a.pose !== 'tumble') act(a, a.source.state.pose === 'play' ? 'play' : 'idle', Infinity) }
    }
    play = undefined; nextPlay = clock + 9 + random() * 12
  }
  function finishGroup() {
    if (!group) return
    for (const id of group.ids) {
      const a = actors.get(id)
      if (a) { a.partner = undefined; a.target = a.home; if (!a.held) act(a, a.source.state.pose === 'play' ? 'play' : 'idle', Infinity) }
    }
    group = undefined; nextPlay = clock + 9 + random() * 10
  }
  function groupInteract(kind: GroupKind) {
    finishPlay(); finishGroup()
    const ids = [...actors.values()].filter(a => !a.held && a.y < .02 && a.jumpAt === undefined).sort((a,b) => a.x-b.x).map(a => a.id)
    if (ids.length < 2) return false
    const variation = playCount++ % 3
    if (variation % 2) ids.reverse()
    group = { kind, ids, start: clock, started: new Set(), variation }
    return true
  }
  function interact(aId: string, bId: string, kind: PlayKind = 'high-five') {
    const a = actors.get(aId), b = actors.get(bId)
    if (!a || !b || a === b || a.held || b.held || a.y > .02 || b.y > .02 || a.jumpAt !== undefined || b.jumpAt !== undefined) return false
    // Contact scenes need a clear lane. Distant friends can still wave across the group.
    if (kind !== 'hello' && [...actors.values()].some(c => c !== a && c !== b && c.x > Math.min(a.x,b.x) && c.x < Math.max(a.x,b.x))) return false
    finishPlay(); finishGroup()
    play = { a: aId, b: bId, kind, start: clock, phase: -1, center: (a.x + b.x) / 2, sign: a.x < b.x ? 1 : -1, variation: playCount++ % 3 }
    a.partner = b.id; b.partner = a.id
    a.lastPlay = b.lastPlay = clock
    return true
  }
  function reconcile(participants: NootParticipant[]) {
    const nextRosterKey = JSON.stringify(participants.map(p => p.id))
    const reflow = rosterKey !== nextRosterKey
    if (reflow) { finishPlay(); finishGroup(); rosterKey = nextRosterKey }
    const ids = new Set(participants.map(p => p.id))
    for (const id of actors.keys()) if (!ids.has(id)) actors.delete(id)
    if (play && (!actors.has(play.a) || !actors.has(play.b))) finishPlay()
    bound = Math.max(3.5, (participants.length - 1) * 1.5 + 1.5)
    participants.forEach((p, i) => {
      const home = (i - (participants.length - 1) / 2) * 3
      let a = actors.get(p.id)
      if (!a) {
        a = { id: p.id, home, x: home, y: 0, vx: 0, vy: 0, target: home,
          yaw: 0, tilt: 0, tiltVelocity: 0, pose: 'idle', until: Infinity, eventId: 0,
          held: false, source: p, stateKey: '', eventKey: '', collisionAt: -10, dragAt: 0, squash: 1, landedAt: -10, lastPlay: -1 }
        actors.set(p.id, a)
      }
      a.source = p; a.home = home
      // A roster change is a stage layout change, not a physical collision.
      // Place new seats before simulating; otherwise new arrivals spawn inside old seats.
      if (reflow) Object.assign(a,{x:home,y:0,vx:0,vy:0,target:home,held:false,jumpAt:undefined,squash:1,yaw:0,tilt:0,tiltVelocity:0,partner:undefined})
    })
    // Populate the whole roster before resolving events that reference another member.
    participants.forEach(p => {
      const a = actors.get(p.id)!
      if (!a.partner && !a.held) a.target = a.home
      const key = `${p.state.pose}:${p.state.eventId ?? 0}`
      if (key !== a.stateKey) {
        a.stateKey = key
        if (!a.held && !a.partner && !group?.ids.includes(a.id) && a.jumpAt === undefined) act(a, p.state.pose, durations[p.state.pose] ?? Infinity, true)
      }
      const eventKey = p.event ? `${p.event.type}:${p.event.id}` : ''
      if (eventKey && eventKey !== a.eventKey) {
        a.eventKey = eventKey
        if (p.event?.type === 'greeting' && p.event.from) interact(p.event.from, p.id, 'hello')
        if (p.event?.type === 'success') {
          act(a, a.eventId % 2 ? 'victory-dance' : 'cheer', a.eventId % 2 ? 2.4 : 1.8, true)
          const friend = nearest(a)
          if (friend) { friend.partner = a.id; act(friend, 'wave-small', 2, true) }
        }
        if (p.event?.type === 'frustration') {
          act(a, 'angry', 2.8, true)
          const friend = nearest(a)
          if (friend) interact(friend.id, a.id, 'comfort')
        }
      }
    })
  }
  function nearest(a: SocialActor) {
    return [...actors.values()].filter(b => a !== b && !b.held && b.y < .02 && b.jumpAt === undefined).sort((b, c) => Math.abs(b.x - a.x) - Math.abs(c.x - a.x))[0]
  }
  function playStep() {
    if (!play) return
    const a = actors.get(play.a)!, b = actors.get(play.b)!, age = clock - play.start
    if (a.held || b.held || a.y > .1 || b.y > .1 || age > 12) { finishPlay(); return }
    // Hold the approach until both feet arrive. Never high-five empty air.
    if (play.phase === 1 && play.kind !== 'hello' && age >= 2.3 && (Math.abs(a.x-a.target) > .065 || Math.abs(b.x-b.target) > .065)) {
      if (age > 7) { finishPlay(); return }
      return
    }
    if (play.phase === 1 && age >= 2.3) play.start = clock - 2.3
    const actingAge = clock - play.start
    const danceExtension = play.kind === 'dance' ? 1.8 : 0
    if (actingAge > 8.2 + danceExtension) { finishPlay(); return }
    const phase = actingAge < .7 ? 0 : actingAge < 2.3 ? 1 : actingAge < 4.5 + danceExtension ? 2 : actingAge < 6.3 + danceExtension ? 3 : 4
    if (phase === play.phase) return
    play.phase = phase
    if (phase === 0) {
      act(a, 'wave-small', 2); act(b, play.kind === 'comfort' ? 'angry' : 'look-around', 2.5)
    } else if (phase === 1) {
      if (play.kind !== 'hello') {
        a.target = play.center - play.sign * 1.16; b.target = play.center + play.sign * 1.16
        act(a, 'walk', 8); act(b, 'walk', 8)
      } else { act(a, 'idle', 2); act(b, 'wave-small', 2, true) }
    } else if (phase === 2) {
      const poses: Record<PlayKind, [NootAction, NootAction]> = {
        hello: ['laugh', 'idle'], 'high-five': ['high-five', 'high-five'],
        boop: ['boop', play.variation === 1 ? 'shrug' : 'startled'], dance: [DANCE_POSES[play.variation], DANCE_POSES[(play.variation+1)%DANCE_POSES.length]], comfort: ['catch', 'shrug'],
      }
      act(a, poses[play.kind][0], 2.2 + danceExtension, true); act(b, poses[play.kind][1], 2.2 + danceExtension, true)
      for (const observer of actors.values()) if (observer !== a && observer !== b && !observer.held && observer.y < .02) {
        observer.partner = Math.abs(observer.x-a.x) < Math.abs(observer.x-b.x) ? a.id : b.id
        act(observer, play.kind === 'dance' ? 'groove' : 'wave-small', 2.8, true)
      }
    } else if (phase === 3) {
      act(a, 'laugh', 1.8); act(b, play.kind === 'comfort' ? 'wave-small' : 'laugh', 1.8)
    } else {
      a.target = a.home; b.target = b.home
      act(a, 'walk', 1.9); act(b, 'walk', 1.9)
    }
  }
  function groupStep() {
    if (!group) return
    group.ids = group.ids.filter(id => actors.has(id) && !actors.get(id)!.held)
    const age = clock-group.start
    if (group.ids.length < 2 || age > (group.kind === 'wave-chain' ? group.ids.length*.55+3 : 16)) { finishGroup(); return }
    group.ids.forEach((id,i) => {
      const a = actors.get(id)!
      if (age < i*(group!.kind === 'wave-chain' ? .55 : .16) || group!.started.has(id)) return
      group!.started.add(id); a.lastPlay = clock
      a.partner = group!.kind === 'wave-chain' ? group!.ids[(i+1)%group!.ids.length] : undefined
      act(a, group!.kind === 'wave-chain' ? 'wave-small' : DANCE_POSES[(i+group!.variation)%DANCE_POSES.length], group!.kind === 'wave-chain' ? 2.4 : 16-age, true)
    })
  }
  function step(dt: number, participants: NootParticipant[], reduced = false, automatic = true) {
    reconcile(participants)
    if (reduced) {
      finishPlay(); finishGroup()
      for (const a of actors.values()) Object.assign(a, { x: a.home, y: 0, vx: 0, vy: 0, yaw: 0, tilt: 0, tiltVelocity: 0, held: false, partner: undefined, jumpAt: undefined, squash: 1 })
      return
    }
    if (dt <= 0) return
    dt = Math.min(dt, .1); clock += dt
    if (automatic && !play && !group && clock > nextPlay && actors.size > 1) {
      const available = [...actors.values()].filter(a => !a.held && a.y < .02 && a.pose !== 'tumble' && a.jumpAt === undefined)
      if (available.length > 1) {
        if (available.length > 2 && playCount % 3 === 2) groupInteract(playCount % 2 ? 'group-dance' : 'wave-chain')
        else {
          const a = available.sort((a,b) => a.lastPlay-b.lastPlay)[0], b = nearest(a)
          if (b) interact(a.id, b.id, (['hello', 'high-five', 'boop', 'dance'] as const)[Math.floor(random() * 4)])
        }
      }
      nextPlay = clock + 12
    }
    playStep()
    groupStep()
    for (const a of actors.values()) {
      if (a.jumpAt !== undefined && clock >= a.jumpAt && a.y === 0) { a.vy = 4.3; a.y = .001 }
      const friend = a.partner ? actors.get(a.partner) : undefined
      const wantsToWalk = !a.held && ['walk', 'idle', 'play'].includes(a.pose) && Math.abs(a.target - a.x) > .08
      const desiredYaw = wantsToWalk ? Math.sign(a.target - a.x) * 1.5 : friend ? Math.sign(friend.x - a.x) * (a.pose === 'high-five' ? .72 : a.pose === 'wave-small' ? .55 : (DANCE_POSES as readonly string[]).includes(a.pose) ? .40 : 1.15) : 0
      a.yaw += (desiredYaw - a.yaw) * (1 - Math.exp(-dt * 4))
    }
    const steps = Math.ceil(dt / .008), h = dt / steps
    for (let i = 0; i < steps; i++) {
      for (const a of actors.values()) {
        if (!a.held) {
          const canWalk = a.y < .02 && a.jumpAt === undefined && ['walk', 'idle', 'play'].includes(a.pose)
          let speed = canWalk ? clamp((a.target - a.x) * 1.8, -.62, .62) : 0
          if (Math.abs(Math.sign(speed) * 1.5 - a.yaw) > .7) speed *= .15
          a.vx += (speed - a.vx) * Math.min(1, h * (a.y > .02 ? .6 : 5.5))
          a.vy -= 10 * h
          a.x += a.vx * h; a.y += a.vy * h
          if (a.y < 0) {
            const impact = -a.vy; a.y = 0
            const jumping = a.jumpAt !== undefined && clock >= a.jumpAt
            a.vy = jumping ? 0 : impact > 1.8 ? impact * .16 : 0
            if (impact > 1.8) a.landedAt = clock
            if (jumping) a.jumpAt = undefined
            if (!jumping && impact > 2.2 && clock - a.collisionAt > 1.4) {
              a.collisionAt = clock; act(a, impact > 4 ? 'tumble' : 'startled', impact > 4 ? 2.8 : 1.1, true)
              const friend = nearest(a)
              if (friend && Math.abs(friend.x - a.x) < 3.8) { friend.partner = a.id; act(friend, 'catch', 1.8, true) }
            }
          }
          a.x = clamp(a.x, -bound, bound)
        }
        const tiltTarget = a.held ? clamp(a.vx * -.075, -.22, .22) : clamp(-a.vx * .035, -.05, .05)
        a.tiltVelocity += (65 * (tiltTarget - a.tilt) - 14 * a.tiltVelocity) * h
        a.tilt += a.tiltVelocity * h
      }
      const list = [...actors.values()]
      for (let aIndex = 0; aIndex < list.length; aIndex++) for (let bIndex = aIndex + 1; bIndex < list.length; bIndex++) {
        const a = list[aIndex], b = list[bIndex]
        const dx = b.x - a.x
        const ay = clamp(b.y + 1.5, a.y + .95, a.y + 2.05)
        const by = clamp(ay, b.y + .95, b.y + 2.05)
        const dy = by - ay, distance = Math.hypot(dx, dy), clearance = 1.90
        if (distance >= clearance || a.held && b.held) continue
        // Resolve sideways on this single-depth stage: characters must never become platforms.
        const nx = Math.abs(dx) > .001 ? Math.sign(dx) : a.home <= b.home ? 1 : -1, ny = 0
        const wa = a.held ? 0 : b.held ? 1 : .5, wb = b.held ? 0 : a.held ? 1 : .5
        const correction = Math.sqrt(Math.max(0,clearance*clearance-dy*dy)) - Math.abs(dx)
        a.x -= nx * correction * wa; a.y = Math.max(0, a.y - ny * correction * wa)
        b.x += nx * correction * wb; b.y = Math.max(0, b.y + ny * correction * wb)
        const velocity = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny
        if (velocity < 0) {
          const impulse = -velocity * 1.15
          a.vx -= impulse * nx * wa; a.vy -= impulse * ny * wa
          b.vx += impulse * nx * wb; b.vy += impulse * ny * wb
          if (-velocity > 1.2 && clock - Math.max(a.collisionAt, b.collisionAt) > 1.2) {
            a.collisionAt = b.collisionAt = clock
            if (!a.held) act(a, 'startled', 1.1, true)
            if (!b.held) act(b, 'catch', 1.8, true)
          }
        }
      }
    }
    for (const a of actors.values()) {
      const anticipation = a.jumpAt !== undefined && clock < a.jumpAt ? Math.sin(Math.PI * clamp((a.jumpAt-clock)/.22,0,1)) * .10 : 0
      const landing = clock-a.landedAt
      const targetSquash = 1-anticipation-(landing < .35 ? .12*Math.sin(Math.PI*landing/.35) : 0)+(a.y > .02 && a.vy > 1 ? .035 : 0)
      a.squash += (targetSquash-a.squash)*(1-Math.exp(-dt*25))
      if (!a.held && clock > a.until) {
        act(a, a.source.state.pose === 'play' ? 'play' : 'idle', Infinity)
        if (!play || ![play.a, play.b].includes(a.id)) a.partner = undefined
      }
      if (a.pose === 'walk' && Math.abs(a.target - a.x) < .05) act(a, 'idle', .8)
    }
  }
  function lift(id: string) {
    const a = actors.get(id); if (!a) return
    finishPlay(); finishGroup(); a.jumpAt = undefined; a.held = true; a.vx = a.vy = 0; a.dragAt = clock
    act(a, 'startled', Infinity, true)
  }
  function drag(id: string, x: number, y: number) {
    const a = actors.get(id); if (!a?.held) return
    const elapsed = Math.max(.016, clock - a.dragAt)
    x = clamp(x, -bound, bound); y = clamp(y, 0, 2.8)
    a.vx = clamp((x - a.x) / elapsed, -2.5, 2.5); a.vy = clamp((y - a.y) / elapsed, -3.5, 3.5)
    a.x = x; a.y = y; a.dragAt = clock
  }
  function drop(id: string) {
    const a = actors.get(id); if (!a?.held) return
    a.held = false; a.vy = Math.min(1, a.vy); a.target = a.home
    act(a, 'startled', 1.1, true)
  }
  function jump(id: string) {
    const a = actors.get(id); if (!a || a.held || a.y > .02 || a.jumpAt !== undefined) return false
    finishPlay(); finishGroup(); a.jumpAt = clock+.22; a.vx = a.vy = 0
    act(a, 'jump', 1.5, true)
    return true
  }
  function stateFor(a: SocialActor): NootState {
    const friend = a.partner ? actors.get(a.partner) : undefined
    return { ...a.source.state, variant: a.id, pose: a.pose, eventId: a.eventId, directed: true,
      danceTime: group?.kind === 'group-dance' ? Math.max(0,clock-group.start) : play?.kind === 'dance' ? Math.max(0,clock-play.start-2.3) : undefined,
      interactionHand: a.pose === 'high-five' && friend ? friend.x > a.x ? 'R' : 'L' : undefined,
      travelSpeed: a.pose === 'walk' || a.pose === 'run' ? Math.abs(a.vx) : undefined,
      lookAt: friend ? { x: Math.sin(Math.sign(friend.x - a.x) * Math.PI / 2 - a.yaw), y: clamp((friend.y - a.y) * .3, -.7, .7) } : undefined }
  }
  return { actors, step, interact, groupInteract, lift, drag, drop, jump, stateFor, get time() { return clock }, get bounds() { return bound }, get activePlay() { return play?.kind ?? group?.kind } }
}
