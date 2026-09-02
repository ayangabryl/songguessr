import {
  DEFAULT_COUNTRY,
  type CountryCode,
  isCountryCode,
} from '../shared/catalog-meta'
import { normalizeName, UNIQUE_OPM_ARTISTS, type SpotifyTrackRef } from './opm-artists'
import { isBlockedNonOpmArtist } from './playlist-source'
import type { Env } from './types'
import { CatalogUnavailableError } from './catalog-d1'

export interface ArtistRecord {
  id: string
  name: string
  country: CountryCode
  whitelisted: boolean
  popularity?: number
}

export interface ArtistAllowlist {
  ids: Set<string>
  names: Set<string>
}

function requireDb(env: Env): D1Database {
  if (!env.DB) {
    throw new CatalogUnavailableError('D1 database binding DB is not configured.')
  }
  return env.DB
}

export function artistSlugId(name: string): string {
  return `name:${normalizeName(name)}`
}

export function artistRecordId(artist: { id?: string; name: string }): string {
  return artist.id?.trim() || artistSlugId(artist.name)
}

export async function seedOpmArtists(env: Env): Promise<number> {
  const db = requireDb(env)
  const now = new Date().toISOString()
  const statements = UNIQUE_OPM_ARTISTS.map((name) =>
    db
      .prepare(
        `INSERT INTO artists (id, name, country, whitelisted, updated_at)
         VALUES (?, ?, 'PH', 1, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           country = CASE
             WHEN artists.country IS NULL OR artists.country = '' THEN 'PH'
             ELSE artists.country
           END,
           whitelisted = 1,
           updated_at = excluded.updated_at`,
      )
      .bind(artistSlugId(name), name, now),
  )

  let changed = 0
  for (let index = 0; index < statements.length; index += 80) {
    const result = await db.batch(statements.slice(index, index + 80))
    changed += result.reduce((sum, item) => sum + (item.meta?.changes ?? 0), 0)
  }
  return changed
}

export async function upsertArtists(
  env: Env,
  artists: Array<{ id?: string; name: string; popularity?: number }>,
  country: CountryCode,
): Promise<number> {
  if (artists.length === 0) return 0

  const db = requireDb(env)
  const now = new Date().toISOString()
  const seen = new Set<string>()
  const statements: D1PreparedStatement[] = []

  for (const artist of artists) {
    const name = artist.name?.trim()
    if (!name) continue
    const id = artistRecordId({ id: artist.id, name })
    if (seen.has(id)) continue
    seen.add(id)
    statements.push(
      db
        .prepare(
          `INSERT INTO artists (id, name, country, whitelisted, popularity, updated_at)
           VALUES (?, ?, ?, 1, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             name = excluded.name,
             country = excluded.country,
             whitelisted = 1,
             popularity = COALESCE(excluded.popularity, artists.popularity),
             updated_at = excluded.updated_at`,
        )
        .bind(id, name, country, artist.popularity ?? null, now),
    )
  }

  let changed = 0
  for (let index = 0; index < statements.length; index += 80) {
    const result = await db.batch(statements.slice(index, index + 80))
    changed += result.reduce((sum, item) => sum + (item.meta?.changes ?? 0), 0)
  }
  return changed
}

export async function loadArtistAllowlist(env: Env, country: CountryCode): Promise<ArtistAllowlist> {
  const db = requireDb(env)
  const result = await db
    .prepare(
      `SELECT id, name FROM artists
       WHERE country = ? AND whitelisted = 1`,
    )
    .bind(country)
    .all<{ id: string; name: string }>()

  const ids = new Set<string>()
  const names = new Set<string>()
  for (const row of result.results ?? []) {
    if (row.id) ids.add(row.id)
    if (row.name) names.add(normalizeName(row.name))
  }

  if (country === DEFAULT_COUNTRY) {
    for (const name of UNIQUE_OPM_ARTISTS) {
      names.add(normalizeName(name))
      ids.add(artistSlugId(name))
    }
  }

  return { ids, names }
}

export function isAllowedArtistName(
  name: string,
  country: CountryCode,
  allowlist: ArtistAllowlist,
  artistId?: string,
): boolean {
  if (!name.trim()) return false
  if (artistId && allowlist.ids.has(artistId)) return true
  if (allowlist.names.has(normalizeName(name))) return true
  if (country === DEFAULT_COUNTRY) {
    const normalized = normalizeName(name)
    return UNIQUE_OPM_ARTISTS.some((allowed) => {
      const allowedNorm = normalizeName(allowed)
      return (
        normalized === allowedNorm ||
        normalized.includes(allowedNorm) ||
        allowedNorm.includes(normalized)
      )
    })
  }
  return false
}

/**
 * A track belongs to `country` when any credited artist is on that country's
 * allowlist (artists table or the static PH list). Blocked international
 * names never pass unless the admin marked the playlist as all-local.
 */
export function isAllowedTrack(
  track: SpotifyTrackRef,
  country: CountryCode,
  allowlist: ArtistAllowlist,
  options: { assumeAllLocal?: boolean } = {},
): boolean {
  const artists = track.artists ?? []
  if (artists.length === 0) return false

  if (options.assumeAllLocal) return true

  if (artists.some((artist) => isBlockedNonOpmArtist(artist.name))) {
    return false
  }

  return artists.some((artist) =>
    isAllowedArtistName(artist.name, country, allowlist, artist.id),
  )
}

export function parseStoredCountry(value: string | null | undefined): CountryCode {
  if (value && isCountryCode(value)) return value
  return DEFAULT_COUNTRY
}

export interface AdminArtistRow {
  id: string
  name: string
  country: CountryCode
  whitelisted: boolean
  songCount: number
  popularity?: number
}

export interface ArtistListPage {
  artists: AdminArtistRow[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

function artistSearchWhere(query: string): { sql: string; params: string[] } {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return { sql: '', params: [] }
  const escaped = `%${normalized.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_')}%`
  return {
    sql: ` AND (lower(name) LIKE ? ESCAPE '\\' OR lower(id) LIKE ? ESCAPE '\\')`,
    params: [escaped, escaped],
  }
}

export async function listArtistsPage(
  env: Env,
  page: number,
  pageSize: number,
  query: string,
): Promise<ArtistListPage> {
  const db = requireDb(env)
  const search = artistSearchWhere(query)
  const totalRow = await db
    .prepare(`SELECT COUNT(*) AS total FROM artists WHERE 1 = 1${search.sql}`)
    .bind(...search.params)
    .first<{ total: number }>()
  const total = totalRow?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1)
  const safePage = Math.min(Math.max(page, 1), totalPages)
  const offset = (safePage - 1) * pageSize

  const result = await db
    .prepare(
      `SELECT id, name, country, whitelisted, popularity FROM artists
       WHERE 1 = 1${search.sql}
       ORDER BY name COLLATE NOCASE
       LIMIT ? OFFSET ?`,
    )
    .bind(...search.params, pageSize, offset)
    .all<{
      id: string
      name: string
      country: string | null
      whitelisted: number
      popularity: number | null
    }>()

  const rows = result.results ?? []
  const songCounts = await countSongsForArtists(
    env,
    rows.map((row) => row.name),
  )

  return {
    artists: rows.map((row) => ({
      id: row.id,
      name: row.name,
      country: parseStoredCountry(row.country),
      whitelisted: row.whitelisted === 1,
      songCount: songCounts.get(normalizeName(row.name)) ?? 0,
      ...(row.popularity != null ? { popularity: row.popularity } : {}),
    })),
    page: safePage,
    pageSize,
    total,
    totalPages,
  }
}

async function countSongsForArtists(env: Env, names: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  if (names.length === 0) return counts
  const db = requireDb(env)
  const normalizedNames = names.map((name) => normalizeName(name)).filter(Boolean)

  const result = await db
    .prepare(`SELECT artist, song_key FROM tracks`)
    .all<{ artist: string; song_key: string | null }>()

  const wanted = new Set(normalizedNames)
  for (const name of wanted) counts.set(name, 0)

  for (const row of result.results ?? []) {
    const credited = (row.artist ?? '')
      .split(',')
      .map((part) => normalizeName(part))
      .filter(Boolean)
    const keyPrefix = row.song_key?.split('|')[0]
    const matched = new Set<string>()
    for (const name of credited) {
      if (wanted.has(name)) matched.add(name)
    }
    if (keyPrefix && wanted.has(keyPrefix)) matched.add(keyPrefix)
    for (const name of matched) {
      counts.set(name, (counts.get(name) ?? 0) + 1)
    }
  }

  return counts
}

export async function updateArtist(
  env: Env,
  id: string,
  patch: { country?: CountryCode; whitelisted?: boolean },
): Promise<AdminArtistRow> {
  const db = requireDb(env)
  const current = await db
    .prepare(`SELECT id, name, country, whitelisted, popularity FROM artists WHERE id = ?`)
    .bind(id)
    .first<{
      id: string
      name: string
      country: string | null
      whitelisted: number
      popularity: number | null
    }>()
  if (!current) {
    throw Object.assign(new Error('Artist not found'), { status: 404 })
  }

  const country = patch.country ?? parseStoredCountry(current.country)
  const whitelisted = patch.whitelisted ?? current.whitelisted === 1
  const now = new Date().toISOString()

  await db
    .prepare(
      `UPDATE artists SET country = ?, whitelisted = ?, updated_at = ? WHERE id = ?`,
    )
    .bind(country, whitelisted ? 1 : 0, now, id)
    .run()

  const songCounts = await countSongsForArtists(env, [current.name])
  return {
    id: current.id,
    name: current.name,
    country,
    whitelisted,
    songCount: songCounts.get(normalizeName(current.name)) ?? 0,
    ...(current.popularity != null ? { popularity: current.popularity } : {}),
  }
}

export async function deleteArtist(
  env: Env,
  id: string,
  options: { removeSongs?: boolean } = {},
): Promise<{ ok: true; songsRemoved: number }> {
  const db = requireDb(env)
  const current = await db
    .prepare(`SELECT id, name FROM artists WHERE id = ?`)
    .bind(id)
    .first<{ id: string; name: string }>()
  if (!current) {
    throw Object.assign(new Error('Artist not found'), { status: 404 })
  }

  let songsRemoved = 0
  if (options.removeSongs) {
    const keyPrefix = normalizeName(current.name)
    const token = `,${current.name.trim().toLowerCase()},`
    const tracks = await db
      .prepare(`SELECT id, artist, song_key FROM tracks`)
      .all<{ id: string; artist: string; song_key: string | null }>()
    const deleteIds = (tracks.results ?? [])
      .filter((row) => {
        const credited = `,${row.artist.toLowerCase().replace(/,\s+/g, ',')},`
        return credited.includes(token) || (keyPrefix && row.song_key?.startsWith(`${keyPrefix}|`))
      })
      .map((row) => row.id)

    for (let index = 0; index < deleteIds.length; index += 80) {
      const batch = deleteIds.slice(index, index + 80)
      await db
        .prepare(`DELETE FROM tracks WHERE id IN (${batch.map(() => '?').join(', ')})`)
        .bind(...batch)
        .run()
    }
    songsRemoved = deleteIds.length
  }

  await db.prepare(`DELETE FROM artists WHERE id = ?`).bind(id).run()
  return { ok: true, songsRemoved }
}
