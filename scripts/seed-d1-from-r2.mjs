#!/usr/bin/env node
/**
 * One-time import of catalog.json (R2, or local fallback) into D1.
 *
 *   npm run seed:d1
 *   npm run seed:d1 -- --local-only
 *
 * Official Spotify play-counts / "listens" are not available on the public API.
 * This seed copies existing catalog rows; run Spotify metrics sync afterwards.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const ROOT = process.cwd()
const DB_NAME = 'songguessr'
const BUCKET = 'songguessr'
const R2_KEY = 'catalog/catalog.json'
const LOCAL_CATALOG = resolve(ROOT, 'data/catalog.json')
const BATCH_SIZE = 20

function normalizeText(value) {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9&\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function canonicalSongTitle(title) {
  let value = String(title).trim()
  value = value.replace(/\s*\([^)]*\)/g, ' ')
  value = value.replace(/\s*\[[^\]]*\]/g, ' ')
  value = value.replace(/\s*-\s*(remix|reimagined|live|acoustic|karaoke|instrumental|edit|mix|version).*$/i, ' ')
  return normalizeText(value)
}

function songIdentityKey(track) {
  const artist = normalizeText(String(track.artist ?? '').split(',')[0] ?? '')
  return `${artist}|${canonicalSongTitle(track.title ?? '')}`
}

function sqlString(value) {
  if (value == null || value === '') return 'NULL'
  return `'${String(value).replaceAll("'", "''")}'`
}

function sqlNumber(value) {
  if (value == null || value === '') return 'NULL'
  const number = Number(value)
  return Number.isFinite(number) ? String(number) : 'NULL'
}

function runWrangler(args) {
  console.log(`$ npx wrangler ${args.join(' ')}`)
  execFileSync('npx', ['wrangler', ...args], {
    stdio: 'inherit',
    cwd: ROOT,
    shell: process.platform === 'win32',
  })
}

function loadCatalogFromR2(tempDir) {
  const dest = join(tempDir, 'catalog.json')
  try {
    execFileSync(
      'npx',
      ['wrangler', 'r2', 'object', 'get', `${BUCKET}/${R2_KEY}`, '--file', dest, '--remote'],
      { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' },
    )
    if (!existsSync(dest)) return null
    return JSON.parse(readFileSync(dest, 'utf8'))
  } catch (error) {
    console.warn(`Could not download r2://${BUCKET}/${R2_KEY}: ${error instanceof Error ? error.message : error}`)
    return null
  }
}

function loadLocalCatalog() {
  if (!existsSync(LOCAL_CATALOG)) return null
  return JSON.parse(readFileSync(LOCAL_CATALOG, 'utf8'))
}

function trackRowSql(track, now) {
  return `(${[
    sqlString(track.id),
    sqlString(track.title ?? 'Unknown'),
    sqlString(track.artist ?? 'Unknown'),
    sqlString(track.previewUrl),
    sqlString(track.hookPreviewUrl),
    sqlNumber(track.hookStartSeconds),
    sqlString(track.albumArt),
    sqlString(track.difficulty ?? 'medium'),
    sqlNumber(track.popularity),
    sqlNumber(track.artistPopularity),
    sqlNumber(track.releaseYear),
    sqlNumber(track.durationMs),
    sqlString(JSON.stringify(track.genreGroups ?? [])),
    sqlString(songIdentityKey(track)),
    sqlString(now),
    'NULL',
  ].join(', ')})`
}

function buildSeedSql(tracks, now) {
  const statements = [
    '-- Seeded from R2/local catalog.json. Difficulty is recomputed on Spotify sync.',
  ]

  for (let index = 0; index < tracks.length; index += BATCH_SIZE) {
    const batch = tracks.slice(index, index + BATCH_SIZE)
    statements.push(
      `INSERT OR IGNORE INTO tracks (
  id, title, artist, preview_url, hook_preview_url, hook_start_seconds,
  album_art, difficulty, popularity, artist_popularity, release_year, duration_ms,
  genre_groups, song_key, updated_at, spotify_synced_at
) VALUES
${batch.map((track) => `  ${trackRowSql(track, now)}`).join(',\n')};`,
    )
  }

  return `${statements.join('\n\n')}\n`
}

function main() {
  const localOnly = process.argv.includes('--local-only')
  const tempDir = mkdtempSync(join(tmpdir(), 'songguessr-d1-seed-'))

  try {
    const catalog = localOnly ? loadLocalCatalog() : loadCatalogFromR2(tempDir) ?? loadLocalCatalog()
    const tracks = Array.isArray(catalog?.tracks) ? catalog.tracks.filter((track) => track?.id) : []
    if (tracks.length === 0) {
      console.error('No tracks found. Need R2 catalog/catalog.json or data/catalog.json.')
      process.exit(1)
    }

    const source = localOnly || !existsSync(join(tempDir, 'catalog.json')) ? 'local data/catalog.json' : `r2://${BUCKET}/${R2_KEY}`
    console.log(`Seeding ${tracks.length} tracks from ${source}`)

    const sqlPath = join(tempDir, 'seed-tracks.sql')
    writeFileSync(sqlPath, buildSeedSql(tracks, new Date().toISOString()), 'utf8')
    runWrangler(['d1', 'execute', DB_NAME, '--remote', '--file', sqlPath, '--yes'])
    runWrangler([
      'd1',
      'execute',
      DB_NAME,
      '--remote',
      '--command=SELECT COUNT(*) AS tracks FROM tracks',
      '--json',
    ])
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
}

main()
