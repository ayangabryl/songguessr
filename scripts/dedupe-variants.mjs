#!/usr/bin/env node
/**
 * Collapse version-variant duplicates already sitting in D1.
 *
 *   node scripts/dedupe-variants.mjs            # dry run, prints every group
 *   node scripts/dedupe-variants.mjs --apply    # delete losers, rewrite song_key
 *   node scripts/dedupe-variants.mjs --apply --reset   # discard the checkpoint
 *
 * Two separate jobs, both driven by the canonical identity key:
 *
 *   1. Duplicate groups. "MAPA" and "MAPA - From THE FIRST TAKE" by SB19 now
 *      share a key, so one of them has to go. The keeper is chosen by
 *      compareVariants: play count first, then popularity, then the plainer
 *      title.
 *   2. Stale song_key values. The column was written by the previous, narrower
 *      canonicalizer. `/api/random` recomputes the key in the Worker and
 *      excludes recently played songs by matching it against this column, so
 *      the two must agree or repeat-suppression silently stops working.
 *
 * Work is checkpointed to data/variant-dedupe.checkpoint.json and re-running
 * with --apply resumes wherever the last run stopped.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, mkdtempSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

import { compareVariants, songIdentityKey } from './track-dedupe.mjs'

const ROOT = process.cwd()
const DB_NAME = 'songguessr'
const CHECKPOINT = resolve(ROOT, 'data/variant-dedupe.checkpoint.json')
const PAGE_SIZE = 500
const WRITE_BATCH = 50

const apply = process.argv.includes('--apply')
const reset = process.argv.includes('--reset')

// Spawn wrangler's JS entry with the current node binary. Going through `npx`
// needs `shell: true` on Windows, which re-splits the SQL on every space, and
// Node 24 refuses to spawn npx.cmd without a shell.
const WRANGLER = resolve(
  dirname(createRequire(import.meta.url).resolve('wrangler/package.json')),
  'bin/wrangler.js',
)

function d1(command, { file = false } = {}) {
  const args = [WRANGLER, 'd1', 'execute', DB_NAME, '--remote', '--json']
  args.push(file ? '--file' : '--command', command)
  args.push('--yes')
  const stdout = execFileSync(process.execPath, args, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
  const jsonStart = stdout.indexOf('[')
  if (jsonStart < 0) throw new Error(`Unexpected wrangler output:\n${stdout}`)
  return JSON.parse(stdout.slice(jsonStart))
}

function sqlString(value) {
  if (value == null) return 'NULL'
  return `'${String(value).replaceAll("'", "''")}'`
}

function loadAllRows() {
  const rows = []
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const result = d1(
      `SELECT id, title, artist, song_key, play_count, popularity, album_art, preview_url, difficulty, country, catalog
       FROM tracks ORDER BY id LIMIT ${PAGE_SIZE} OFFSET ${offset}`,
    )
    const page = result[0]?.results ?? []
    rows.push(...page)
    process.stdout.write(`  loaded ${rows.length} rows\r`)
    if (page.length < PAGE_SIZE) break
  }
  process.stdout.write('\n')
  return rows
}

function toCandidate(row) {
  return {
    id: row.id,
    title: row.title,
    playCount: row.play_count,
    popularity: row.popularity,
    albumArt: row.album_art,
    previewUrl: row.preview_url,
  }
}

function formatPlays(value) {
  if (value == null) return 'no plays'
  return `${Number(value).toLocaleString()} plays`
}

function buildPlan(rows) {
  const groups = new Map()
  for (const row of rows) {
    const key = songIdentityKey({ title: row.title, artist: row.artist })
    const list = groups.get(key) ?? []
    list.push(row)
    groups.set(key, list)
  }

  const duplicateGroups = []
  const removals = []
  const keyUpdates = []

  for (const [key, list] of groups) {
    const ranked = [...list].sort((left, right) => compareVariants(toCandidate(left), toCandidate(right)))
    const keeper = ranked[0]
    const losers = ranked.slice(1)

    if (losers.length > 0) {
      duplicateGroups.push({
        key,
        artist: keeper.artist,
        keeper: { id: keeper.id, title: keeper.title, playCount: keeper.play_count },
        losers: losers.map((row) => ({ id: row.id, title: row.title, playCount: row.play_count })),
      })
      for (const row of losers) removals.push({ id: row.id, title: row.title, artist: row.artist, key })
    }

    if (keeper.song_key !== key) {
      keyUpdates.push({ id: keeper.id, songKey: key, previous: keeper.song_key })
    }
  }

  return { duplicateGroups, removals, keyUpdates }
}

function readCheckpoint() {
  if (reset || !existsSync(CHECKPOINT)) return null
  try {
    return JSON.parse(readFileSync(CHECKPOINT, 'utf8'))
  } catch {
    return null
  }
}

function writeCheckpoint(state) {
  mkdirSync(dirname(CHECKPOINT), { recursive: true })
  writeFileSync(CHECKPOINT, `${JSON.stringify(state, null, 2)}\n`, 'utf8')
}

function runSqlFile(statements) {
  const dir = mkdtempSync(join(tmpdir(), 'songguessr-dedupe-'))
  const path = join(dir, 'batch.sql')
  try {
    writeFileSync(path, `${statements.join('\n')}\n`, 'utf8')
    return d1(path, { file: true })
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

function applyRemovals(state) {
  const { removals } = state.plan
  while (state.removedThrough < removals.length) {
    const batch = removals.slice(state.removedThrough, state.removedThrough + WRITE_BATCH)
    const ids = batch.map((item) => sqlString(item.id)).join(', ')
    runSqlFile([`DELETE FROM tracks WHERE id IN (${ids});`])
    state.removedThrough += batch.length
    writeCheckpoint(state)
    console.log(`  deleted ${state.removedThrough}/${removals.length}`)
  }
}

function applyKeyUpdates(state) {
  const { keyUpdates } = state.plan
  while (state.keyedThrough < keyUpdates.length) {
    const batch = keyUpdates.slice(state.keyedThrough, state.keyedThrough + WRITE_BATCH)
    runSqlFile(
      batch.map(
        (item) => `UPDATE tracks SET song_key = ${sqlString(item.songKey)} WHERE id = ${sqlString(item.id)};`,
      ),
    )
    state.keyedThrough += batch.length
    writeCheckpoint(state)
    console.log(`  rekeyed ${state.keyedThrough}/${keyUpdates.length}`)
  }
}

function reportPlan(plan) {
  console.log('')
  console.log(`Variant-duplicate groups: ${plan.duplicateGroups.length}`)
  console.log(`Rows to remove:           ${plan.removals.length}`)
  console.log(`song_key rows to rewrite: ${plan.keyUpdates.length}`)
  console.log('')

  if (plan.duplicateGroups.length === 0) {
    console.log('No variant duplicates found.')
  }

  for (const group of plan.duplicateGroups) {
    console.log(`${group.artist} - ${group.keeper.title}`)
    console.log(`  KEEP    ${group.keeper.id}  ${group.keeper.title}  (${formatPlays(group.keeper.playCount)})`)
    for (const loser of group.losers) {
      console.log(`  REMOVE  ${loser.id}  ${loser.title}  (${formatPlays(loser.playCount)})`)
    }
  }

  if (plan.keyUpdates.length > 0) {
    console.log('')
    console.log('song_key rewrites (stored key -> canonical key):')
    for (const update of plan.keyUpdates) {
      console.log(`  ${JSON.stringify(update.previous)} -> ${JSON.stringify(update.songKey)}`)
    }
  }
}

function main() {
  const resumed = apply ? readCheckpoint() : null

  let state
  if (resumed?.plan) {
    console.log(`Resuming checkpoint from ${resumed.createdAt}`)
    state = resumed
  } else {
    console.log(`Reading tracks from D1 (${DB_NAME}, remote)...`)
    const rows = loadAllRows()
    console.log(`Scanned ${rows.length} tracks`)
    state = {
      createdAt: new Date().toISOString(),
      totalScanned: rows.length,
      plan: buildPlan(rows),
      removedThrough: 0,
      keyedThrough: 0,
    }
  }

  reportPlan(state.plan)

  if (!apply) {
    console.log('')
    console.log('Dry run. Re-run with --apply to delete the rows listed above.')
    return
  }

  writeCheckpoint(state)
  console.log('')
  console.log('Applying...')
  applyRemovals(state)
  applyKeyUpdates(state)

  const after = d1('SELECT COUNT(*) AS tracks FROM tracks')
  const remaining = after[0]?.results?.[0]?.tracks ?? '?'
  console.log('')
  console.log(`Done. Removed ${state.plan.removals.length}, rekeyed ${state.plan.keyUpdates.length}.`)
  console.log(`Catalog now holds ${remaining} tracks.`)
  rmSync(CHECKPOINT, { force: true })
}

main()
