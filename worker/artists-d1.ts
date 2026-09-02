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
