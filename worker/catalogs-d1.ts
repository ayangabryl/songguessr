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
  const result = await db
    .prepare(
      `SELECT c.id, c.name, c.emoji, c.country, c.created_at,
              (SELECT COUNT(*) FROM tracks t WHERE t.catalog = c.id) AS track_count
       FROM catalogs c
       ORDER BY
         CASE c.id
           WHEN 'opm' THEN 0
           WHEN 'kpop' THEN 1
           WHEN 'anime' THEN 2
           WHEN 'kdrama' THEN 3
           WHEN 'other' THEN 4
           ELSE 5
         END,
         c.name COLLATE NOCASE`,
    )
    .all<{
      id: string
      name: string
      emoji: string
      country: string | null
      created_at: string | null
      track_count: number
    }>()

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
    throw Object.assign(new Error('Catalog id must be a lowercase slug (letters, numbers, hyphens)'), {
      status: 400,
    })
  }
  const emoji = input.emoji.trim() || '🎵'
  const country = parseCountry(input.country ?? undefined)
  const createdAt = new Date().toISOString()

  const existing = await getCatalogById(env, id)
  if (existing) {
    throw Object.assign(new Error(`Catalog “${id}” already exists`), { status: 409 })
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
    throw Object.assign(new Error('Catalog not found'), { status: 404 })
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
    throw Object.assign(new Error('Catalog not found'), { status: 404 })
  }

  const used = await db
    .prepare(`SELECT COUNT(*) AS n FROM tracks WHERE catalog = ?`)
    .bind(id)
    .first<{ n: number }>()
  if ((used?.n ?? 0) > 0) {
    throw Object.assign(new Error('Catalog is in use by songs and cannot be deleted'), {
      status: 409,
    })
  }

  await db.prepare(`DELETE FROM catalogs WHERE id = ?`).bind(id).run()
}
