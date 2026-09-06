/** Allow a small spelling mistake, but never expand very short queries. */
export function artistWordDistance(query: string, word: string): number {
  if (query.length < 4 || Math.abs(query.length - word.length) > 2) return Infinity
  let row = Array.from({ length: word.length + 1 }, (_, i) => i)
  for (let i = 1; i <= query.length; i++) {
    const next = [i]
    for (let j = 1; j <= word.length; j++)
      next[j] = Math.min(next[j - 1] + 1, row[j] + 1, row[j - 1] + Number(query[i - 1] !== word[j - 1]))
    row = next
  }
  return row[word.length] <= (query.length >= 5 ? 2 : 1) ? row[word.length] / Math.max(query.length, word.length) : Infinity
}

export function closeArtistWord(query: string, word: string): boolean { return Number.isFinite(artistWordDistance(query, word)) }
