#!/usr/bin/env node
/**
 * Seed R2 with the local catalog and checkpoint (if not already present).
 *
 *   npm run upload:catalog
 *   npm run upload:catalog -- --force
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { BUCKET } from './audio-r2-lib.mjs'

const ROOT = process.cwd()
const CATALOG_KEY = 'catalog/catalog.json'
const CHECKPOINT_KEY = 'catalog/build-checkpoint.json'
const CATALOG_PATH = resolve(ROOT, 'data/catalog.json')
const CHECKPOINT_PATH = resolve(ROOT, 'data/catalog-build.checkpoint.json')

function runWrangler(args) {
  const command = ['wrangler', 'r2', ...args, '--remote']
  console.log(`$ npx ${command.join(' ')}`)
  execFileSync('npx', command, {
    stdio: 'inherit',
    cwd: ROOT,
    shell: process.platform === 'win32',
  })
}

function objectExists(key) {
  try {
    execFileSync(
      'npx',
      ['wrangler', 'r2', 'object', 'get', `${BUCKET}/${key}`, '--file', '-', '--remote'],
      { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' },
    )
    return true
  } catch {
    return false
  }
}

function uploadFile(key, localPath) {
  runWrangler([
    'object',
    'put',
    `${BUCKET}/${key}`,
    '--file',
    localPath,
    '--content-type',
    'application/json',
  ])
}

function main() {
  const force = process.argv.includes('--force')

  if (!existsSync(CATALOG_PATH)) {
    console.error(`Missing ${CATALOG_PATH}. Run npm run build:catalog first.`)
    process.exit(1)
  }

  const catalogExists = objectExists(CATALOG_KEY)
  if (catalogExists && !force) {
    console.log(`R2 already has ${CATALOG_KEY}. Use --force to overwrite.`)
  } else {
    uploadFile(CATALOG_KEY, CATALOG_PATH)
    console.log(`Uploaded catalog to r2://${BUCKET}/${CATALOG_KEY}`)
  }

  if (existsSync(CHECKPOINT_PATH)) {
    const checkpointExists = objectExists(CHECKPOINT_KEY)
    if (checkpointExists && !force) {
      console.log(`R2 already has ${CHECKPOINT_KEY}. Use --force to overwrite.`)
    } else {
      uploadFile(CHECKPOINT_KEY, CHECKPOINT_PATH)
      console.log(`Uploaded checkpoint to r2://${BUCKET}/${CHECKPOINT_KEY}`)
    }
  } else {
    const emptyCheckpoint = resolve(ROOT, 'data/.upload-catalog-checkpoint.json')
    writeFileSync(emptyCheckpoint, `${JSON.stringify({ completedArtists: [] }, null, 2)}\n`, 'utf8')
    try {
      uploadFile(CHECKPOINT_KEY, emptyCheckpoint)
      console.log(`Uploaded empty checkpoint to r2://${BUCKET}/${CHECKPOINT_KEY}`)
    } finally {
      unlinkSync(emptyCheckpoint)
    }
  }

  const catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf8'))
  console.log(`Local catalog: ${catalog.tracks?.length ?? 0} tracks`)
}

main()
