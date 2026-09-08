import { parseAppearance, type NootAppearance } from '../../../shared/noot-profile.ts'
import type { NootMood } from './types.ts'

export interface NootPreferences extends NootAppearance { mood: NootMood }
export function parsePreferences(raw: string): NootPreferences {
  let value: Record<string, unknown> = {}
  try { const parsed = JSON.parse(raw); if (parsed && typeof parsed === 'object') value = parsed } catch { /* First visit or damaged storage. */ }
  return {
    ...parseAppearance(value),
    mood: ['chill', 'happy', 'sad', 'dance'].includes(String(value.mood)) ? value.mood as NootMood : 'chill',
  }
}

/** A rejected write must not let an older stored outfit undo the session choice. */
export function createPreferenceStore(read: () => string | null, write: (raw: string) => void) {
  let memory = '', unsaved = false
  return {
    get persisted() { return !unsaved },
    snapshot() {
      if (!unsaved) { try { memory = read() ?? '' } catch { /* Use the last known choice. */ } }
      return memory
    },
    update(change: Partial<NootPreferences>) {
      memory = JSON.stringify(parsePreferences(JSON.stringify({ ...parsePreferences(this.snapshot()), ...change })))
      unsaved = true
      try { write(memory); unsaved = false } catch { /* Keep this session's choice and retry on the next edit. */ }
    },
    received(raw: string | null) { memory = raw ?? ''; unsaved = false },
  }
}
