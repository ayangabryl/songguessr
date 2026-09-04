import {
  DEFAULT_CATALOG,
  DEFAULT_COUNTRY,
  isCatalogKind,
  isCountryCode,
  type CatalogKind,
  type CountryCode,
} from '../shared/catalog-meta'
import { mapRequestedPoolTier, poolTierCaseSql } from './difficulty'
import {
  EMPTY_CATALOG_FILTERS,
  ERA_OPTIONS,
  GENRE_OPTIONS,
  type CatalogFilters,
  type EraFilter,
  type GenreFilter,
} from './filters'
import { compareVariants, dedupeTracks, songIdentityKey } from './track-dedupe'
import { findVariantRowsByIdentity } from './variant-rows'
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
  play_count: number | null
  play_count_updated_at: string | null
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
  popularityFilled: number
  popularityMissing: number
  playCountFilled: number
  playCountMissing: number
  /** Rows whose play count has never been stamped, so a sweep should revisit. */
  playCountStale: number
  releaseDateFilled: number
  releaseDateMissing: number
  previewMissing: number
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
  /** Rows dropped because an incoming recording of the same song scored better. */
  replaced?: number
}

export interface CatalogListFilters {
  difficulty?: Difficulty
  genre?: GenreFilter
  era?: EraFilter
  country?: CountryCode
  collection?: CatalogKind
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
    playCount?: number
    playCountUpdatedAt?: string
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
    playCount: row.play_count ?? undefined,
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
    track.playCount ?? null,
    track.playCount != null ? now : null,
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
  album_art, difficulty, popularity, play_count, play_count_updated_at, artist_popularity,
  release_year, release_date, duration_ms,
  genre_groups, spotify_genres, song_key, updated_at, spotify_synced_at, country, catalog,
  chart_boost, force_tier`

const INSERT_PLACEHOLDERS = `?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?`

const INSERT_SQL = `INSERT INTO tracks (${INSERT_COLUMNS}) VALUES (${INSERT_PLACEHOLDERS})`

const UPSERT_SQL = `INSERT INTO tracks (${INSERT_COLUMNS}) VALUES (${INSERT_PLACEHOLDERS})
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
    play_count = COALESCE(excluded.play_count, tracks.play_count),
    play_count_updated_at = COALESCE(excluded.play_count_updated_at, tracks.play_count_updated_at),
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

  if (filters.collections.length > 0) {
    const placeholders = filters.collections.map(() => '?').join(', ')
    clauses.push(`(
      catalog IN (${placeholders})
      OR EXISTS (
        SELECT 1 FROM track_collections tc
        WHERE tc.track_id = tracks.id AND tc.collection_id IN (${placeholders})
      )
    )`)
    params.push(...filters.collections, ...filters.collections)
  }

  if (filters.artists.length > 0) {
    const artistClauses = filters.artists.map(
      () =>
        `instr(',' || lower(replace(artist, ', ', ',')) || ',', ',' || lower(?) || ',') > 0`,
    )
    clauses.push(`(${artistClauses.join(' OR ')})`)
    params.push(...filters.artists)
  }

  return {
    sql: clauses.length > 0 ? ` AND ${clauses.join(' AND ')}` : '',
    params,
  }
}

function collectionFilterCatalogOnly(filters: CatalogFilters): { sql: string; params: SqlValue[] } {
  if (filters.collections.length === 0) return { sql: '', params: [] }
  const placeholders = filters.collections.map(() => '?').join(', ')
  return {
    sql: ` AND catalog IN (${placeholders})`,
    params: [...filters.collections],
  }
}

function buildFilterSqlWithFallback(
  filters: CatalogFilters,
  joinTable: boolean,
): { sql: string; params: SqlValue[] } {
  if (joinTable || filters.collections.length === 0) return buildFilterSql(filters)

  const withoutCollections = buildFilterSql({ ...filters, collections: [] })
  const catalogOnly = collectionFilterCatalogOnly(filters)
  return {
    sql: `${withoutCollections.sql}${catalogOnly.sql}`,
    params: [...withoutCollections.params, ...catalogOnly.params],
  }
}

/** How many tier rows to shuffle in SQL before the crypto weighted pick. */
const RANDOM_CANDIDATE_LIMIT = 48

function preferGlobalMix(filters: CatalogFilters): boolean {
  return (
    filters.countries.length === 0 &&
    filters.collections.length === 0 &&
    filters.artists.length === 0
  )
}

function requestSalt(): number {
  const values = new Uint32Array(1)
  crypto.getRandomValues(values)
  return (values[0] || 1) >>> 0
}

function cryptoRandomUnit(): number {
  const values = new Uint32Array(1)
  crypto.getRandomValues(values)
  return (values[0] ?? 0) / 0x1_0000_0000
}

function globalMixWeight(row: TrackRow, filters: CatalogFilters): number {
  if (!preferGlobalMix(filters)) return 1
  if (row.country === 'GLOBAL' || row.catalog === 'global') return 2
  return 1
}

function pickWeightedRowIndex(rows: TrackRow[], filters: CatalogFilters): number {
  if (rows.length <= 1) return 0
  let total = 0
  const weights = rows.map((row) => {
    const weight = globalMixWeight(row, filters)
    total += weight
    return weight
  })
  let ticket = cryptoRandomUnit() * total
  for (let index = 0; index < weights.length; index += 1) {
    ticket -= weights[index] ?? 1
    if (ticket <= 0) return index
  }
  return rows.length - 1
}

/**
 * Permute candidates with a per-request salt mixed into each track id.
 * Independent of SQLite RANDOM(), which some builds evaluate once per statement
 * and which a 4× weight × tiny jitter range had collapsed onto the same Global hits.
 */
function candidateShuffleSql(): string {
  return `((
    unicode(substr(id, 1, 1)) * 131
    + unicode(substr(id, 2, 1)) * 137
    + unicode(substr(id, 3, 1)) * 139
    + unicode(substr(id, length(id), 1)) * 149
    + length(id)
  ) * ? % 2000000011)`
}

/**
 * Rank the filtered pool by blended relative fame, then slice into game tiers.
 * Missing popularity / plays are skipped (never treated as 0). Cutpoints are
 * percentiles of *this* pool, so they move as the catalog grows.
 */
function poolTieredCte(filterSql: string): string {
  return `WITH pool AS (
      SELECT
        tracks.*,
        CASE WHEN play_count IS NOT NULL AND play_count > 0 THEN 1 ELSE 0 END AS has_plays,
        CASE WHEN popularity IS NOT NULL THEN 1 ELSE 0 END AS has_pop,
        CASE
          WHEN play_count IS NOT NULL AND play_count > 0 AND release_year IS NOT NULL THEN 1
          ELSE 0
        END AS has_vel,
        CASE WHEN artist_popularity IS NOT NULL THEN 1 ELSE 0 END AS has_artist,
        CASE
          WHEN play_count IS NOT NULL AND play_count > 0 AND release_year IS NOT NULL
          THEN play_count * 1.0 / MAX(1, CAST(strftime('%Y', 'now') AS INTEGER) - release_year + 1)
        END AS velocity
      FROM tracks
      WHERE 1 = 1${filterSql}
    ),
    ranked AS (
      SELECT
        pool.*,
        CASE
          WHEN has_plays = 1
          THEN PERCENT_RANK() OVER (PARTITION BY has_plays ORDER BY play_count ASC)
        END AS play_pct,
        CASE
          WHEN has_pop = 1
          THEN PERCENT_RANK() OVER (PARTITION BY has_pop ORDER BY popularity ASC)
        END AS pop_pct,
        CASE
          WHEN has_vel = 1
          THEN PERCENT_RANK() OVER (PARTITION BY has_vel ORDER BY velocity ASC)
        END AS vel_pct,
        CASE
          WHEN has_artist = 1
          THEN PERCENT_RANK() OVER (PARTITION BY has_artist ORDER BY artist_popularity ASC)
        END AS artist_pct,
        COUNT(*) OVER () AS pool_n
      FROM pool
    ),
    scored AS (
      SELECT
        ranked.*,
        CASE
          WHEN (has_plays * 0.65 + has_pop * 0.20 + has_vel * 0.10 + has_artist * 0.05) = 0
          THEN 0.5
          ELSE (
            COALESCE(play_pct, 0) * has_plays * 0.65
            + COALESCE(pop_pct, 0) * has_pop * 0.20
            + COALESCE(vel_pct, 0) * has_vel * 0.10
            + COALESCE(artist_pct, 0) * has_artist * 0.05
          ) / (has_plays * 0.65 + has_pop * 0.20 + has_vel * 0.10 + has_artist * 0.05)
        END
        + CASE WHEN COALESCE(chart_boost, 0) = 1 THEN 0.03 ELSE 0 END AS pool_score
      FROM ranked
    ),
    fame AS (
      SELECT
        scored.*,
        PERCENT_RANK() OVER (ORDER BY pool_score ASC) AS fame_pct
      FROM scored
    ),
    tiered AS (
      SELECT fame.*, ${poolTierCaseSql()} AS pool_tier
      FROM fame
    )`
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
      `SELECT
         COUNT(*) AS count,
         MAX(updated_at) AS updated_at,
         MAX(spotify_synced_at) AS spotify_synced_at,
         -- A stored 0 is a real Spotify answer, so only NULL counts as missing.
         SUM(CASE WHEN popularity IS NOT NULL THEN 1 ELSE 0 END) AS popularity_filled,
         SUM(CASE WHEN popularity IS NULL THEN 1 ELSE 0 END) AS popularity_missing,
         SUM(CASE WHEN play_count IS NOT NULL THEN 1 ELSE 0 END) AS play_count_filled,
         SUM(CASE WHEN play_count IS NULL THEN 1 ELSE 0 END) AS play_count_missing,
         SUM(CASE WHEN play_count_updated_at IS NULL THEN 1 ELSE 0 END) AS play_count_stale,
         SUM(CASE WHEN release_date IS NOT NULL AND release_date != '' THEN 1 ELSE 0 END) AS release_date_filled,
         SUM(CASE WHEN release_date IS NULL OR release_date = '' THEN 1 ELSE 0 END) AS release_date_missing,
         SUM(CASE WHEN preview_url IS NULL OR preview_url = '' THEN 1 ELSE 0 END) AS preview_missing
       FROM tracks`,
    )
    .first<{
      count: number
      updated_at: string | null
      spotify_synced_at: string | null
      popularity_filled: number | null
      popularity_missing: number | null
      play_count_filled: number | null
      play_count_missing: number | null
      play_count_stale: number | null
      release_date_filled: number | null
      release_date_missing: number | null
      preview_missing: number | null
    }>()

  return {
    count: row?.count ?? 0,
    updatedAt: row?.updated_at ?? null,
    spotifySyncedAt: row?.spotify_synced_at ?? null,
    popularityFilled: row?.popularity_filled ?? 0,
    popularityMissing: row?.popularity_missing ?? 0,
    playCountFilled: row?.play_count_filled ?? 0,
    playCountMissing: row?.play_count_missing ?? 0,
    playCountStale: row?.play_count_stale ?? 0,
    releaseDateFilled: row?.release_date_filled ?? 0,
    releaseDateMissing: row?.release_date_missing ?? 0,
    previewMissing: row?.preview_missing ?? 0,
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

/**
 * Tracks that still need public stats, oldest attempt first.
 *
 * `play_count_updated_at IS NULL` is the retry marker: a track whose enrichment
 * failed keeps a null timestamp and is picked up again, while a track Spotify
 * genuinely has no play count for is only retried once its timestamp ages out.
 *
 * A stored popularity of 0 is a real answer, not a gap: Spotify rates live and
 * concert-album cuts that way. Only NULL means "never fetched", so zeros are
 * left alone instead of being re-requested on every sweep.
 */
export async function listTrackIdsMissingPublicStats(
  env: Env,
  limit = 250,
  collection?: CatalogKind,
): Promise<string[]> {
  const db = requireDb(env)
  const scoped = adminCollectionWhere(collection)
  const result = await db
    .prepare(
      `SELECT id FROM tracks
       WHERE (
            play_count_updated_at IS NULL
         OR play_count IS NULL
         OR popularity IS NULL
         OR artist_popularity IS NULL
         OR release_date IS NULL
         OR release_date = ''
       )${scoped.sql}
       ORDER BY (play_count_updated_at IS NOT NULL), play_count_updated_at ASC,
         (spotify_synced_at IS NOT NULL), spotify_synced_at ASC
       LIMIT ?`,
    )
    .bind(...scoped.params, limit)
    .all<{ id: string }>()
  return (result.results ?? []).map((row) => row.id)
}

/** Refresh targets once every track has stats: least recently synced first. */
export async function listTrackIdsStalestStats(
  env: Env,
  limit = 250,
  collection?: CatalogKind,
): Promise<string[]> {
  const db = requireDb(env)
  const scoped = adminCollectionWhere(collection)
  const result = await db
    .prepare(
      `SELECT id FROM tracks
       WHERE 1 = 1${scoped.sql}
       ORDER BY (play_count_updated_at IS NOT NULL), play_count_updated_at ASC
       LIMIT ?`,
    )
    .bind(...scoped.params, limit)
    .all<{ id: string }>()
  return (result.results ?? []).map((row) => row.id)
}

export async function listTrackIdsForSync(env: Env, limit = 5000): Promise<string[]> {
  const db = requireDb(env)
  const result = await db
    .prepare(
      `SELECT id FROM tracks
       ORDER BY CASE WHEN popularity IS NULL OR popularity = 0 THEN 0 ELSE 1 END,
         (spotify_synced_at IS NOT NULL),
         spotify_synced_at ASC
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

/**
 * Map incoming Spotify IDs to catalog row IDs (exact id, then song_key, then
 * normalized title + artist). Used so playlist tools retag the library row
 * even when the playlist copy has a different Spotify ID.
 */
export async function mapIncomingIdsToCatalogIds(
  env: Env,
  tracks: Array<{ id?: string; title: string; artist: string }>,
): Promise<Map<string, string>> {
  const mapped = new Map<string, string>()
  const incoming = tracks.filter((track): track is { id: string; title: string; artist: string } =>
    Boolean(track.id),
  )
  if (incoming.length === 0) return mapped

  const existingIds = await findExistingTrackIds(
    env,
    incoming.map((track) => track.id),
  )
  for (const track of incoming) {
    if (existingIds.has(track.id)) mapped.set(track.id, track.id)
  }

  const unmatched = incoming.filter((track) => !mapped.has(track.id))
  if (unmatched.length === 0) return mapped

  const keyToIncoming = new Map<string, string>()
  for (const track of unmatched) {
    const key = songIdentityKey(track)
    if (key.length > 1 && !keyToIncoming.has(key)) keyToIncoming.set(key, track.id)
  }

  const db = requireDb(env)
  const keys = [...keyToIncoming.keys()]
  for (let index = 0; index < keys.length; index += MAX_IN_PARAMS) {
    const batch = keys.slice(index, index + MAX_IN_PARAMS)
    const result = await db
      .prepare(
        `SELECT id, song_key FROM tracks WHERE song_key IN (${batch.map(() => '?').join(', ')})`,
      )
      .bind(...batch)
      .all<{ id: string; song_key: string | null }>()
    for (const row of result.results ?? []) {
      if (!row.song_key) continue
      const incomingId = keyToIncoming.get(row.song_key)
      if (incomingId && !mapped.has(incomingId)) mapped.set(incomingId, row.id)
    }
  }

  const stillUnmatched = unmatched.filter((track) => !mapped.has(track.id))
  const titles = [
    ...new Set(stillUnmatched.map((track) => track.title.trim().toLowerCase()).filter(Boolean)),
  ]
  if (titles.length === 0) return mapped

  const incomingByKey = new Map<string, string>()
  for (const track of stillUnmatched) {
    const key = songIdentityKey(track)
    if (key.length > 1 && !incomingByKey.has(key)) incomingByKey.set(key, track.id)
  }

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
      const incomingId = incomingByKey.get(key)
      if (incomingId && !mapped.has(incomingId)) mapped.set(incomingId, row.id)
    }
  }

  return mapped
}

/**
 * Keep one row per song identity, including version variants.
 *
 * Grouping recomputes the canonical key instead of trusting `song_key`, so
 * rows written before the canonicalizer learned a qualifier still collapse, and
 * the surviving row has its key rewritten to match.
 */
export async function removeDuplicateTracks(env: Env): Promise<{
  removed: number
  kept: number
  groups: number
}> {
  const db = requireDb(env)
  const result = await db
    .prepare(
      `SELECT id, title, artist, song_key, album_art, preview_url, play_count, popularity, updated_at
       FROM tracks`,
    )
    .all<{
      id: string
      title: string
      artist: string
      song_key: string | null
      album_art: string | null
      preview_url: string | null
      play_count: number | null
      popularity: number | null
      updated_at: string | null
    }>()

  const groups = new Map<string, typeof result.results>()
  for (const row of result.results ?? []) {
    const key = songIdentityKey(row)
    if (!key) continue
    const list = groups.get(key) ?? []
    list.push(row)
    groups.set(key, list)
  }

  const deleteIds: string[] = []
  const keyUpdates: Array<{ id: string; songKey: string }> = []

  for (const [key, rows] of groups) {
    if (!rows || rows.length === 0) continue
    const ranked = [...rows].sort((left, right) =>
      compareVariants(
        { id: left.id, title: left.title, playCount: left.play_count, popularity: left.popularity, albumArt: left.album_art, previewUrl: left.preview_url },
        { id: right.id, title: right.title, playCount: right.play_count, popularity: right.popularity, albumArt: right.album_art, previewUrl: right.preview_url },
      ),
    )
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

function emptyDifficultyCounts(): Record<Difficulty, number> {
  return Object.fromEntries(DIFFICULTIES.map((item) => [item, 0])) as Record<Difficulty, number>
}

async function runFilterQuery<T>(
  db: D1Database,
  filters: CatalogFilters,
  sqlFor: (filterSql: string) => string,
): Promise<{ rows: T[]; params: SqlValue[] }> {
  const attempts: Array<{ sql: string; params: SqlValue[] }> = [
    buildFilterSqlWithFallback(filters, true),
  ]
  if (filters.collections.length > 0) {
    attempts.push(buildFilterSqlWithFallback(filters, false))
  }

  let lastError: unknown
  for (const attempt of attempts) {
    try {
      const result = await db
        .prepare(sqlFor(attempt.sql))
        .bind(...attempt.params)
        .all<T>()
      return { rows: result.results ?? [], params: attempt.params }
    } catch (error) {
      lastError = error
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Catalog filter query failed')
}

export async function getAvailabilityCounts(
  env: Env,
  filters: CatalogFilters,
): Promise<Record<Difficulty, number>> {
  const db = requireDb(env)
  const { rows } = await runFilterQuery<{ pool_tier: Difficulty; n: number }>(
    db,
    filters,
    (filterSql) =>
      `${poolTieredCte(filterSql)}
       SELECT pool_tier, COUNT(*) AS n FROM tiered GROUP BY pool_tier`,
  )

  const counts = emptyDifficultyCounts()
  for (const row of rows) {
    if (DIFFICULTIES.includes(row.pool_tier)) {
      counts[row.pool_tier] = row.n
    }
  }
  return counts
}

export async function getDifficultyDistribution(
  env: Env,
): Promise<Record<Difficulty, number>> {
  const db = requireDb(env)
  const result = await db
    .prepare(`SELECT difficulty, COUNT(*) AS n FROM tracks GROUP BY difficulty`)
    .all<{ difficulty: Difficulty; n: number }>()

  const counts = emptyDifficultyCounts()
  for (const row of result.results ?? []) {
    if (DIFFICULTIES.includes(row.difficulty)) {
      counts[row.difficulty] = row.n
    }
  }
  return counts
}

async function countFilteredPool(db: D1Database, filters: CatalogFilters): Promise<number> {
  const { rows } = await runFilterQuery<{ n: number }>(
    db,
    filters,
    (filterSql) => `SELECT COUNT(*) AS n FROM tracks WHERE 1 = 1${filterSql}`,
  )
  return rows[0]?.n ?? 0
}

async function pickOneFromPool(
  db: D1Database,
  difficulty: Difficulty,
  filters: CatalogFilters,
  extraSql: string,
  extraParams: SqlValue[],
): Promise<Track | null> {
  const salt = requestSalt()
  const attempts: Array<{ sql: string; params: SqlValue[] }> = [
    buildFilterSqlWithFallback(filters, true),
  ]
  if (filters.collections.length > 0) {
    attempts.push(buildFilterSqlWithFallback(filters, false))
  }

  let lastError: unknown
  for (const attempt of attempts) {
    try {
      const result = await db
        .prepare(
          `${poolTieredCte(attempt.sql)}
           SELECT * FROM tiered
           WHERE pool_tier = ?${extraSql}
           ORDER BY ${candidateShuffleSql()}
           LIMIT ${RANDOM_CANDIDATE_LIMIT}`,
        )
        .bind(...attempt.params, difficulty, ...extraParams, salt)
        .all<TrackRow>()
      const rows = result.results ?? []
      if (rows.length === 0) return null
      return rowToTrack(rows[pickWeightedRowIndex(rows, filters)]!)
    } catch (error) {
      lastError = error
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Catalog pick query failed')
}

export async function findTrackPoolPlacement(
  env: Env,
  trackId: string,
  filters: CatalogFilters,
): Promise<{ track: Track; tier: Difficulty; poolN: number } | null> {
  const db = requireDb(env)
  const attempts: Array<{ sql: string; params: SqlValue[] }> = [
    buildFilterSqlWithFallback(filters, true),
  ]
  if (filters.collections.length > 0) {
    attempts.push(buildFilterSqlWithFallback(filters, false))
  }

  let lastError: unknown
  for (const attempt of attempts) {
    try {
      const row = await db
        .prepare(
          `${poolTieredCte(attempt.sql)}
           SELECT * FROM tiered WHERE id = ? LIMIT 1`,
        )
        .bind(...attempt.params, trackId)
        .first<TrackRow & { pool_tier: Difficulty; pool_n: number }>()
      if (!row) return null
      return {
        track: rowToTrack(row),
        tier: row.pool_tier,
        poolN: row.pool_n,
      }
    } catch (error) {
      lastError = error
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Catalog placement query failed')
}

export async function pickRandomTrack(
  env: Env,
  difficulty: Difficulty,
  filters: CatalogFilters = EMPTY_CATALOG_FILTERS,
  excludeIds: ReadonlySet<string> = new Set(),
  excludeSongKeys: ReadonlySet<string> = new Set(),
): Promise<Track | null> {
  const db = requireDb(env)
  const poolN = await countFilteredPool(db, filters)
  if (poolN === 0) return null
  const poolTier = mapRequestedPoolTier(difficulty, poolN)

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

  for (const attempt of attempts) {
    const track = await pickOneFromPool(
      db,
      poolTier,
      filters,
      attempt.sql,
      attempt.params,
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

export interface CatalogArtistHit {
  id?: string
  name: string
  imageUrl?: string | null
  country?: string | null
  popularity?: number | null
}

async function attachAlbumArtFromTracks(
  db: D1Database,
  hits: CatalogArtistHit[],
): Promise<CatalogArtistHit[]> {
  const missing = hits.filter((hit) => !hit.imageUrl)
  if (missing.length === 0) return hits

  const likes = missing.map(() => `lower(artist) LIKE ? ESCAPE '\\'`).join(' OR ')
  const bind = missing.map((hit) => likePattern(hit.name.toLowerCase()))
  try {
    const result = await db
      .prepare(
        `SELECT artist, album_art AS albumArt FROM tracks
         WHERE album_art IS NOT NULL AND album_art != '' AND (${likes})
         ORDER BY popularity IS NULL, popularity DESC
         LIMIT 80`,
      )
      .bind(...bind)
      .all<{ artist: string; albumArt: string | null }>()

    const byName = new Map<string, string>()
    for (const row of result.results ?? []) {
      if (!row.albumArt) continue
      for (const token of row.artist.split(',').map((part) => part.trim().toLowerCase())) {
        if (!token || byName.has(token)) continue
        byName.set(token, row.albumArt)
      }
    }
    for (const hit of hits) {
      if (hit.imageUrl) continue
      hit.imageUrl = byName.get(hit.name.toLowerCase()) ?? null
    }
  } catch {
    // Older local DBs may lack album_art; Mix falls back to initials.
  }
  return hits
}

export async function searchCatalogArtists(
  env: Env,
  query: string,
  limit = 5,
  collections: CatalogKind[] = [],
): Promise<CatalogArtistHit[]> {
  const db = requireDb(env)
  const normalized = query.trim().toLowerCase()
  const cap = Math.min(Math.max(limit, 1), 5)
  const scopedCollections = collections.filter(isCatalogKind)

  if (!normalized) {
    try {
      const popular = await db
        .prepare(
          `SELECT artist, album_art AS albumArt FROM tracks
           WHERE album_art IS NOT NULL AND album_art != ''
           ORDER BY popularity IS NULL, popularity DESC
           LIMIT 80`,
        )
        .all<{ artist: string; albumArt: string | null }>()
      const fromTracks: CatalogArtistHit[] = []
      const seenPopular = new Set<string>()
      for (const row of popular.results ?? []) {
        if (!row.albumArt) continue
        for (const token of row.artist.split(',').map((part) => part.trim()).filter(Boolean)) {
          const key = token.toLowerCase()
          if (seenPopular.has(key)) continue
          seenPopular.add(key)
          fromTracks.push({ name: token, imageUrl: row.albumArt })
          if (fromTracks.length >= cap) return fromTracks
        }
      }
      if (fromTracks.length > 0) return fromTracks
    } catch {
      // Fall through to the artists table.
    }
  }

  async function fromArtistsTable(): Promise<CatalogArtistHit[]> {
    const withImages = `SELECT id, name, country, popularity, image_url AS imageUrl FROM artists
             WHERE whitelisted = 1${normalized ? ` AND lower(name) LIKE ? ESCAPE '\\'` : ''}
             ORDER BY popularity IS NULL, popularity DESC, name
             LIMIT ?`
    const withoutImages = `SELECT id, name, country, popularity FROM artists
             WHERE whitelisted = 1${normalized ? ` AND lower(name) LIKE ? ESCAPE '\\'` : ''}
             ORDER BY popularity IS NULL, popularity DESC, name
             LIMIT ?`
    const bind = normalized ? [likePattern(normalized), cap] : [cap]
    try {
      const result = await db
        .prepare(withImages)
        .bind(...bind)
        .all<{
          id: string
          name: string
          country: string | null
          popularity: number | null
          imageUrl: string | null
        }>()
      return (result.results ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        country: row.country,
        popularity: row.popularity,
        imageUrl: row.imageUrl,
      }))
    } catch {
      const result = await db
        .prepare(withoutImages)
        .bind(...bind)
        .all<{ id: string; name: string; country: string | null; popularity: number | null }>()
      return (result.results ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        country: row.country,
        popularity: row.popularity,
      }))
    }
  }

  const seen = new Set<string>()
  const hits: CatalogArtistHit[] = []

  try {
    for (const row of await fromArtistsTable()) {
      const name = row.name?.trim()
      if (!name) continue
      const key = name.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      hits.push(row)
    }
  } catch {
    // Older local DBs may not have artists; fall through to track names.
  }

  if (hits.length > 0) {
    return attachAlbumArtFromTracks(db, hits.slice(0, cap))
  }

  if (hits.length === 0) {
    const trackPattern = normalized ? likePattern(normalized) : '%'
    const collectionClause =
      !normalized && scopedCollections.length > 0
        ? (() => {
            const placeholders = scopedCollections.map(() => '?').join(', ')
            return {
              sql: ` AND (
                catalog IN (${placeholders})
                OR EXISTS (
                  SELECT 1 FROM track_collections tc
                  WHERE tc.track_id = tracks.id AND tc.collection_id IN (${placeholders})
                )
              )`,
              params: [...scopedCollections, ...scopedCollections] as SqlValue[],
            }
          })()
        : { sql: '', params: [] as SqlValue[] }

    let trackResult: { results?: Array<{ artist: string }> }
    try {
      trackResult = await db
        .prepare(
          `SELECT artist FROM tracks
           WHERE lower(artist) LIKE ? ESCAPE '\\'${collectionClause.sql}
           ORDER BY popularity IS NULL, popularity DESC
           LIMIT 200`,
        )
        .bind(trackPattern, ...collectionClause.params)
        .all<{ artist: string }>()
    } catch {
      const catalogOnly =
        !normalized && scopedCollections.length > 0
          ? {
              sql: ` AND catalog IN (${scopedCollections.map(() => '?').join(', ')})`,
              params: [...scopedCollections] as SqlValue[],
            }
          : { sql: '', params: [] as SqlValue[] }
      trackResult = await db
        .prepare(
          `SELECT artist FROM tracks
           WHERE lower(artist) LIKE ? ESCAPE '\\'${catalogOnly.sql}
           ORDER BY popularity IS NULL, popularity DESC
           LIMIT 200`,
        )
        .bind(trackPattern, ...catalogOnly.params)
        .all<{ artist: string }>()
    }

    const counts = new Map<string, { name: string; count: number }>()
    for (const row of trackResult.results ?? []) {
      for (const token of row.artist.split(',').map((part) => part.trim()).filter(Boolean)) {
        if (normalized && !token.toLowerCase().includes(normalized)) continue
        const key = token.toLowerCase()
        const current = counts.get(key)
        if (current) current.count += 1
        else counts.set(key, { name: token, count: 1 })
      }
    }

    const ranked = [...counts.values()]
      .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name))
      .slice(0, cap)

    let portraits = new Map<string, CatalogArtistHit>()
    try {
      if (ranked.length > 0) {
        const placeholders = ranked.map(() => '?').join(', ')
        const result = await db
          .prepare(
            `SELECT id, name, country, popularity, image_url AS imageUrl FROM artists
             WHERE whitelisted = 1 AND lower(name) IN (${placeholders})`,
          )
          .bind(...ranked.map((item) => item.name.toLowerCase()))
          .all<{
            id: string
            name: string
            country: string | null
            popularity: number | null
            imageUrl: string | null
          }>()
        for (const row of result.results ?? []) {
          portraits.set(row.name.toLowerCase(), {
            id: row.id,
            name: row.name,
            country: row.country,
            popularity: row.popularity,
            imageUrl: row.imageUrl,
          })
        }
      }
    } catch {
      portraits = new Map()
    }

    for (const item of ranked) {
      const known = portraits.get(item.name.toLowerCase())
      hits.push(known ?? { name: item.name })
    }
  }

  return attachAlbumArtFromTracks(db, hits.slice(0, cap))
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

  // Variants of one song are duplicates to a player, so the batch settles on
  // its own best recording before it is compared with what D1 already holds.
  const candidates = dedupeTracks(tracks)

  const identities = await findExistingIdentities(env, candidates)
  const rivals = await findVariantRowsByIdentity(db, candidates)
  const existing = identities.ids
  const existingKeys = identities.songKeys
  let skippedExisting = tracks.length - candidates.length
  let skippedCap = 0
  const incoming: Track[] = []
  const replacedIds: string[] = []
  let remainingCap = Math.max(0, MAX_CATALOG_TRACKS - totalBefore)

  for (const track of candidates) {
    const key = songIdentityKey(track)
    if (existing.has(track.id)) {
      skippedExisting += 1
      continue
    }

    const rival = rivals.get(key)
    if (rival) {
      // Keep the better recording rather than whichever arrived first.
      if (compareVariants(track, rival) >= 0) {
        skippedExisting += 1
        continue
      }
      // Swapping one recording for another does not grow the catalog, so a
      // replacement is not charged against the track cap.
      replacedIds.push(rival.id)
      rivals.delete(key)
      existingKeys.delete(key)
    } else {
      if (existingKeys.has(key)) {
        skippedExisting += 1
        continue
      }
      if (remainingCap <= 0) {
        skippedCap += 1
        continue
      }
      remainingCap -= 1
    }

    existing.add(track.id)
    existingKeys.add(key)
    incoming.push(track)
  }

  if (incoming.length === 0) {
    return { added: 0, totalTracks: totalBefore, skippedExisting, skippedCap, replaced: 0 }
  }

  for (let index = 0; index < replacedIds.length; index += MAX_IN_PARAMS) {
    const batch = replacedIds.slice(index, index + MAX_IN_PARAMS)
    await db
      .prepare(`DELETE FROM tracks WHERE id IN (${batch.map(() => '?').join(', ')})`)
      .bind(...batch)
      .run()
  }

  const now = new Date().toISOString()
  const statements = incoming.map((track) => db.prepare(INSERT_SQL).bind(...trackBindValues(track, now)))
  for (let index = 0; index < statements.length; index += 100) {
    await db.batch(statements.slice(index, index + 100))
  }

  return {
    added: incoming.length,
    totalTracks: totalBefore + incoming.length - replacedIds.length,
    skippedExisting,
    skippedCap,
    replaced: replacedIds.length,
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

export interface BulkRemoveResult {
  removed: number
  notFound: number
  requested: number
  removedIds: string[]
  totalTracks: number
}

export async function removeTracksFromCatalog(
  env: Env,
  trackIds: string[],
): Promise<BulkRemoveResult> {
  const db = requireDb(env)
  const ids = [...new Set(trackIds.map((id) => id.trim()).filter(Boolean))]
  if (ids.length === 0) {
    return { removed: 0, notFound: 0, requested: 0, removedIds: [], totalTracks: await countTracks(env) }
  }

  const present = await findExistingTrackIds(env, ids)
  const removable = ids.filter((id) => present.has(id))

  for (let index = 0; index < removable.length; index += MAX_IN_PARAMS) {
    const batch = removable.slice(index, index + MAX_IN_PARAMS)
    await db
      .prepare(`DELETE FROM tracks WHERE id IN (${batch.map(() => '?').join(', ')})`)
      .bind(...batch)
      .run()
  }

  return {
    removed: removable.length,
    notFound: ids.length - removable.length,
    requested: ids.length,
    removedIds: removable,
    totalTracks: await countTracks(env),
  }
}

export interface TrackScoringRow {
  id: string
  popularity: number | null
  artistPopularity: number | null
  releaseYear: number | null
  playCount: number | null
}

/** Current scoring inputs, so a partial sync can recompute difficulty correctly. */
export async function listTrackScoringRows(
  env: Env,
  ids: string[],
): Promise<Map<string, TrackScoringRow>> {
  const rows = new Map<string, TrackScoringRow>()
  if (ids.length === 0) return rows
  const db = requireDb(env)

  for (let index = 0; index < ids.length; index += MAX_IN_PARAMS) {
    const batch = ids.slice(index, index + MAX_IN_PARAMS)
    const result = await db
      .prepare(
        `SELECT id, popularity, artist_popularity, release_year, play_count
         FROM tracks WHERE id IN (${batch.map(() => '?').join(', ')})`,
      )
      .bind(...batch)
      .all<{
        id: string
        popularity: number | null
        artist_popularity: number | null
        release_year: number | null
        play_count: number | null
      }>()
    for (const row of result.results ?? []) {
      rows.set(row.id, {
        id: row.id,
        popularity: row.popularity,
        artistPopularity: row.artist_popularity,
        releaseYear: row.release_year,
        playCount: row.play_count,
      })
    }
  }

  return rows
}

export interface TrackMetricsPatch {
  id: string
  title?: string
  artist?: string
  albumArt?: string
  popularity?: number
  playCount?: number
  artistPopularity?: number
  releaseYear?: number
  releaseDate?: string
  durationMs?: number
  spotifyGenres?: string[]
  difficulty?: Difficulty
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
           popularity = COALESCE(?, popularity),
           play_count = COALESCE(?, play_count),
           play_count_updated_at = CASE WHEN ? IS NOT NULL THEN ? ELSE play_count_updated_at END,
           artist_popularity = COALESCE(?, artist_popularity),
           release_year = COALESCE(?, release_year),
           release_date = COALESCE(?, release_date),
           duration_ms = COALESCE(?, duration_ms),
           spotify_genres = COALESCE(?, spotify_genres),
           difficulty = CASE
             WHEN ? IS NULL THEN difficulty
             WHEN chart_boost = 1 THEN CASE
               WHEN ? IN ('easy', 'medium') THEN ?
               ELSE COALESCE(force_tier, 'medium')
             END
             ELSE ?
           END,
           updated_at = ?,
           spotify_synced_at = CASE WHEN COALESCE(?, ?, ?) IS NOT NULL THEN ? ELSE spotify_synced_at END
         WHERE id = ?`,
      )
      .bind(
        patch.title ?? null,
        patch.artist ?? null,
        patch.albumArt ?? null,
        patch.popularity ?? null,
        patch.playCount ?? null,
        patch.playCount ?? null,
        now,
        patch.artistPopularity ?? null,
        patch.releaseYear ?? null,
        patch.releaseDate ?? null,
        patch.durationMs ?? null,
        patch.spotifyGenres ? JSON.stringify(patch.spotifyGenres) : null,
        patch.difficulty ?? null,
        patch.difficulty ?? null,
        patch.difficulty ?? null,
        patch.difficulty ?? null,
        now,
        patch.popularity ?? null,
        patch.playCount ?? null,
        patch.releaseDate ?? null,
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

function adminCollectionSql(collection?: CatalogKind): { sql: string; params: SqlValue[] } {
  if (!collection) return { sql: '', params: [] }
  return {
    sql: `(
      catalog = ?
      OR EXISTS (
        SELECT 1 FROM track_collections tc
        WHERE tc.track_id = tracks.id AND tc.collection_id = ?
      )
    )`,
    params: [collection, collection],
  }
}

function adminCollectionWhere(collection?: CatalogKind): { sql: string; params: SqlValue[] } {
  const inner = adminCollectionSql(collection)
  if (!inner.sql) return inner
  return { sql: ` AND ${inner.sql}`, params: inner.params }
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
  const collection = adminCollectionSql(filters.collection)
  if (collection.sql) {
    clauses.push(collection.sql)
    params.push(...collection.params)
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
        playCount: track.playCount,
        playCountUpdatedAt: row.play_count_updated_at ?? undefined,
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

export async function listTracksMissingPreview(
  env: Env,
): Promise<Array<{ id: string; title: string; artist: string; hookPreviewUrl: string | null }>> {
  const db = requireDb(env)
  const result = await db
    .prepare(
      `SELECT id, title, artist, hook_preview_url
       FROM tracks
       WHERE preview_url IS NULL OR preview_url = ''`,
    )
    .all<{ id: string; title: string; artist: string; hook_preview_url: string | null }>()
  return (result.results ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    artist: row.artist,
    hookPreviewUrl: row.hook_preview_url,
  }))
}

export async function applyPreviewPatches(
  env: Env,
  patches: Array<{
    id: string
    previewUrl: string
    hookPreviewUrl?: string
    hookStartSeconds?: number
  }>,
): Promise<number> {
  const usable = patches.filter((patch) => patch.id && patch.previewUrl)
  if (usable.length === 0) return 0

  const db = requireDb(env)
  const now = new Date().toISOString()
  const statements = usable.map((patch) =>
    db
      .prepare(
        `UPDATE tracks SET
           preview_url = ?,
           hook_preview_url = CASE
             WHEN (hook_preview_url IS NULL OR hook_preview_url = '') AND ? IS NOT NULL THEN ?
             ELSE hook_preview_url
           END,
           hook_start_seconds = COALESCE(hook_start_seconds, ?),
           updated_at = ?
         WHERE id = ? AND (preview_url IS NULL OR preview_url = '')`,
      )
      .bind(
        patch.previewUrl,
        patch.hookPreviewUrl ?? null,
        patch.hookPreviewUrl ?? null,
        patch.hookStartSeconds ?? null,
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
