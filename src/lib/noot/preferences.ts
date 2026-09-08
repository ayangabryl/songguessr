import { useMemo, useSyncExternalStore } from 'react'
import { createPreferenceStore, parsePreferences, type NootPreferences } from './preference-store'

const KEY = 'songguessr-noot', EVENT = 'noot-preferences'
const store = createPreferenceStore(() => localStorage.getItem(KEY), raw => localStorage.setItem(KEY, raw))
// Include persistence in the stable snapshot so a successful retry of the same
// outfit also refreshes the save indicator.
const snapshot = () => { const raw = store.snapshot(); return `${store.persisted ? '1' : '0'}${raw}` }
function subscribe(callback: () => void) {
  const storage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== KEY) return
    store.received(event.newValue); callback()
  }
  window.addEventListener('storage', storage); window.addEventListener(EVENT, callback)
  return () => { window.removeEventListener('storage', storage); window.removeEventListener(EVENT, callback) }
}
export function useNootPreferences() {
  const raw = useSyncExternalStore(subscribe, snapshot, () => '')
  const preferences = useMemo(() => parsePreferences(raw.slice(1)), [raw])
  const persisted = raw[0] !== '0'
  function update(change: Partial<NootPreferences>) {
    store.update(change)
    window.dispatchEvent(new Event(EVENT))
  }
  return [preferences, update, persisted] as const
}
