#!/usr/bin/env node
/**
 * Print R2 audio coverage for the catalog.
 *
 *   npm run audio:status
 */

import { existsSync } from 'node:fs'
import {
  AUDIO_DIR,
  loadCatalog,
  listAudioFiles,
  trackHasHostedAudio,
} from './audio-r2-lib.mjs'

function main() {
  const catalog = loadCatalog()
  const audioFiles = listAudioFiles()
  const hosted = catalog.tracks.filter(trackHasHostedAudio)
  const missing = catalog.tracks.filter((track) => !trackHasHostedAudio(track))

  const localTrackIds = new Set()
  for (const fileName of audioFiles) {
    const base = fileName.replace(/-(intro|hook)\.[^.]+$/i, '').replace(/\.[^.]+$/, '')
    localTrackIds.add(base)
  }

  const readyNotHosted = catalog.tracks.filter(
    (track) => !trackHasHostedAudio(track) && localTrackIds.has(track.id),
  )

  console.log('OPM Songless — R2 audio status')
  console.log('--------------------------------')
  console.log(`Catalog tracks:     ${catalog.tracks.length}`)
  console.log(`On R2 (in catalog): ${hosted.length}`)
  console.log(`Preview only:       ${missing.length}`)
  console.log(`Local files ready:  ${readyNotHosted.length} (run npm run sync:audio)`)
  console.log(`Files in data/audio: ${audioFiles.length}`)
  console.log(`Audio folder:       ${existsSync(AUDIO_DIR) ? AUDIO_DIR : '(missing)'}`)

  if (readyNotHosted.length > 0) {
    console.log('\nReady to upload:')
    for (const track of readyNotHosted.slice(0, 15)) {
      console.log(`  - ${track.title} — ${track.artist} (${track.id})`)
    }
    if (readyNotHosted.length > 15) {
      console.log(`  ... and ${readyNotHosted.length - 15} more`)
    }
  }
}

main()
