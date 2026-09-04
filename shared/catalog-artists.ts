export const MIX_SINGER_LIMIT = 5

export function rankByArtistPopularity<T extends { name: string; popularity?: number | null }>(
  artists: T[],
  cap = MIX_SINGER_LIMIT,
): T[] {
  const seen = new Set<string>()
  return [...artists]
    .sort((left, right) => {
      const score = (value: number | null | undefined) =>
        value == null ? Number.NEGATIVE_INFINITY : value
      const byPop = score(right.popularity) - score(left.popularity)
      if (byPop !== 0) return byPop
      return left.name.localeCompare(right.name)
    })
    .filter((artist) => {
      const key = artist.name.trim().toLowerCase()
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, cap)
}

export function uniqueArtistsByFame(
  rows: Array<{ artist: string; artistPopularity?: number | null }>,
  cap = MIX_SINGER_LIMIT,
): Array<{ name: string; popularity: number | null }> {
  const best = new Map<string, { name: string; popularity: number | null }>()
  for (const row of rows) {
    const token = row.artist.split(',')[0]?.trim()
    if (!token) continue
    const key = token.toLowerCase()
    const pop = row.artistPopularity ?? null
    const current = best.get(key)
    if (!current || (pop ?? -1) > (current.popularity ?? -1)) {
      best.set(key, { name: token, popularity: pop })
    }
  }
  return rankByArtistPopularity([...best.values()], cap)
}

export function mergeSingerRows<T extends { name: string; imageUrl?: string | null }>(
  hits: T[],
  selectedNames: string[],
  known: Map<string, T>,
): T[] {
  const rows = [...hits]
  for (const name of [...selectedNames].reverse()) {
    const key = name.toLowerCase()
    if (rows.some((hit) => hit.name.toLowerCase() === key)) continue
    rows.unshift(known.get(key) ?? ({ name } as T))
  }
  return rows
}
