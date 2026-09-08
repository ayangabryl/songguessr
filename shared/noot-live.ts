export type NootMotionAction = 'lift' | 'drag' | 'drop' | 'jump'
export interface NootMotion {
  type: 'pet-motion'; actor: string; action: NootMotionAction; seq: number
  x: number; y: number; vx: number; vy: number
}
export interface NootMotionEvent extends NootMotion { from: string; at: number }
export interface NootSocialEvent {
  type: 'pet-social'; at: number; actor: string; friend: string
  action: 'hello' | 'high-five' | 'boop' | 'dance' | 'group-dance' | 'wave-chain'
}
export type NootLiveEvent = NootMotionEvent | NootSocialEvent
export function parseNootMotion(value: unknown): NootMotion | null {
  if (!value || typeof value !== 'object') return null
  const m = value as Record<string, unknown>
  if (m.type !== 'pet-motion' || typeof m.actor !== 'string' || m.actor.length > 80 || !['lift','drag','drop','jump'].includes(String(m.action))) return null
  if (!Number.isSafeInteger(m.seq) || Number(m.seq) < 0) return null
  for (const key of ['x','y','vx','vy']) if (typeof m[key] !== 'number' || !Number.isFinite(m[key])) return null
  const clamp = (n: unknown, low: number, high: number) => Math.max(low, Math.min(high, Number(n)))
  return {type: 'pet-motion', actor: m.actor, action: m.action as NootMotionAction, seq: Number(m.seq),
    x: clamp(m.x,-18,18), y: clamp(m.y,0,2.8), vx: clamp(m.vx,-2.5,2.5), vy: clamp(m.vy,-3.5,3.5)}
}

/** Short leases arbitrate concurrent grabs; motion stays ephemeral, never a score write. */
export function createNootRelay() {
  const held = new Map<string, NootMotionEvent>()
  const last = new Map<string, {seq: number; at: number}>()
  function accept(from: string, motion: NootMotion, members: string[], now: number): NootMotionEvent | null {
    if (!members.includes(from) || !members.includes(motion.actor)) return null
    const previous = last.get(from)
    if (previous && (motion.seq <= previous.seq || motion.action === 'drag' && now - previous.at < 45)) return null
    const lease = held.get(motion.actor)
    if (lease && now - lease.at < 2500 && lease.from !== from) return null
    if (motion.action === 'drag' && (!lease || lease.from !== from)) return null
    const event = {...motion, from, at: now}
    last.set(from, {seq: motion.seq, at: now})
    if (motion.action === 'lift' || motion.action === 'drag') held.set(motion.actor, event)
    else held.delete(motion.actor)
    return event
  }
  function release(from: string, now: number) {
    const events: NootMotionEvent[] = []
    for (const [actor, event] of held) if (event.from === from || event.actor === from || now-event.at >= 2500) {
      held.delete(actor); events.push({...event, action:'drop', at:now, vx:0, vy:0})
    }
    last.delete(from)
    return events
  }
  function snapshot(now: number) { return [...held.values()].filter(event => now-event.at < 2500) }
  return {accept, release, snapshot}
}
