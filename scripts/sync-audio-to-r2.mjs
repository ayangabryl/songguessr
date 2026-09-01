#!/usr/bin/env node
/**
 * Sync licensed audio from data/audio/ to R2 (incremental).
 *
 * - Skips unchanged files (SHA-256 in data/audio/.upload-state.json)
 * - Only uploads tracks with local files present
 * - Updates catalog.json with /api/audio/ URLs
 *
 * Workflow:
 *   1. npm run audio:manifest   # optional: refresh manifest.json
 *   2. Drop MP3s in data/audio/  # {trackId}.mp3, -intro, -hook
 *   3. npm run sync:audio
 *   4. npm run deploy
 *
 * Flags:
 *   --dry-run       Preview only
 *   --force         Re-upload even if unchanged
 *   --missing-only  Only tracks without R2 URLs in catalog yet
 *   --track <id>    Single track
 *   --deploy        Run npm run deploy after sync
 *
 * You must own or license every file. No streaming downloads.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  AUDIO_DIR,
  BUCKET,
  ROOT,
  contentTypeFor,
  ensureBucket,
  fileFingerprint,
  loadCatalog,
  loadSidecarMetadata,
  loadUploadState,
  listAudioFiles,
  parseTrackFileName,
  publicUrl,
  runWrangler,
  saveCatalog,
  saveUploadState,
  trackHasHostedAudio,
} from './audio-r2-lib.mjs'

function parseArgs(argv) {
  return {
    dryRun: argv.includes('--dry-run'),
    force: argv.includes('--force'),
    missingOnly: argv.includes('--missing-only'),
    deploy: argv.includes('--deploy'),
    trackId: (() => {
      const index = argv.indexOf('--track')
      return index >= 0 ? argv[index + 1] : null
    })(),
  }
}

function shouldUpload(objectKey, localPath, state, force) {
  if (force) return true
  const fingerprint = fileFingerprint(localPath)
  const previous = state.objects[objectKey]
  if (!previous) return true
  return previous.sha256 !== fingerprint.sha256
}

function uploadFile(fileName, localPath, dryRun) {
  runWrangler(
    [
      'object',
      'put',
      `${BUCKET}/${fileName}`,
      '--file',
      localPath,
      '--content-type',
      contentTypeFor(fileName),
    ],
    dryRun,
  )
}

function main() {
  const options = parseArgs(process.argv.slice(2))

  if (!existsSync(AUDIO_DIR)) {
    mkdirSync(AUDIO_DIR, { recursive: true })
    console.log(`Created ${AUDIO_DIR}. Add licensed MP3s and re-run.`)
    return
  }

  const catalog = loadCatalog()
  const tracksById = new Map(catalog.tracks.map((track) => [track.id, track]))
  const state = loadUploadState()
  const files = listAudioFiles().filter((fileName) => {
    const parsed = parseTrackFileName(fileName)
    if (options.trackId && parsed.trackId !== options.trackId) return false
    const track = tracksById.get(parsed.trackId)
    if (!track) return false
    if (options.missingOnly && trackHasHostedAudio(track)) return false
    return true
  })

  if (files.length === 0) {
    console.log('Nothing to sync. Add files to data/audio/ or run npm run audio:status')
    return
  }

  ensureBucket(options.dryRun)

  const touchedTrackIds = new Set()
  let uploadCount = 0
  let skipCount = 0

  for (const fileName of files) {
    const parsed = parseTrackFileName(fileName)
    const track = tracksById.get(parsed.trackId)
    if (!track) {
      console.warn(`Skipping ${fileName}: unknown track id ${parsed.trackId}`)
      continue
    }

    const localPath = join(AUDIO_DIR, fileName)
    if (!shouldUpload(parsed.objectKey, localPath, state, options.force)) {
      skipCount += 1
      track[parsed.kind] = publicUrl(parsed.objectKey)
      touchedTrackIds.add(parsed.trackId)
      continue
    }

    uploadFile(parsed.objectKey, localPath, options.dryRun)
    if (!options.dryRun) {
      state.objects[parsed.objectKey] = fileFingerprint(localPath)
    }

    track[parsed.kind] = publicUrl(parsed.objectKey)
    touchedTrackIds.add(parsed.trackId)
    uploadCount += 1
  }

  for (const id of touchedTrackIds) {
    const track = tracksById.get(id)
    if (track) Object.assign(track, loadSidecarMetadata(id))
  }

  if (options.dryRun) {
    console.log(
      `Dry run: would upload ${uploadCount} file(s), skip ${skipCount} unchanged, touch ${touchedTrackIds.size} track(s).`,
    )
    return
  }

  saveUploadState(state)
  saveCatalog(catalog)
  console.log(
    `Synced ${uploadCount} file(s), skipped ${skipCount} unchanged, updated ${touchedTrackIds.size} track(s) in catalog.`,
  )

  if (options.deploy) {
    console.log('Deploying...')
    execFileSync('npm', ['run', 'deploy'], { stdio: 'inherit', cwd: ROOT })
  } else {
    console.log('Run `npm run deploy` to publish catalog + audio routes.')
  }
}

main()
