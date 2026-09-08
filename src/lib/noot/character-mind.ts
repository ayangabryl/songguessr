import { blinkAmount, smooth, spring } from './motion.ts'
import type { NootState } from './types.ts'

export function seededRandom(identity: string) {
  let seed = 2166136261
  for (const char of identity) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619)
  return () => {
    seed += 0x6D2B79F5
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
    t ^= t + Math.imul(t ^ t >>> 7, 61 | t)
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

/** Attention and quiet intervals choose the acting; clips retain ownership of poses. */
export function createCharacterMind(identity: string) {
  const random = seededRandom(identity)
  const curiosity = .75 + random() * .5
  const cadence = .92 + random() * .16
  let clock = 0, nextBlink = 1.1 + random() * 3.1, blinkAt = -10
  let nextLook = 1 + random() * 2, lookX = 0, lookY = 0
  let nextFidget = 4 + random() * 6, fidgetUntil = 0, fidget = ''
  let lastFidget = '', signature = '', actionAge = 0, doubleBlink = false
  const x = spring(0, 3.8, .95), y = spring(0, 4.1, 1)
  const fidgets = [
    { clip: 'LookAround', duration: 5.2 }, { clip: 'Stretch', duration: 3.2 },
    { clip: 'WaveSmall', duration: 2 }, { clip: 'Listen', duration: 4 },
    { clip: 'Yawn', duration: 3.4 },
  ]
  const phase = random() * Math.PI * 2
  let result = { blink: 0, blinkRight: 0, lookX: 0, lookY: 0, clip: '', cadence, tilt: 0, tail: 0, actionAge: 0 }
  return {
    step(dt: number, state: NootState, pointer: { x: number; y: number }, reduced: boolean) {
      const key = `${state.pose}:${state.eventId ?? 0}`
      if (key !== signature) {
        signature = key; actionAge = 0; fidget = ''; fidgetUntil = 0
        nextFidget = clock + 4 + random() * 7
      }
      if (reduced) return { ...result, blink: 0, blinkRight: 0, lookX: 0, lookY: 0, clip: '', tilt: 0, tail: 0 }
      if (dt <= 0) return result
      clock += dt; actionAge += dt
      if (clock >= nextBlink) {
        blinkAt = clock
        const quickPair = !doubleBlink && random() < .16
        nextBlink = clock + (quickPair ? .38 + random() * .12 : 2.1 + random() * 4.6)
        doubleBlink = quickPair
      }
      if (clock >= nextLook) {
        lookX = (random() * 2 - 1) * .50 * curiosity
        lookY = (random() * 2 - 1) * .22
        nextLook = clock + .9 + random() * 3.2
      }
      const canFidget = (state.pose === 'idle' || state.pose === 'play' && (!state.mood || state.mood === 'chill')) && !state.lookAt
      if (canFidget && clock >= nextFidget) {
        const signatures = outfitGestures(state)
        const choices = [...fidgets.filter(choice => choice.clip !== 'Listen'),...signatures].filter(choice => choice.clip !== lastFidget)
        const choice = choices[Math.floor(random() * choices.length)]
        fidget = choice.clip; lastFidget = fidget; fidgetUntil = clock + choice.duration
        nextFidget = fidgetUntil + 4.5 + random() * 8
      }
      if (clock >= fidgetUntil || !canFidget) fidget = ''
      const attending = Math.hypot(pointer.x, pointer.y) > .04
      const attentionX = state.lookAt?.x ?? (attending ? pointer.x : lookX)
      const attentionY = state.lookAt?.y ?? (attending ? pointer.y : lookY)
      const gazeX = x.step(Math.max(-1, Math.min(1, attentionX)), dt)
      const gazeY = y.step(Math.max(-1, Math.min(1, attentionY)), dt)
      result = {
        blink: blinkAmount(clock - blinkAt), blinkRight: blinkAmount(clock - blinkAt - .008), lookX: gazeX, lookY: gazeY,
        clip: fidget, cadence, actionAge,
        tilt: Math.sin(clock * .83 + phase) * .009 + gazeX * .012,
        tail: Math.sin(clock * 1.13 + phase) * .027 + gazeX * .025,
      }
      return result
    },
  }
}

export const closingCrease = (blink: number) => smooth((blink - .83) / .17)

export function outfitGestures(state: NootState) {
  const choices: {clip:string;duration:number}[] = []
  if (['beanie','bucket','daisy'].includes(state.headgear ?? '')) choices.push({clip:'HatTip',duration:2.8})
  else if (!state.headgear || ['headphones','cat-earphones'].includes(state.headgear)) choices.push({clip:'Listen',duration:4})
  if(state.clothing === 'shirt') choices.push({clip:'TeeTug',duration:2.4})
  else if(state.clothing && state.clothing !== 'none') choices.push({clip:'FabricCheck',duration:2.6})
  return choices
}
