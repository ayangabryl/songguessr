import { Howl } from 'howler'
import { loadVolume } from './game-state'
const tap = new Howl({ src: ['/audio/ui-tap.wav'], volume: 0.18, preload: true })
export function buttonSoundsEnabled() {
  try { return localStorage.getItem('songguessr-button-sounds') !== 'off' } catch { return true }
}
export function setButtonSounds(enabled: boolean) {
  try { localStorage.setItem('songguessr-button-sounds', enabled ? 'on' : 'off') } catch { /* Session storage may be unavailable. */ }
  if (!enabled) tap.stop()
}
export function installButtonSounds() {
  let last = 0
  const click = (event: MouseEvent) => {
    const button = event.target instanceof Element ? event.target.closest('button') : null
    if (!button || button.disabled || !buttonSoundsEnabled()) return
    // Keep listening and answer submission free of extra audio.
    if (!button.closest('.level-switch, .profile-options, .bar-tools, .settings-sheet-head') || document.querySelector('.transport-row.is-playing')) return
    if (performance.now() - last < 80) return
    last = performance.now()
    let volume = 1
    try { volume = loadVolume() } catch { /* Default when storage is unavailable. */ }
    tap.volume(volume * 0.18)
    tap.stop()
    tap.play()
  }
  document.addEventListener('click', click)
  return () => { document.removeEventListener('click', click); tap.stop() }
}
