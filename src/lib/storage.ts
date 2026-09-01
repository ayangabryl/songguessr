/** Read a key, falling back to legacy keys and migrating the first hit once. */
export function readMigratedItem(
  storage: Storage,
  key: string,
  legacyKeys: string[],
): string | null {
  const current = storage.getItem(key)
  if (current !== null) return current

  for (const legacyKey of legacyKeys) {
    const legacy = storage.getItem(legacyKey)
    if (legacy === null) continue
    storage.setItem(key, legacy)
    storage.removeItem(legacyKey)
    return legacy
  }

  return null
}

export function removeMigratedItem(storage: Storage, key: string, legacyKeys: string[]) {
  storage.removeItem(key)
  for (const legacyKey of legacyKeys) storage.removeItem(legacyKey)
}
