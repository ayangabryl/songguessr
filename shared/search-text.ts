/** Fold punctuation so can't, cant, and Can’t compare as the same search. */
export function foldSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[''`´‘’‚‛]/g, '')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function searchTerms(query: string): string[] {
  return foldSearchText(query).split(' ').filter(Boolean).slice(0, 8)
}

export function searchHitScore(query: string, title: string, artist: string): number {
  const q = foldSearchText(query)
  if (!q) return 0
  const titleFold = foldSearchText(title)
  const artistFold = foldSearchText(artist)
  if (titleFold === q) return 100
  if (titleFold.startsWith(q)) return 80
  if (` ${titleFold} `.includes(` ${q} `)) return 70
  if (titleFold.includes(q)) return 60
  if (artistFold === q || artistFold.startsWith(q)) return 50
  if (artistFold.includes(q)) return 40
  const terms = q.split(' ')
  if (terms.every((term) => titleFold.includes(term) || artistFold.includes(term))) return 30
  return 0
}

export function rankSearchHits<T>(
  query: string,
  items: T[],
  titleOf: (item: T) => string,
  artistOf: (item: T) => string,
): T[] {
  return items
    .map((item, index) => ({
      item,
      index,
      score: searchHitScore(query, titleOf(item), artistOf(item)),
    }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((row) => row.item)
}

/** SQLite expression that strips apostrophes so LIKE '%cant%' hits "Can't". */
export function sqlFoldExpr(column: string): string {
  let expr = `lower(${column})`
  for (const code of [39, 8216, 8217, 8218, 96, 180]) {
    expr = `replace(${expr}, char(${code}), '')`
  }
  for (const code of [45, 46, 44, 47, 63, 33, 58, 59]) {
    expr = `replace(${expr}, char(${code}), ' ')`
  }
  return expr
}
