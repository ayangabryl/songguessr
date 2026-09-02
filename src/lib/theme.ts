import { readMigratedItem } from './storage'

export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

const THEME_KEY = 'songguessr-theme'
const LEGACY_THEME_KEY = 'songgussr-theme'

export function loadThemePreference(): ThemePreference {
  try {
    const raw = readMigratedItem(localStorage, THEME_KEY, [LEGACY_THEME_KEY])
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw
  } catch {
    // Private mode: follow the system theme.
  }
  return 'system'
}

export function saveThemePreference(preference: ThemePreference) {
  try {
    localStorage.setItem(THEME_KEY, preference)
  } catch {
    // Private mode or quota: keep the in-memory preference only.
  }
}

export function systemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function resolveTheme(preference: ThemePreference, systemDark = systemPrefersDark()): ResolvedTheme {
  if (preference === 'system') return systemDark ? 'dark' : 'light'
  return preference
}

export function applyResolvedTheme(theme: ResolvedTheme) {
  const root = document.documentElement
  root.dataset.theme = theme
  root.style.colorScheme = theme
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    meta.setAttribute('content', theme === 'dark' ? '#0b1209' : '#eef6e8')
  }
}
