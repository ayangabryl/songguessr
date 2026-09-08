import type { NootLiveEvent, NootMotion } from '../../../shared/noot-live.ts'
export interface NootLiveChannel {
  send: (motion: Omit<NootMotion, 'type' | 'seq'>) => void
  subscribe: (listener: (event: NootLiveEvent) => void) => () => void
}
/** Fast cosmetic packets bypass React's board state and local-storage writes. */
export function createNootLiveChannel(send: (packet: NootMotion) => void, self: string) {
  const listeners = new Set<(event: NootLiveEvent) => void>()
  const held = new Map<string, {event:NootLiveEvent; receivedAt:number}>()
  let seq = 0, lastDrag = 0
  return {
    send(motion: Omit<NootMotion, 'type' | 'seq'>) {
      const now = Date.now()
      if (motion.action === 'drag' && now-lastDrag < 60) return
      if (motion.action === 'drag') lastDrag = now
      send({...motion, type:'pet-motion', seq: seq++})
    },
    receive(event: NootLiveEvent) {
      if (event.type === 'pet-motion') {
        if (event.action === 'lift' || event.action === 'drag') held.set(event.actor,{event,receivedAt:Date.now()})
        else held.delete(event.actor)
        if (event.from === self) return
      }
      for (const listener of listeners) listener(event)
    },
    subscribe(listener: (event: NootLiveEvent) => void) {
      listeners.add(listener)
      for (const {event, receivedAt} of held.values()) if (Date.now()-receivedAt < 2500) listener(event)
      return () => { listeners.delete(listener) }
    },
    reset() {
      for (const {event} of held.values()) if (event.type === 'pet-motion') {
        const drop: NootLiveEvent = {...event, action:'drop', vx:0, vy:0}
        for (const listener of listeners) listener(drop)
      }
      held.clear()
    },
  }
}
