import {
  DEFAULT_CATALOG,
  catalogSlugFromName,
  isCatalogKind,
  isCountryCode,
  type CatalogKind,
  type CountryCode,
} from '../shared/catalog-meta'
import { CatalogUnavailableError } from './catalog-d1'
import type { Env } from './types'

export interface CatalogRecord {
  id: CatalogKind
  name: string
  emoji: string
  country: CountryCode | null
  createdAt: string
  trackCount?: number
}

const SEED_CATALOGS: Array<Omit<CatalogRecord, 'createdAt' | 'trackCount'>> = [
  { id: 'opm', name: 'OPM', emoji: '🇵🇭', country: 'PH' },
  { id: 'kpop', name: 'K-pop', emoji: '🇰🇷', country: 'KR' },
  { id: 'anime', name: 'Anime', emoji: '🎌', country: null },
  { id: 'kdrama', name: 'K-drama', emoji: '📺', country: 'KR' },
  { id: 'other', name: 'Other', emoji: '🎵', country: null },
]

function requireDb(env: Env): D1Database {
  if (!env.DB) {
    throw new CatalogUnavailableError('D1 database binding DB is not configured.')
  }
  return env.DB
}

function parseCountry(value: string | null | undefined): CountryCode | null {
  const normalized = value?.trim().toUpperCase()
  if (!normalized) return null
  return isCountryCode(normalized) ? normalized : null
}

function rowToCatalog(row: {
  id: string
  name: string
  emoji: string
  country: string | null
  created_at: string | null
  track_count?: number
}): CatalogRecord {
  return {
    id: row.id,
    name: row.name,
    emoji: row.emoji || '🎵',
    country: parseCountry(row.country),
    createdAt: row.created_at ?? '',
    ...(row.track_count != null ? { trackCount: row.track_count } : {}),
  }
}

export async function ensureSeedCatalogs(env: Env): Promise<void> {
  const db = requireDb(env)
  const now = new Date().toISOString()
  const statements = SEED_CATALOGS.map((catalog) =>
    db
      .prepare(
        `INSERT OR IGNORE INTO catalogs (id, name, emoji, country, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(catalog.id, catalog.name, catalog.emoji, catalog.country, now),
  )
  await db.batch(statements)
}

export async function listCatalogs(env: Env): Promise<CatalogRecord[]> {
  const db = requireDb(env)
  await ensureSeedCatalogs(env)
  const orderBy = `ORDER BY
         CASE c.id
           WHEN 'opm' THEN 0
           WHEN 'kpop' THEN 1
           WHEN 'anime' THEN 2
           WHEN 'kdrama' THEN 3
           WHEN 'other' THEN 4
           ELSE 5
         END,
         c.name COLLATE NOCASE`
  let result: D1Result<{
    id: string
    name: string
    emoji: string
    country: string | null
    created_at: string | null
    track_count: number
  }>
  try {
    result = await db
      .prepare(
        `SELECT c.id, c.name, c.emoji, c.country, c.created_at,
                (SELECT COUNT(*) FROM (
                   SELECT t.id AS id FROM tracks t WHERE t.catalog = c.id
                   UNION
                   SELECT tc.track_id AS id FROM track_collections tc WHERE tc.collection_id = c.id
                 )) AS track_count
         FROM catalogs c
         ${orderBy}`,
      )
      .all()
  } catch {
    result = await db
      .prepare(
        `SELECT c.id, c.name, c.emoji, c.country, c.created_at,
                (SELECT COUNT(*) FROM tracks t WHERE t.catalog = c.id) AS track_count
         FROM catalogs c
         ${orderBy}`,
      )
      .all()
  }

  const rows = (result.results ?? []).map(rowToCatalog)
  if (rows.length > 0) return rows
  return SEED_CATALOGS.map((catalog) => ({
    ...catalog,
    createdAt: '',
    trackCount: 0,
  }))
}

export async function getCatalogById(env: Env, id: string): Promise<CatalogRecord | null> {
  const db = requireDb(env)
  const row = await db
    .prepare(
      `SELECT id, name, emoji, country, created_at FROM catalogs WHERE id = ?`,
    )
    .bind(id)
    .first<{
      id: string
      name: string
      emoji: string
      country: string | null
      created_at: string | null
    }>()
  return row ? rowToCatalog(row) : null
}

export async function resolveCatalogId(env: Env, value: string | undefined): Promise<CatalogKind> {
  const normalized = value?.trim().toLowerCase() ?? ''
  if (!isCatalogKind(normalized)) return DEFAULT_CATALOG
  await ensureSeedCatalogs(env)
  const found = await getCatalogById(env, normalized)
  return found?.id ?? DEFAULT_CATALOG
}

export async function createCatalog(
  env: Env,
  input: { id?: string; name: string; emoji: string; country?: string | null },
): Promise<CatalogRecord> {
  const db = requireDb(env)
  await ensureSeedCatalogs(env)
  const name = input.name.trim()
  if (!name) {
    throw Object.assign(new Error('Name is required'), { status: 400 })
  }
  const id = (input.id?.trim() || catalogSlugFromName(name)).toLowerCase()
  if (!isCatalogKind(id)) {
    throw Object.assign(new Error('Collection id must be a lowercase slug (letters, numbers, hyphens)'), {
      status: 400,
    })
  }
  const emoji = input.emoji.trim() || '🎵'
  const country = parseCountry(input.country ?? undefined)
  const createdAt = new Date().toISOString()

  const existing = await getCatalogById(env, id)
  if (existing) {
    throw Object.assign(new Error(`Collection “${id}” already exists`), { status: 409 })
  }

  await db
    .prepare(
      `INSERT INTO catalogs (id, name, emoji, country, created_at) VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(id, name, emoji, country, createdAt)
    .run()

  return { id, name, emoji, country, createdAt, trackCount: 0 }
}

export async function updateCatalog(
  env: Env,
  id: string,
  patch: { name?: string; emoji?: string; country?: string | null },
): Promise<CatalogRecord> {
  const db = requireDb(env)
  const current = await getCatalogById(env, id)
  if (!current) {
    throw Object.assign(new Error('Collection not found'), { status: 404 })
  }

  const name = patch.name?.trim() || current.name
  const emoji = patch.emoji?.trim() || current.emoji
  const country =
    patch.country === undefined ? current.country : parseCountry(patch.country)

  await db
    .prepare(`UPDATE catalogs SET name = ?, emoji = ?, country = ? WHERE id = ?`)
    .bind(name, emoji, country, id)
    .run()

  return { ...current, name, emoji, country }
}

export async function deleteCatalog(env: Env, id: string): Promise<void> {
  const db = requireDb(env)
  const current = await getCatalogById(env, id)
  if (!current) {
    throw Object.assign(new Error('Collection not found'), { status: 404 })
  }

  const used = await db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM tracks WHERE catalog = ?) +
         (SELECT COUNT(*) FROM track_collections WHERE collection_id = ?) AS n`,
    )
    .bind(id, id)
    .first<{ n: number }>()
  if ((used?.n ?? 0) > 0) {
    throw Object.assign(new Error('Collection is in use by songs and cannot be deleted'), {
      status: 409,
    })
  }

  await db.batch([
    db.prepare(`DELETE FROM track_collections WHERE collection_id = ?`).bind(id),
    db.prepare(`DELETE FROM catalogs WHERE id = ?`).bind(id),
  ])
}

const MAX_IN_PARAMS = 80

function uniqueIds(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

/** Accepts `collections`, `catalogs`, or a single `catalog` from older clients. */
export function parseRequestedCollectionIds(body: {
  catalog?: string
  catalogs?: unknown
  collections?: unknown
}): string[] {
  const ids: string[] = []
  for (const value of [body.collections, body.catalogs]) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string' && item.trim()) ids.push(item.trim())
      }
    } else if (typeof value === 'string' && value.trim()) {
      ids.push(value.trim())
    }
  }
  if (typeof body.catalog === 'string' && body.catalog.trim()) {
    ids.push(body.catalog.trim())
  }
  return uniqueIds(ids)
}

export async function resolveCatalogIds(
  env: Env,
  values: string[] | undefined,
): Promise<CatalogKind[]> {
  await ensureSeedCatalogs(env)
  const resolved: CatalogKind[] = []
  for (const value of uniqueIds(values ?? [])) {
    const normalized = value.toLowerCase()
    if (!isCatalogKind(normalized)) continue
    const found = await getCatalogById(env, normalized)
    if (found) resolved.push(found.id)
  }
  return resolved
}

export async function listCollectionsForTracks(
  env: Env,
  trackIds: string[],
): Promise<Map<string, CatalogKind[]>> {
  const map = new Map<string, CatalogKind[]>()
  const ids = uniqueIds(trackIds)
  if (ids.length === 0) return map

  const db = requireDb(env)
  try {
    for (let index = 0; index < ids.length; index += MAX_IN_PARAMS) {
      const batch = ids.slice(index, index + MAX_IN_PARAMS)
      const result = await db
        .prepare(
          `SELECT track_id, collection_id FROM track_collections
           WHERE track_id IN (${batch.map(() => '?').join(', ')})
           ORDER BY collection_id`,
        )
        .bind(...batch)
        .all<{ track_id: string; collection_id: string }>()
      for (const row of result.results ?? []) {
        const current = map.get(row.track_id) ?? []
        if (!current.includes(row.collection_id)) current.push(row.collection_id)
        map.set(row.track_id, current)
      }
    }
  } catch {
    // Join table is created by migration 0006; older DBs fall back to tracks.catalog.
  }

  const missing = ids.filter((id) => !map.has(id))
  if (missing.length === 0) return map
  try {
    for (let index = 0; index < missing.length; index += MAX_IN_PARAMS) {
      const batch = missing.slice(index, index + MAX_IN_PARAMS)
      const result = await db
        .prepare(
          `SELECT id, catalog FROM tracks WHERE id IN (${batch.map(() => '?').join(', ')})`,
        )
        .bind(...batch)
        .all<{ id: string; catalog: string | null }>()
      for (const row of result.results ?? []) {
        if (row.catalog && isCatalogKind(row.catalog)) map.set(row.id, [row.catalog])
      }
    }
  } catch {
    // Catalog column may be missing on very old schemas.
  }
  return map
}

export async function setTrackCollections(
  env: Env,
  trackId: string,
  collectionIds: string[],
): Promise<CatalogKind[]> {
  const id = trackId.trim()
  if (!id) return []
  const resolved = await resolveCatalogIds(env, collectionIds)
  const db = requireDb(env)

  await db.prepare(`DELETE FROM track_collections WHERE track_id = ?`).bind(id).run()
  if (resolved.length > 0) {
    await db.batch(
      resolved.map((collectionId) =>
        db
          .prepare(
            `INSERT OR IGNORE INTO track_collections (track_id, collection_id) VALUES (?, ?)`,
          )
          .bind(id, collectionId),
      ),
    )
  }
  await db
    .prepare(`UPDATE tracks SET catalog = ? WHERE id = ?`)
    .bind(resolved[0] ?? null, id)
    .run()
  return resolved
}

export type CollectionAssignMode = 'replace' | 'add'

export interface CollectionAssignResult {
  updated: number
  notFound: number
  requested: number
  collections: CatalogKind[]
  mode: CollectionAssignMode
}

async function existingTrackIds(env: Env, ids: string[]): Promise<Set<string>> {
  const found = new Set<string>()
  if (ids.length === 0) return found
  const db = requireDb(env)
  for (let index = 0; index < ids.length; index += MAX_IN_PARAMS) {
    const batch = ids.slice(index, index + MAX_IN_PARAMS)
    const result = await db
      .prepare(`SELECT id FROM tracks WHERE id IN (${batch.map(() => '?').join(', ')})`)
      .bind(...batch)
      .all<{ id: string }>()
    for (const row of result.results ?? []) found.add(row.id)
  }
  return found
}

export function parseCollectionAssignMode(value: unknown): CollectionAssignMode {
  return value === 'add' ? 'add' : 'replace'
}

export async function assignCollectionsToTracks(
  env: Env,
  trackIds: string[],
  collectionIds: string[],
  mode: CollectionAssignMode = 'replace',
): Promise<CollectionAssignResult> {
  const requested = uniqueIds(trackIds)
  const existing = await existingTrackIds(env, requested)
  const ids = requested.filter((id) => existing.has(id))
  const resolved = await resolveCatalogIds(env, collectionIds)
  const result: CollectionAssignResult = {
    updated: ids.length,
    notFound: requested.length - ids.length,
    requested: requested.length,
    collections: resolved,
    mode,
  }

  if (ids.length === 0) return result
  if (mode === 'add' && resolved.length === 0) {
    return { ...result, updated: 0 }
  }

  const db = requireDb(env)
  const statements: D1PreparedStatement[] = []
  const primary = resolved[0] ?? null

  switch (mode) {
    case 'replace':
      for (const trackId of ids) {
        statements.push(
          db.prepare(`DELETE FROM track_collections WHERE track_id = ?`).bind(trackId),
        )
        for (const collectionId of resolved) {
          statements.push(
            db
              .prepare(
                `INSERT OR IGNORE INTO track_collections (track_id, collection_id) VALUES (?, ?)`,
              )
              .bind(trackId, collectionId),
          )
        }
        statements.push(
          db.prepare(`UPDATE tracks SET catalog = ? WHERE id = ?`).bind(primary, trackId),
        )
      }
      break
    case 'add':
      for (const trackId of ids) {
        for (const collectionId of resolved) {
          statements.push(
            db
              .prepare(
                `INSERT OR IGNORE INTO track_collections (track_id, collection_id) VALUES (?, ?)`,
              )
              .bind(trackId, collectionId),
          )
        }
        statements.push(
          db
            .prepare(
              `INSERT OR IGNORE INTO track_collections (track_id, collection_id)
               SELECT id, catalog FROM tracks
               WHERE id = ? AND catalog IS NOT NULL AND catalog != ''`,
            )
            .bind(trackId),
        )
        statements.push(
          db
            .prepare(`UPDATE tracks SET catalog = COALESCE(NULLIF(catalog, ''), ?) WHERE id = ?`)
            .bind(primary, trackId),
        )
      }
      break
    default: {
      const exhaustive: never = mode
      throw new Error(`Unknown collection assign mode: ${String(exhaustive)}`)
    }
  }

  for (let index = 0; index < statements.length; index += 100) {
    await db.batch(statements.slice(index, index + 100))
  }
  return result
}

export async function addTracksToCollections(
  env: Env,
  trackIds: string[],
  collectionIds: string[],
): Promise<void> {
  await assignCollectionsToTracks(env, trackIds, collectionIds, 'replace')
}

export async function removeCollectionsForTracks(env: Env, trackIds: string[]): Promise<void> {
  const ids = uniqueIds(trackIds)
  if (ids.length === 0) return
  const db = requireDb(env)
  for (let index = 0; index < ids.length; index += MAX_IN_PARAMS) {
    const batch = ids.slice(index, index + MAX_IN_PARAMS)
    await db
      .prepare(
        `DELETE FROM track_collections WHERE track_id IN (${batch.map(() => '?').join(', ')})`,
      )
      .bind(...batch)
      .run()
  }
}
