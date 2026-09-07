import { defineSound, ensureReady, type VoiceHandle } from '@web-kits/audio'
import { loadVolume } from './game-state'

const clickSound = defineSound({
  source: { type: 'sine', frequency: { start: 440, end: 720 } },
  envelope: { attack: 0.002, decay: 0.035, sustain: 0, release: 0.015 }, gain: 0.12,
})
const hoverSound = defineSound({
  source: { type: 'sine', frequency: { start: 760, end: 620 } },
  envelope: { attack: 0.003, decay: 0.018, sustain: 0, release: 0.012 }, gain: 0.045,
})
let enabledOverride: boolean | undefined
let voice: VoiceHandle | undefined
export function buttonSoundsEnabled() {
  if (enabledOverride !== undefined) return enabledOverride
  try { return localStorage.getItem('songguessr-button-sounds') !== 'off' } catch { return true }
}
export function setButtonSounds(enabled: boolean) {
  enabledOverride = enabled
  try { localStorage.setItem('songguessr-button-sounds', enabled ? 'on' : 'off') } catch { /* Keep session preference. */ }
  if (!enabled) voice?.stop()
}
export function installButtonSounds() {
  let lastHover = 0, lastClick = 0, unlocked = false, active = true
  const busy = () => Boolean(document.querySelector('.transport-row.is-playing, [data-sound-playing="true"]'))
  const control = (event: Event) => {
    const element = event.target instanceof Element ? event.target.closest<HTMLElement>('button, [role="option"], select') : null
    if (!element || element.matches(':disabled, [aria-disabled="true"]') || !element.closest('.app-shell')) return null
    // Audio and answer controls must never mask a tiny song clip.
    if (element.closest('.match-controls, .match-album, .match-reveal-play, .transport-row, .suggestions, .match-suggestions')) return null
    return element
  }
  const sound = (hover: boolean) => {
    if (!active || !buttonSoundsEnabled() || busy()) return
    let volume = 1
    try { volume = loadVolume() } catch { /* Use default volume without storage. */ }
    if (!volume) return
    voice?.stop()
    voice = (hover ? hoverSound : clickSound)({volume})
  }
  const unlock = () => { void ensureReady().then(()=>{if(active) unlocked=true}).catch(()=>{}) }
  const click = (event: MouseEvent) => {
    if (!control(event) || !buttonSoundsEnabled() || busy()) return
    const now = performance.now()
    if (now-lastClick < 80) return
    lastClick=now
    void ensureReady().then(()=>{if(active) {unlocked=true; sound(false)}}).catch(()=>{})
  }
  const hover = (event: PointerEvent) => {
    if (!unlocked || event.pointerType !== 'mouse') return
    const element = control(event)
    if (!element || (event.relatedTarget instanceof Node && element.contains(event.relatedTarget))) return
    const now = performance.now()
    if (now-lastHover < 140) return
    lastHover=now
    sound(true)
  }
  document.addEventListener('pointerdown', unlock, {once:true})
  document.addEventListener('click', click, true)
  document.addEventListener('pointerover', hover)
  return () => { active=false; voice?.stop(); document.removeEventListener('pointerdown',unlock); document.removeEventListener('click',click,true); document.removeEventListener('pointerover',hover) }
}
