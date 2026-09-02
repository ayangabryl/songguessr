import {
  DEFAULT_CATALOG,
  DEFAULT_COUNTRY,
  isCatalogKind,
  isCountryCode,
  type CatalogKind,
  type CountryCode,
} from '../shared/catalog-meta'
import {
  EMPTY_CATALOG_FILTERS,
  ERA_OPTIONS,
  GENRE_OPTIONS,
  type CatalogFilters,
  type EraFilter,
  type GenreFilter,
} from './filters'
import { dedupeTracks, songIdentityKey } from './track-dedupe'
import type { Difficulty, Env, Track } from './types'

export const MAX_CATALOG_TRACKS = 20_000
export const CATALOG_SEED_MESSAGE =
  'Catalog not found in D1. Run `npm run seed:d1` to import tracks from R2.'

export class CatalogUnavailableError extends Error {
  constructor(message = CATALOG_SEED_MESSAGE) {
    super(message)
    this.name = 'CatalogUnavailableError'
  }
}

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'expert', 'impossible']
const MAX_IN_PARAMS = 80

type SqlValue = string | number | null

export interface TrackRow {
  id: string
  title: string
  artist: string
  preview_url: string | null
  hook_preview_url: string | null
  hook_start_seconds: number | null
  album_art: string | null
  difficulty: Difficulty
  popularity: number | null
  artist_popularity: number | null
  release_year: number | null
  release_date: string | null
  duration_ms: number | null
  genre_groups: string | null
  spotify_genres: string | null
  song_key: string | null
  updated_at: string | null
  spotify_synced_at: string | null
  country: string | null
  catalog: string | null
  chart_boost: number | null
  force_tier: string | null
}

export interface CatalogStats {
  count: number
  updatedAt: string | null
  spotifySyncedAt: string | null
}

export interface CatalogMutationResult {
  ok: boolean
  reason?: string
  totalTracks?: number
}

export interface AddTracksToCatalogResult {
  added: number
  totalTracks: number
  skippedExisting: number
  skippedCap: number
}

export interface CatalogListFilters {
  difficulty?: Difficulty
  genre?: GenreFilter
  era?: EraFilter
  country?: CountryCode
  missingPreview: boolean
}

export interface CatalogListPage {
  tracks: Array<{
    id: string
    title: string
    artist: string
    difficulty: Difficulty
    releaseYear?: number
    genreGroups: GenreFilter[]
    era: EraFilter | null
    albumArt: string
    hasPreview: boolean
    popularity?: number
    country: CountryCode
    catalog: CatalogKind
    releaseDate?: string
    spotifyGenres: string[]
  }>
  page: number
  pageSize: number
  total: number
  totalPages: number
  counts: {
    difficulty: Record<Difficulty, number>
    genre: Record<GenreFilter, number>
    era: Record<EraFilter, number>
    country: Record<string, number>
    missingPreview: number
  }
}

function requireDb(env: Env): D1Database {
  if (!env.DB) {
    throw new CatalogUnavailableError('D1 database binding DB is not configured.')
  }
  return env.DB
}

function parseGenreGroups(value: string | null): GenreFilter[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is GenreFilter =>
      GENRE_OPTIONS.includes(item as GenreFilter),
    )
  } catch {
    return []
  }
}

function parseStringList(value: string | null): string[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is string => typeof item === 'string' && item.length > 0)
  } catch {
    return []
  }
}

function parseCountry(value: string | null | undefined): CountryCode {
  const normalized = value?.trim().toUpperCase()
  if (normalized && isCountryCode(normalized)) return normalized
  return DEFAULT_COUNTRY
}

function parseCatalog(value: string | null | undefined): CatalogKind {
  const normalized = value?.trim().toLowerCase()
  if (normalized && isCatalogKind(normalized)) return normalized
  return DEFAULT_CATALOG
}

function parseForceTier(value: string | null | undefined): Difficulty | undefined {
  if (value && DIFFICULTIES.includes(value as Difficulty)) {
    return value as Difficulty
  }
  return undefined
}

function eraFromYear(year: number | null | undefined): EraFilter | null {
  if (!Number.isInteger(year)) return null
  const releaseYear = year as number
  if (releaseYear >= 2020) return 'modern'
  if (releaseYear >= 2010) return '2010s'
  if (releaseYear >= 2000) return '2000s'
  return 'classics'
}

export function rowToTrack(row: TrackRow): Track {
  const genreGroups = parseGenreGroups(row.genre_groups)
  const spotifyGenres = parseStringList(row.spotify_genres)
  const forceTier = parseForceTier(row.force_tier)
  return {
    id: row.id,
    title: row.title,
    artist: row.artist,
    previewUrl: row.preview_url ?? '',
    ...(row.hook_preview_url ? { hookPreviewUrl: row.hook_preview_url } : {}),
    hookStartSeconds: row.hook_start_seconds ?? undefined,
    albumArt: row.album_art ?? '',
    difficulty: row.difficulty,
    releaseYear: row.release_year ?? undefined,
    releaseDate: row.release_date ?? undefined,
    genreGroups: genreGroups.length > 0 ? genreGroups : undefined,
    spotifyGenres: spotifyGenres.length > 0 ? spotifyGenres : undefined,
    popularity: row.popularity ?? undefined,
    artistPopularity: row.artist_popularity ?? undefined,
    durationMs: row.duration_ms ?? undefined,
    country: parseCountry(row.country),
    catalog: parseCatalog(row.catalog),
    chartBoost: Boolean(row.chart_boost),
    ...(forceTier ? { forceTier } : {}),
  }
}

function trackBindValues(track: Track, now: string): SqlValue[] {
  return [
    track.id,
    track.title,
    track.artist,
    track.previewUrl || null,
    track.hookPreviewUrl ?? null,
    track.hookStartSeconds ?? null,
    track.albumArt || null,
    track.difficulty,
    track.popularity ?? null,
    track.artistPopularity ?? null,
    track.releaseYear ?? null,
    track.releaseDate ?? null,
    track.durationMs ?? null,
    JSON.stringify(track.genreGroups ?? []),
    JSON.stringify(track.spotifyGenres ?? []),
    songIdentityKey(track),
    now,
    track.spotifySyncedAt ?? null,
    track.country ?? DEFAULT_COUNTRY,
    track.catalog ?? DEFAULT_CATALOG,
    track.chartBoost ? 1 : 0,
    track.forceTier ?? null,
  ]
}

const INSERT_COLUMNS = `id, title, artist, preview_url, hook_preview_url, hook_start_seconds,
  album_art, difficulty, popularity, artist_popularity, release_year, release_date, duration_ms,
  genre_groups, spotify_genres, song_key, updated_at, spotify_synced_at, country, catalog,
  chart_boost, force_tier`

const INSERT_SQL = `INSERT INTO tracks (${INSERT_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

const UPSERT_SQL = `INSERT INTO tracks (${INSERT_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    title = excluded.title,
    artist = excluded.artist,
    preview_url = COALESCE(excluded.preview_url, tracks.preview_url),
    hook_preview_url = COALESCE(excluded.hook_preview_url, tracks.hook_preview_url),
    hook_start_seconds = COALESCE(excluded.hook_start_seconds, tracks.hook_start_seconds),
    album_art = COALESCE(excluded.album_art, tracks.album_art),
    difficulty = CASE
      WHEN excluded.chart_boost = 1 THEN excluded.difficulty
      ELSE tracks.difficulty
    END,
    popularity = COALESCE(excluded.popularity, tracks.popularity),
    artist_popularity = COALESCE(excluded.artist_popularity, tracks.artist_popularity),
    release_year = COALESCE(excluded.release_year, tracks.release_year),
    release_date = COALESCE(excluded.release_date, tracks.release_date),
    duration_ms = COALESCE(excluded.duration_ms, tracks.duration_ms),
    genre_groups = excluded.genre_groups,
    spotify_genres = excluded.spotify_genres,
    song_key = excluded.song_key,
    updated_at = excluded.updated_at,
    country = excluded.country,
    catalog = excluded.catalog,
    chart_boost = MAX(tracks.chart_boost, excluded.chart_boost),
    force_tier = COALESCE(excluded.force_tier, tracks.force_tier)`

function eraSql(era: EraFilter): string {
  switch (era) {
    case 'modern':
      return 'release_year >= 2020'
    case '2010s':
      return '(release_year >= 2010 AND release_year <= 2019)'
    case '2000s':
      return '(release_year >= 2000 AND release_year <= 2009)'
    case 'classics':
      return '(release_year IS NOT NULL AND release_year < 2000)'
    default: {
      const _never: never = era
      throw new Error(`Unhandled era: ${_never}`)
    }
  }
}

function buildFilterSql(filters: CatalogFilters): { sql: string; params: SqlValue[] } {
  const clauses: string[] = []
  const params: SqlValue[] = []

  if (filters.eras.length > 0) {
    clauses.push(`(${filters.eras.map((era) => eraSql(era)).join(' OR ')})`)
  }

  if (filters.genres.length > 0) {
    const genreClauses = filters.genres.map(
      () => `EXISTS (SELECT 1 FROM json_each(tracks.genre_groups) WHERE json_each.value = ?)`,
    )
    clauses.push(`(${genreClauses.join(' OR ')})`)
    params.push(...filters.genres)
  }

  if (filters.countries.length > 0) {
    clauses.push(`country IN (${filters.countries.map(() => '?').join(', ')})`)
    params.push(...filters.countries)
  }

  return {
    sql: clauses.length > 0 ? ` AND ${clauses.join(' AND ')}` : '',
    params,
  }
}

function inClause(column: string, values: string[]): { sql: string; params: SqlValue[] } {
  if (values.length === 0) return { sql: '', params: [] }
  const limited = values.slice(0, MAX_IN_PARAMS)
  return {
    sql: ` AND ${column} NOT IN (${limited.map(() => '?').join(', ')})`,
    params: limited,
  }
}

function likePattern(query: string): string {
  return `%${query.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_')}%`
}

export async function getCatalogStats(env: Env): Promise<CatalogStats> {
  const db = requireDb(env)
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS count, MAX(updated_at) AS updated_at, MAX(spotify_synced_at) AS spotify_synced_at
       FROM tracks`,
    )
    .first<{ count: number; updated_at: string | null; spotify_synced_at: string | null }>()

  return {
    count: row?.count ?? 0,
    updatedAt: row?.updated_at ?? null,
    spotifySyncedAt: row?.spotify_synced_at ?? null,
  }
}

export async function countTracks(env: Env): Promise<number> {
  const stats = await getCatalogStats(env)
  return stats.count
}

export async function listTrackIds(env: Env): Promise<string[]> {
  const db = requireDb(env)
  const result = await db.prepare('SELECT id FROM tracks').all<{ id: string }>()
  return (result.results ?? []).map((row) => row.id)
}

export async function listTrackIdsForSync(env: Env, limit = 5000): Promise<string[]> {
  const db = requireDb(env)
  const result = await db
    .prepare(
      `SELECT id FROM tracks
       ORDER BY (spotify_synced_at IS NOT NULL), spotify_synced_at ASC
       LIMIT ?`,
    )
    .bind(limit)
    .all<{ id: string }>()
  return (result.results ?? []).map((row) => row.id)
}

export async function findExistingTrackIds(env: Env, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set()
  const db = requireDb(env)
  const found = new Set<string>()

  for (let index = 0; index < ids.length; index += MAX_IN_PARAMS) {
    const batch = ids.slice(index, index + MAX_IN_PARAMS)
    const result = await db
      .prepare(`SELECT id FROM tracks WHERE id IN (${batch.map(() => '?').join(', ')})`)
      .bind(...batch)
      .all<{ id: string }>()
    for (const row of result.results ?? []) {
      found.add(row.id)
    }
  }

  return found
}

export async function findExistingSongKeys(env: Env, keys: string[]): Promise<Set<string>> {
  const usable = keys.filter((key) => key.length > 0)
  if (usable.length === 0) return new Set()
  const db = requireDb(env)
  const found = new Set<string>()

  for (let index = 0; index < usable.length; index += MAX_IN_PARAMS) {
    const batch = usable.slice(index, index + MAX_IN_PARAMS)
    const result = await db
      .prepare(`SELECT song_key FROM tracks WHERE song_key IN (${batch.map(() => '?').join(', ')})`)
      .bind(...batch)
      .all<{ song_key: string | null }>()
    for (const row of result.results ?? []) {
      if (row.song_key) found.add(row.song_key)
    }
  }

  return found
}

export interface CatalogIdentitySets {
  ids: Set<string>
  songKeys: Set<string>
}

/** Match by Spotify id, song_key, or normalized title + primary artist. */
export async function findExistingIdentities(
  env: Env,
  tracks: Array<{ id?: string; title: string; artist: string }>,
): Promise<CatalogIdentitySets> {
  const ids = await findExistingTrackIds(
    env,
    tracks.map((track) => track.id).filter((id): id is string => Boolean(id)),
  )
  const incomingKeys = new Set(
    tracks.map((track) => songIdentityKey(track)).filter((key) => key.length > 1),
  )
  const songKeys = await findExistingSongKeys(env, [...incomingKeys])

  const titles = [
    ...new Set(tracks.map((track) => track.title.trim().toLowerCase()).filter(Boolean)),
  ]
  if (titles.length === 0) return { ids, songKeys }

  const db = requireDb(env)
  for (let index = 0; index < titles.length; index += MAX_IN_PARAMS) {
    const batch = titles.slice(index, index + MAX_IN_PARAMS)
    const result = await db
      .prepare(
        `SELECT id, title, artist, song_key FROM tracks
         WHERE lower(title) IN (${batch.map(() => '?').join(', ')})`,
      )
      .bind(...batch)
      .all<{ id: string; title: string; artist: string; song_key: string | null }>()
    for (const row of result.results ?? []) {
      const key = row.song_key || songIdentityKey(row)
      if (incomingKeys.has(key)) {
        songKeys.add(key)
        ids.add(row.id)
      }
    }
  }

  return { ids, songKeys }
}

function keeperScore(row: {
  album_art: string | null
  preview_url: string | null
  song_key: string | null
  updated_at: string | null
}): number {
  let score = 0
  if (row.album_art) score += 10
  if (row.preview_url) score += 10
  if (row.song_key) score += 1
  if (row.updated_at) score += 0.001
  return score
}

/** Keep one row per song_key / identity. Prefer album art + preview. */
export async function removeDuplicateTracks(env: Env): Promise<{
  removed: number
  kept: number
  groups: number
}> {
  const db = requireDb(env)
  const result = await db
    .prepare(
      `SELECT id, title, artist, song_key, album_art, preview_url, updated_at FROM tracks`,
    )
    .all<{
      id: string
      title: string
      artist: string
      song_key: string | null
      album_art: string | null
      preview_url: string | null
      updated_at: string | null
    }>()

  const groups = new Map<string, typeof result.results>()
  for (const row of result.results ?? []) {
    const key = row.song_key || songIdentityKey(row)
    if (!key) continue
    const list = groups.get(key) ?? []
    list.push(row)
    groups.set(key, list)
  }

  const deleteIds: string[] = []
  const keyUpdates: Array<{ id: string; songKey: string }> = []

  for (const [key, rows] of groups) {
    if (!rows || rows.length === 0) continue
    const ranked = [...rows].sort((left, right) => keeperScore(right) - keeperScore(left))
    const keep = ranked[0]
    if (!keep) continue
    keyUpdates.push({ id: keep.id, songKey: key })
    for (const extra of ranked.slice(1)) {
      deleteIds.push(extra.id)
    }
  }

  for (let index = 0; index < deleteIds.length; index += MAX_IN_PARAMS) {
    const batch = deleteIds.slice(index, index + MAX_IN_PARAMS)
    await db
      .prepare(`DELETE FROM tracks WHERE id IN (${batch.map(() => '?').join(', ')})`)
      .bind(...batch)
      .run()
  }

  const now = new Date().toISOString()
  const updates = keyUpdates.map((item) =>
    db
      .prepare(
        `UPDATE tracks SET song_key = ?, updated_at = ?
         WHERE id = ? AND (song_key IS NULL OR song_key = '' OR song_key != ?)`,
      )
      .bind(item.songKey, now, item.id, item.songKey),
  )
  for (let index = 0; index < updates.length; index += 100) {
    await db.batch(updates.slice(index, index + 100))
  }

  return {
    removed: deleteIds.length,
    kept: keyUpdates.length,
    groups: groups.size,
  }
}

export async function findTrackById(env: Env, id: string): Promise<Track | undefined> {
  const db = requireDb(env)
  const row = await db.prepare('SELECT * FROM tracks WHERE id = ?').bind(id).first<TrackRow>()
  return row ? rowToTrack(row) : undefined
}

const FAME_SQL = `(
  0.62 * COALESCE(popularity, 0)
  + 0.22 * COALESCE(artist_popularity, 0)
  + CASE WHEN COALESCE(chart_boost, 0) = 1 THEN 16 ELSE 0 END
  + CASE WHEN force_tier = 'easy' THEN 10 ELSE 0 END
  + CASE difficulty
      WHEN 'easy' THEN 28
      WHEN 'medium' THEN 14
      WHEN 'hard' THEN 6
      ELSE 0
    END
  - CASE
      WHEN COALESCE(popularity, 0) < 40
        AND COALESCE(chart_boost, 0) = 0
        AND release_year IS NOT NULL
        AND release_year >= CAST(strftime('%Y', 'now') AS INTEGER) - 1
      THEN 22
      ELSE 0
    END
)`

function fameThreshold(difficulty: Difficulty): number {
  switch (difficulty) {
    case 'easy':
      return 42
    case 'medium':
      return 28
    case 'hard':
      return 14
    case 'expert':
      return 6
    case 'impossible':
      return 0
    default: {
      const _never: never = difficulty
      throw new Error(`Unhandled difficulty: ${_never}`)
    }
  }
}

function shouldApplyFameGate(filters: CatalogFilters, fameGate: boolean): boolean {
  return fameGate && filters.countries.length === 0
}

const FAME_GATE_SQL = ` AND ${FAME_SQL} >= CASE difficulty
  WHEN 'easy' THEN 42
  WHEN 'medium' THEN 28
  WHEN 'hard' THEN 14
  WHEN 'expert' THEN 6
  ELSE 0
END`

export async function getAvailabilityCounts(
  env: Env,
  filters: CatalogFilters,
  options: { fameGate?: boolean } = {},
): Promise<Record<Difficulty, number>> {
  const db = requireDb(env)
  const { sql, params } = buildFilterSql(filters)
  const fameSql = shouldApplyFameGate(filters, options.fameGate !== false) ? FAME_GATE_SQL : ''
  const result = await db
    .prepare(
      `SELECT difficulty, COUNT(*) AS n FROM tracks WHERE 1 = 1${sql}${fameSql} GROUP BY difficulty`,
    )
    .bind(...params)
    .all<{ difficulty: Difficulty; n: number }>()

  const counts = Object.fromEntries(DIFFICULTIES.map((item) => [item, 0])) as Record<
    Difficulty,
    number
  >
  for (const row of result.results ?? []) {
    if (DIFFICULTIES.includes(row.difficulty)) {
      counts[row.difficulty] = row.n
    }
  }
  return counts
}

export async function getDifficultyDistribution(
  env: Env,
): Promise<Record<Difficulty, number>> {
  return getAvailabilityCounts(env, EMPTY_CATALOG_FILTERS, { fameGate: false })
}

async function pickOne(
  db: D1Database,
  difficulty: Difficulty,
  filterSql: string,
  filterParams: SqlValue[],
  extraSql: string,
  extraParams: SqlValue[],
  useFame: boolean,
): Promise<Track | null> {
  if (useFame) {
    const thresholds = [
      fameThreshold(difficulty),
      Math.floor(fameThreshold(difficulty) / 2),
      0,
    ]
    for (const minFame of thresholds) {
      const row = await db
        .prepare(
          `SELECT * FROM tracks
           WHERE difficulty = ?${filterSql}${extraSql} AND ${FAME_SQL} >= ?
           ORDER BY (${FAME_SQL} + 15) * ((ABS(RANDOM()) % 80) + 20) DESC
           LIMIT 1`,
        )
        .bind(difficulty, ...filterParams, ...extraParams, minFame)
        .first<TrackRow>()
      if (row) return rowToTrack(row)
    }
  }

  const row = await db
    .prepare(
      `SELECT * FROM tracks WHERE difficulty = ?${filterSql}${extraSql} ORDER BY RANDOM() LIMIT 1`,
    )
    .bind(difficulty, ...filterParams, ...extraParams)
    .first<TrackRow>()
  return row ? rowToTrack(row) : null
}

export async function pickRandomTrack(
  env: Env,
  difficulty: Difficulty,
  filters: CatalogFilters = EMPTY_CATALOG_FILTERS,
  excludeIds: ReadonlySet<string> = new Set(),
  excludeSongKeys: ReadonlySet<string> = new Set(),
): Promise<Track | null> {
  const db = requireDb(env)
  const { sql: filterSql, params: filterParams } = buildFilterSql(filters)
  const ids = [...excludeIds]
  const keys = [...excludeSongKeys]
  const idClause = inClause('id', ids)
  const keyClause = inClause('song_key', keys)

  const attempts: Array<{ sql: string; params: SqlValue[] }> = [
    { sql: `${idClause.sql}${keyClause.sql}`, params: [...idClause.params, ...keyClause.params] },
    { sql: keyClause.sql, params: keyClause.params },
    { sql: idClause.sql, params: idClause.params },
    { sql: '', params: [] },
  ]

  const useFame = shouldApplyFameGate(filters, true)
  for (const attempt of attempts) {
    const track = await pickOne(
      db,
      difficulty,
      filterSql,
      filterParams,
      attempt.sql,
      attempt.params,
      useFame,
    )
    if (track) return track
  }
  return null
}

export async function searchCatalog(env: Env, query: string, limit = 50): Promise<Track[]> {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return []

  const db = requireDb(env)
  const pattern = likePattern(normalized)
  const result = await db
    .prepare(
      `SELECT * FROM tracks
       WHERE lower(title) LIKE ? ESCAPE '\\' OR lower(artist) LIKE ? ESCAPE '\\'
       ORDER BY title
       LIMIT ?`,
    )
    .bind(pattern, pattern, limit)
    .all<TrackRow>()

  return dedupeTracks((result.results ?? []).map(rowToTrack))
}

export async function insertTracks(
  env: Env,
  tracks: Track[],
): Promise<AddTracksToCatalogResult> {
  const db = requireDb(env)
  const totalBefore = await countTracks(env)
  if (tracks.length === 0) {
    return { added: 0, totalTracks: totalBefore, skippedExisting: 0, skippedCap: 0 }
  }

  const identities = await findExistingIdentities(env, tracks)
  const existing = identities.ids
  const existingKeys = identities.songKeys
  let skippedExisting = 0
  let skippedCap = 0
  const incoming: Track[] = []
  let remainingCap = Math.max(0, MAX_CATALOG_TRACKS - totalBefore)

  for (const track of tracks) {
    const key = songIdentityKey(track)
    if (existing.has(track.id) || existingKeys.has(key)) {
      skippedExisting += 1
      continue
    }
    if (remainingCap <= 0) {
      skippedCap += 1
      continue
    }
    existing.add(track.id)
    existingKeys.add(key)
    incoming.push(track)
    remainingCap -= 1
  }

  if (incoming.length === 0) {
    return { added: 0, totalTracks: totalBefore, skippedExisting, skippedCap }
  }

  const now = new Date().toISOString()
  const statements = incoming.map((track) => db.prepare(INSERT_SQL).bind(...trackBindValues(track, now)))
  for (let index = 0; index < statements.length; index += 100) {
    await db.batch(statements.slice(index, index + 100))
  }

  return {
    added: incoming.length,
    totalTracks: totalBefore + incoming.length,
    skippedExisting,
    skippedCap,
  }
}

export interface UpsertTracksResult extends AddTracksToCatalogResult {
  updated: number
}

export async function upsertTracks(
  env: Env,
  tracks: Track[],
): Promise<UpsertTracksResult> {
  const db = requireDb(env)
  const totalBefore = await countTracks(env)
  if (tracks.length === 0) {
    return { added: 0, updated: 0, totalTracks: totalBefore, skippedExisting: 0, skippedCap: 0 }
  }

  const identities = await findExistingIdentities(env, tracks)
  const existing = identities.ids
  const existingKeys = identities.songKeys
  let skippedCap = 0
  let remainingCap = Math.max(0, MAX_CATALOG_TRACKS - totalBefore)
  const incoming: Track[] = []

  for (const track of tracks) {
    const key = songIdentityKey(track)
    if (existing.has(track.id)) {
      incoming.push(track)
      continue
    }
    if (existingKeys.has(key)) {
      continue
    }
    if (remainingCap <= 0) {
      skippedCap += 1
      continue
    }
    existingKeys.add(key)
    incoming.push(track)
    remainingCap -= 1
  }

  if (incoming.length === 0) {
    return { added: 0, updated: 0, totalTracks: totalBefore, skippedExisting: 0, skippedCap }
  }

  const now = new Date().toISOString()
  const statements = incoming.map((track) => db.prepare(UPSERT_SQL).bind(...trackBindValues(track, now)))
  for (let index = 0; index < statements.length; index += 100) {
    await db.batch(statements.slice(index, index + 100))
  }

  const added = incoming.filter((track) => !existing.has(track.id)).length
  const updated = incoming.length - added
  return {
    added,
    updated,
    totalTracks: totalBefore + added,
    skippedExisting: 0,
    skippedCap,
  }
}

export async function addTrackToCatalog(env: Env, track: Track): Promise<CatalogMutationResult> {
  const result = await insertTracks(env, [track])
  if (result.skippedExisting > 0) {
    return { ok: false, reason: 'Track already in catalog', totalTracks: result.totalTracks }
  }
  if (result.skippedCap > 0) {
    return {
      ok: false,
      reason: `Catalog at ${MAX_CATALOG_TRACKS.toLocaleString()} track cap`,
      totalTracks: result.totalTracks,
    }
  }
  return { ok: true, totalTracks: result.totalTracks }
}

export async function removeTrackFromCatalog(
  env: Env,
  trackId: string,
): Promise<CatalogMutationResult> {
  const db = requireDb(env)
  const id = decodeURIComponent(trackId).trim()
  if (!id) {
    return { ok: false, reason: 'Track id is required', totalTracks: await countTracks(env) }
  }

  const existing = await db.prepare('SELECT id FROM tracks WHERE id = ?').bind(id).first<{ id: string }>()
  if (!existing) {
    return { ok: false, reason: 'Track not found', totalTracks: await countTracks(env) }
  }

  await db.prepare('DELETE FROM tracks WHERE id = ?').bind(id).run()
  return { ok: true, totalTracks: await countTracks(env) }
}

export interface TrackMetricsPatch {
  id: string
  title?: string
  artist?: string
  albumArt?: string
  popularity?: number
  artistPopularity?: number
  releaseYear?: number
  releaseDate?: string
  durationMs?: number
  spotifyGenres?: string[]
  difficulty: Difficulty
}

export interface ChartImportPatch {
  id: string
  popularity?: number
  artistPopularity?: number
  releaseYear?: number
  releaseDate?: string
  spotifyGenres?: string[]
  difficulty: Difficulty
  country: CountryCode
  catalog: CatalogKind
  forceTier: Difficulty
}

export async function applyChartImportPatches(
  env: Env,
  patches: ChartImportPatch[],
): Promise<number> {
  if (patches.length === 0) return 0
  const db = requireDb(env)
  const now = new Date().toISOString()
  const statements = patches.map((patch) =>
    db
      .prepare(
        `UPDATE tracks SET
           popularity = COALESCE(?, popularity),
           artist_popularity = COALESCE(?, artist_popularity),
           release_year = COALESCE(?, release_year),
           release_date = COALESCE(?, release_date),
           spotify_genres = COALESCE(?, spotify_genres),
           difficulty = ?,
           country = ?,
           catalog = ?,
           chart_boost = 1,
           force_tier = ?,
           updated_at = ?
         WHERE id = ?`,
      )
      .bind(
        patch.popularity ?? null,
        patch.artistPopularity ?? null,
        patch.releaseYear ?? null,
        patch.releaseDate ?? null,
        patch.spotifyGenres ? JSON.stringify(patch.spotifyGenres) : null,
        patch.difficulty,
        patch.country,
        patch.catalog,
        patch.forceTier,
        now,
        patch.id,
      ),
  )

  let updated = 0
  for (let index = 0; index < statements.length; index += 100) {
    const result = await db.batch(statements.slice(index, index + 100))
    updated += result.reduce((sum, item) => sum + (item.meta?.changes ?? 0), 0)
  }
  return updated
}

export async function applyTrackMetricPatches(
  env: Env,
  patches: TrackMetricsPatch[],
): Promise<number> {
  if (patches.length === 0) return 0
  const db = requireDb(env)
  const now = new Date().toISOString()
  const statements = patches.map((patch) =>
    db
      .prepare(
        `UPDATE tracks SET
           title = COALESCE(?, title),
           artist = COALESCE(?, artist),
           album_art = COALESCE(?, album_art),
           popularity = ?,
           artist_popularity = ?,
           release_year = COALESCE(?, release_year),
           release_date = COALESCE(?, release_date),
           duration_ms = COALESCE(?, duration_ms),
           spotify_genres = COALESCE(?, spotify_genres),
           difficulty = CASE
             WHEN chart_boost = 1 THEN CASE
               WHEN ? IN ('easy', 'medium') THEN ?
               ELSE COALESCE(force_tier, 'medium')
             END
             ELSE ?
           END,
           updated_at = ?,
           spotify_synced_at = ?
         WHERE id = ?`,
      )
      .bind(
        patch.title ?? null,
        patch.artist ?? null,
        patch.albumArt ?? null,
        patch.popularity ?? null,
        patch.artistPopularity ?? null,
        patch.releaseYear ?? null,
        patch.releaseDate ?? null,
        patch.durationMs ?? null,
        patch.spotifyGenres ? JSON.stringify(patch.spotifyGenres) : null,
        patch.difficulty,
        patch.difficulty,
        patch.difficulty,
        now,
        now,
        patch.id,
      ),
  )

  let updated = 0
  for (let index = 0; index < statements.length; index += 100) {
    const result = await db.batch(statements.slice(index, index + 100))
    updated += result.reduce((sum, item) => sum + (item.meta?.changes ?? 0), 0)
  }
  return updated
}

function searchWhere(query: string): { sql: string; params: SqlValue[] } {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return { sql: '', params: [] }
  const pattern = likePattern(normalized)
  return {
    sql: ` AND (lower(title) LIKE ? ESCAPE '\\' OR lower(artist) LIKE ? ESCAPE '\\' OR lower(id) LIKE ? ESCAPE '\\')`,
    params: [pattern, pattern, pattern],
  }
}

function listFilterSql(filters: CatalogListFilters): { sql: string; params: SqlValue[] } {
  const clauses: string[] = []
  const params: SqlValue[] = []

  if (filters.difficulty) {
    clauses.push('difficulty = ?')
    params.push(filters.difficulty)
  }
  if (filters.genre) {
    clauses.push('EXISTS (SELECT 1 FROM json_each(tracks.genre_groups) WHERE json_each.value = ?)')
    params.push(filters.genre)
  }
  if (filters.era) {
    clauses.push(eraSql(filters.era))
  }
  if (filters.country) {
    clauses.push('country = ?')
    params.push(filters.country)
  }
  if (filters.missingPreview) {
    clauses.push("(preview_url IS NULL OR preview_url = '')")
  }

  return {
    sql: clauses.length > 0 ? ` AND ${clauses.join(' AND ')}` : '',
    params,
  }
}

function emptyFacetCounts() {
  return {
    difficulty: Object.fromEntries(DIFFICULTIES.map((item) => [item, 0])) as Record<
      Difficulty,
      number
    >,
    genre: Object.fromEntries(GENRE_OPTIONS.map((item) => [item, 0])) as Record<GenreFilter, number>,
    era: Object.fromEntries(ERA_OPTIONS.map((item) => [item, 0])) as Record<EraFilter, number>,
    country: {} as Record<string, number>,
    missingPreview: 0,
  }
}

export async function listCatalogPage(
  env: Env,
  page: number,
  pageSize: number,
  query: string,
  filters: CatalogListFilters,
): Promise<CatalogListPage> {
  const db = requireDb(env)
  const search = searchWhere(query)
  const filter = listFilterSql(filters)
  const searchedWhere = `WHERE 1 = 1${search.sql}`
  const filteredWhere = `${searchedWhere}${filter.sql}`

  const [difficultyRows, genreRows, eraRows, countryRows, missingRow, totalRow] = await db.batch<
    {
      difficulty?: Difficulty
      n?: number
      genre?: GenreFilter
      era?: EraFilter | null
      country?: string
      total?: number
    }
  >([
    db
      .prepare(
        `SELECT difficulty, COUNT(*) AS n FROM tracks ${searchedWhere} GROUP BY difficulty`,
      )
      .bind(...search.params),
    db
      .prepare(
        `SELECT json_each.value AS genre, COUNT(*) AS n
         FROM tracks, json_each(tracks.genre_groups)
         ${searchedWhere}
         GROUP BY json_each.value`,
      )
      .bind(...search.params),
    db
      .prepare(
        `SELECT CASE
           WHEN release_year >= 2020 THEN 'modern'
           WHEN release_year >= 2010 THEN '2010s'
           WHEN release_year >= 2000 THEN '2000s'
           WHEN release_year IS NOT NULL THEN 'classics'
           ELSE NULL
         END AS era, COUNT(*) AS n
         FROM tracks ${searchedWhere}
         GROUP BY era`,
      )
      .bind(...search.params),
    db
      .prepare(
        `SELECT country, COUNT(*) AS n FROM tracks ${searchedWhere} GROUP BY country`,
      )
      .bind(...search.params),
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM tracks ${searchedWhere} AND (preview_url IS NULL OR preview_url = '')`,
      )
      .bind(...search.params),
    db.prepare(`SELECT COUNT(*) AS total FROM tracks ${filteredWhere}`).bind(...search.params, ...filter.params),
  ])

  const counts = emptyFacetCounts()
  for (const row of difficultyRows.results ?? []) {
    if (row.difficulty && DIFFICULTIES.includes(row.difficulty)) {
      counts.difficulty[row.difficulty] = row.n ?? 0
    }
  }
  for (const row of genreRows.results ?? []) {
    if (row.genre && GENRE_OPTIONS.includes(row.genre)) {
      counts.genre[row.genre] = row.n ?? 0
    }
  }
  for (const row of eraRows.results ?? []) {
    if (row.era && ERA_OPTIONS.includes(row.era)) {
      counts.era[row.era] = row.n ?? 0
    }
  }
  for (const row of countryRows.results ?? []) {
    const country = parseCountry(row.country)
    counts.country[country] = (counts.country[country] ?? 0) + (row.n ?? 0)
  }
  counts.missingPreview = missingRow.results?.[0]?.n ?? 0

  const total = totalRow.results?.[0]?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(Math.max(page, 1), totalPages)
  const offset = (safePage - 1) * pageSize

  const pageResult = await db
    .prepare(
      `SELECT * FROM tracks ${filteredWhere} ORDER BY title LIMIT ? OFFSET ?`,
    )
    .bind(...search.params, ...filter.params, pageSize, offset)
    .all<TrackRow>()

  return {
    tracks: (pageResult.results ?? []).map((row) => {
      const track = rowToTrack(row)
      return {
        id: track.id,
        title: track.title,
        artist: track.artist,
        difficulty: track.difficulty,
        releaseYear: track.releaseYear,
        genreGroups: parseGenreGroups(row.genre_groups),
        era: eraFromYear(row.release_year),
        albumArt: track.albumArt,
        hasPreview: Boolean(track.previewUrl),
        popularity: track.popularity,
        country: track.country ?? DEFAULT_COUNTRY,
        catalog: track.catalog ?? DEFAULT_CATALOG,
        releaseDate: track.releaseDate,
        spotifyGenres: track.spotifyGenres ?? [],
      }
    }),
    page: safePage,
    pageSize,
    total,
    totalPages,
    counts,
  }
}

export async function listCatalogCountries(env: Env): Promise<Array<{ country: CountryCode; count: number }>> {
  const db = requireDb(env)
  const result = await db
    .prepare(`SELECT country, COUNT(*) AS n FROM tracks GROUP BY country`)
    .all<{ country: string | null; n: number }>()

  const counts = new Map<CountryCode, number>()
  for (const row of result.results ?? []) {
    const country = parseCountry(row.country)
    counts.set(country, (counts.get(country) ?? 0) + (row.n ?? 0))
  }
  return [...counts.entries()].map(([country, count]) => ({ country, count }))
}

export async function listTracksMissingAlbumArt(
  env: Env,
): Promise<Array<{ id: string; title: string; artist: string }>> {
  const db = requireDb(env)
  const result = await db
    .prepare(`SELECT id, title, artist FROM tracks WHERE album_art IS NULL OR album_art = ''`)
    .all<{ id: string; title: string; artist: string }>()
  return result.results ?? []
}

export interface OembedPatch {
  id: string
  title?: string
  artist?: string
  albumArt?: string
}

export async function applyOembedPatches(env: Env, patches: OembedPatch[]): Promise<number> {
  const usable = patches.filter((patch) => patch.id && (patch.title || patch.artist || patch.albumArt))
  if (usable.length === 0) return 0

  const db = requireDb(env)
  const now = new Date().toISOString()
  const statements = usable.map((patch) =>
    db
      .prepare(
        `UPDATE tracks SET
           title = COALESCE(?, title),
           artist = COALESCE(?, artist),
           album_art = COALESCE(?, album_art),
           updated_at = ?
         WHERE id = ?`,
      )
      .bind(patch.title ?? null, patch.artist ?? null, patch.albumArt ?? null, now, patch.id),
  )

  let updated = 0
  for (let index = 0; index < statements.length; index += 100) {
    const result = await db.batch(statements.slice(index, index + 100))
    updated += result.reduce((sum, item) => sum + (item.meta?.changes ?? 0), 0)
  }
  return updated
}

export async function applyAlbumArtPatches(
  env: Env,
  patches: Array<{ id: string; albumArt: string }>,
): Promise<number> {
  const usable = patches.filter((patch) => patch.id && patch.albumArt)
  if (usable.length === 0) return 0

  const db = requireDb(env)
  const now = new Date().toISOString()
  const statements = usable.map((patch) =>
    db
      .prepare(
        `UPDATE tracks SET album_art = ?, updated_at = ?
         WHERE id = ? AND (album_art IS NULL OR album_art = '')`,
      )
      .bind(patch.albumArt, now, patch.id),
  )

  let updated = 0
  for (let index = 0; index < statements.length; index += 100) {
    const result = await db.batch(statements.slice(index, index + 100))
    updated += result.reduce((sum, item) => sum + (item.meta?.changes ?? 0), 0)
  }
  return updated
}
