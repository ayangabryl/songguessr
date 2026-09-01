#!/usr/bin/env node
/**
 * Upload user-provided licensed audio from data/audio/ to Cloudflare R2
 * and update data/catalog.json with /api/audio/... URLs.
 *
 * Prefer `npm run sync:audio` for incremental uploads.
 *
 *   npm run upload:audio
 *   npm run upload:audio -- --dry-run
 *   npm run upload:audio -- --track <id>
 */

import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  AUDIO_DIR,
  BUCKET,
  contentTypeFor,
  ensureBucket,
  loadCatalog,
  loadSidecarMetadata,
  listAudioFiles,
  parseTrackFileName,
  publicUrl,
  runWrangler,
  saveCatalog,
} from './audio-r2-lib.mjs'

function parseArgs(argv) {
  const dryRun = argv.includes('--dry-run')
  const trackIndex = argv.indexOf('--track')
  const trackId = trackIndex >= 0 ? argv[trackIndex + 1] : null
  return { dryRun, trackId }
}

function main() {
  const { dryRun, trackId: onlyTrackId } = parseArgs(process.argv.slice(2))

  if (!existsSync(AUDIO_DIR)) {
    mkdirSync(AUDIO_DIR, { recursive: true })
    console.error(`Created ${AUDIO_DIR}. Add licensed files and re-run.`)
    process.exit(1)
  }

  const catalog = loadCatalog()
  const tracksById = new Map(catalog.tracks.map((track) => [track.id, track]))
  const files = listAudioFiles().filter((fileName) => {
    if (!onlyTrackId) return true
    return parseTrackFileName(fileName).trackId === onlyTrackId
  })

  if (files.length === 0) {
    console.log('No audio files found in data/audio/.')
    return
  }

  ensureBucket(dryRun)

  const touchedTrackIds = new Set()
  let uploadCount = 0

  for (const fileName of files) {
    const parsed = parseTrackFileName(fileName)
    const track = tracksById.get(parsed.trackId)
    if (!track) {
      console.warn(`Skipping ${fileName}: no catalog track with id ${parsed.trackId}`)
      continue
    }

    const localPath = join(AUDIO_DIR, fileName)
    runWrangler(
      [
        'object',
        'put',
        `${BUCKET}/${parsed.objectKey}`,
        '--file',
        localPath,
        '--content-type',
        contentTypeFor(fileName),
      ],
      dryRun,
    )

    track[parsed.kind] = publicUrl(parsed.objectKey)
    touchedTrackIds.add(parsed.trackId)
    uploadCount += 1
  }

  for (const id of touchedTrackIds) {
    const track = tracksById.get(id)
    if (track) Object.assign(track, loadSidecarMetadata(id))
  }

  if (dryRun) {
    console.log(`Dry run complete. Would upload ${uploadCount} file(s) for ${touchedTrackIds.size} track(s).`)
    return
  }

  saveCatalog(catalog)
  console.log(`Uploaded ${uploadCount} file(s) for ${touchedTrackIds.size} track(s).`)
  console.log('Run `npm run sync:audio` next time for incremental sync, or `npm run deploy` to publish.')
}

main()
