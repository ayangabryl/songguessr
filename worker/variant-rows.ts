import { compareVariants, songIdentityKey } from './track-dedupe'
import type { Track } from './types'

const MAX_IN_PARAMS = 80

export interface CatalogVariantRow {
  id: string
  title: string
  artist: string
  playCount: number | null
  popularity: number | null
  albumArt: string | null
  previewUrl: string | null
}

interface VariantRowRecord {
  id: string
  title: string
  artist: string
  song_key: string | null
  play_count: number | null
  popularity: number | null
  album_art: string | null
  preview_url: string | null
}

const SELECT_COLUMNS = 'id, title, artist, song_key, play_count, popularity, album_art, preview_url'

function toVariantRow(record: VariantRowRecord): CatalogVariantRow {
  return {
    id: record.id,
    title: record.title,
    artist: record.artist,
    playCount: record.play_count,
    popularity: record.popularity,
    albumArt: record.album_art,
    previewUrl: record.preview_url,
  }
}

async function selectIn(
  db: D1Database,
  column: string,
  values: string[],
): Promise<VariantRowRecord[]> {
  const rows: VariantRowRecord[] = []
  for (let index = 0; index < values.length; index += MAX_IN_PARAMS) {
    const batch = values.slice(index, index + MAX_IN_PARAMS)
    const result = await db
      .prepare(`SELECT ${SELECT_COLUMNS} FROM tracks WHERE ${column} IN (${batch.map(() => '?').join(', ')})`)
      .bind(...batch)
      .all<VariantRowRecord>()
    rows.push(...(result.results ?? []))
  }
  return rows
}

/**
 * Catalogue rows that are the same song as one of `tracks`, keyed by identity.
 *
 * Looks up both the stored `song_key` and the raw title: a row written before
 * the canonicalizer learned a qualifier still carries the old key, and the
 * title probe is what catches it. The identity is always recomputed here, so
 * the returned map reflects current canonicalization rather than the column.
 *
 * When D1 still holds several recordings of one song, the best of them wins the
 * slot, so callers compare an incoming track against the row worth keeping.
 */
export async function findVariantRowsByIdentity(
  db: D1Database,
  tracks: Array<Pick<Track, 'title' | 'artist'>>,
): Promise<Map<string, CatalogVariantRow>> {
  const best = new Map<string, CatalogVariantRow>()
  if (tracks.length === 0) return best

  const wanted = new Set(tracks.map((track) => songIdentityKey(track)).filter((key) => key.length > 1))
  if (wanted.size === 0) return best

  const titles = [...new Set(tracks.map((track) => track.title.trim().toLowerCase()).filter(Boolean))]

  const records = [
    ...(await selectIn(db, 'song_key', [...wanted])),
    ...(titles.length > 0 ? await selectIn(db, 'lower(title)', titles) : []),
  ]

  for (const record of records) {
    const key = songIdentityKey(record)
    if (!wanted.has(key)) continue
    const row = toVariantRow(record)
    const current = best.get(key)
    if (!current || compareVariants(row, current) < 0) {
      best.set(key, row)
    }
  }

  return best
}
