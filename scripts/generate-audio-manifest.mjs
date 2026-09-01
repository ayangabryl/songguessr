#!/usr/bin/env node
/**
 * Generate data/audio/manifest.json from catalog.json.
 * Use this to see which tracks need files and to batch-plan uploads.
 *
 *   npm run audio:manifest
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  AUDIO_DIR,
  AUDIO_EXTENSIONS,
  MANIFEST_PATH,
  loadCatalog,
  listAudioFiles,
  trackHasHostedAudio,
} from './audio-r2-lib.mjs'

function localFilesForTrack(trackId, audioFiles) {
  const full = []
  const intro = []
  const hook = []
  for (const fileName of audioFiles) {
    const ext = fileName.slice(fileName.lastIndexOf('.'))
    const stem = fileName.slice(0, -ext.length)
    if (stem === trackId) full.push(fileName)
    if (stem === `${trackId}-intro`) intro.push(fileName)
    if (stem === `${trackId}-hook`) hook.push(fileName)
  }
  return { full: full[0] ?? null, intro: intro[0] ?? null, hook: hook[0] ?? null }
}

function main() {
  const catalog = loadCatalog()
  const audioFiles = listAudioFiles().filter((name) =>
    AUDIO_EXTENSIONS.has(name.slice(name.lastIndexOf('.')).toLowerCase()),
  )

  if (!existsSync(AUDIO_DIR)) {
    mkdirSync(AUDIO_DIR, { recursive: true })
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    instructions:
      'Drop licensed MP3s in data/audio/ using the file names below, then run npm run sync:audio. Set enabled:false to skip a row.',
    tracks: catalog.tracks.map((track) => {
      const local = localFilesForTrack(track.id, audioFiles)
      return {
        id: track.id,
        title: track.title,
        artist: track.artist,
        enabled: true,
        hostedInCatalog: trackHasHostedAudio(track),
        files: {
          full: local.full ?? `${track.id}.mp3`,
          intro: local.intro ?? `${track.id}-intro.mp3`,
          hook: local.hook ?? `${track.id}-hook.mp3`,
        },
        startAtMs: track.startAtMs ?? 0,
        hookStartMs: track.hookStartMs ?? 12000,
        localFilesPresent: {
          full: Boolean(local.full),
          intro: Boolean(local.intro),
          hook: Boolean(local.hook),
        },
      }
    }),
  }

  writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')

  const withLocal = manifest.tracks.filter(
    (row) => row.localFilesPresent.full || row.localFilesPresent.intro || row.localFilesPresent.hook,
  ).length
  const hosted = manifest.tracks.filter((row) => row.hostedInCatalog).length

  console.log(`Wrote ${MANIFEST_PATH}`)
  console.log(`Catalog: ${manifest.tracks.length} tracks, ${hosted} already on R2, ${withLocal} have local files ready to sync`)
}

main()
