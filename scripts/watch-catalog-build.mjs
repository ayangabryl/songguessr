import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { UNIQUE_OPM_ARTISTS } from './opm-artists.mjs'

const DEFAULT_WAIT_SECONDS = 120
const CHECKPOINT_PATH = resolve(process.cwd(), 'data/catalog-build.checkpoint.json')

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms))
}

function loadCompletedCount() {
  try {
    const parsed = JSON.parse(readFileSync(CHECKPOINT_PATH, 'utf8'))
    const completed = Array.isArray(parsed.completedArtists) ? parsed.completedArtists.length : 0
    return completed
  } catch {
    return 0
  }
}

function runBuild(extraArgs) {
  return new Promise((resolveRun) => {
    const child = spawn(process.execPath, ['scripts/build-catalog.mjs', ...extraArgs], {
      cwd: process.cwd(),
      stdio: 'inherit',
      shell: false,
    })

    child.on('close', (code) => {
      resolveRun(code ?? 1)
    })
  })
}

async function main() {
  const extraArgs = process.argv.slice(2)
  const totalArtists = UNIQUE_OPM_ARTISTS.length

  console.log(`Catalog watch: will retry until all ${totalArtists} artists are complete.`)

  while (true) {
    const completedBefore = loadCompletedCount()
    console.log(`Starting catalog build (${completedBefore}/${totalArtists} artists done)...`)

    const exitCode = await runBuild(extraArgs)
    const completedAfter = loadCompletedCount()

    if (exitCode === 0 && completedAfter >= totalArtists) {
      console.log('Catalog build complete.')
      return
    }

    if (exitCode === 0 && completedAfter < totalArtists) {
      console.warn(
        `Build exited cleanly but only ${completedAfter}/${totalArtists} artists are done. Retrying in ${DEFAULT_WAIT_SECONDS}s...`,
      )
    } else {
      console.warn(
        `Build exited with code ${exitCode} (${completedAfter}/${totalArtists} artists done). Retrying in ${DEFAULT_WAIT_SECONDS}s...`,
      )
    }

    await sleep(DEFAULT_WAIT_SECONDS * 1000)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
