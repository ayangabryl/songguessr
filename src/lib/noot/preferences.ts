import { useMemo, useSyncExternalStore } from 'react'
import type { NootHeadgear, NootMood } from './types'

interface Preferences { headgear: NootHeadgear; mood: NootMood }
const KEY = 'songguessr-noot', EVENT = 'noot-preferences'
let memory = ''
function snapshot() { try { return localStorage.getItem(KEY) ?? memory } catch { return memory } }
function subscribe(callback: () => void) {
  window.addEventListener('storage', callback); window.addEventListener(EVENT, callback)
  return () => { window.removeEventListener('storage', callback); window.removeEventListener(EVENT, callback) }
}
function parse(raw: string): Preferences {
  let value: Partial<Preferences> = {}
  try { value = JSON.parse(raw) ?? {} } catch { /* First visit. */ }
  return {
    headgear: ['headphones','cat-earphones','daisy','none'].includes(value.headgear ?? '') ? value.headgear! : 'headphones',
    mood: ['chill','happy','sad','dance'].includes(value.mood ?? '') ? value.mood! : 'chill',
  }
}
export function useNootPreferences() {
  const raw = useSyncExternalStore(subscribe, snapshot, () => '')
  const preferences = useMemo(() => parse(raw), [raw])
  function update(change: Partial<Preferences>) {
    memory = JSON.stringify({ ...parse(snapshot()), ...change })
    try { localStorage.setItem(KEY, memory) } catch { /* Keep the session choice when storage is unavailable. */ }
    window.dispatchEvent(new Event(EVENT))
  }
  return [preferences, update] as const
}
