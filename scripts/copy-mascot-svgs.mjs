import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const sequences = join(root, 'public', 'mascot', 'video-kit', 'sequences')
const outDir = join(root, 'public', 'mascot')

const CLIPS = [
  { name: 'idle', folder: '01-idle-breathe-loop' },
  { name: 'play', folder: '04-listening-pulse-loop' },
  { name: 'win', folder: '05-correct-answer' },
  { name: 'lose', folder: '07-wrong-answer' },
  { name: 'skip', folder: '10-skip' },
  { name: 'streak', folder: '11-streak' },
  { name: 'switch', folder: '20-color-green-to-yellow' },
]

function findSvg(folder) {
  const dir = join(sequences, folder)
  const file = readdirSync(dir).find((name) => name.endsWith('.svg'))
  if (!file) throw new Error(`No SVG in ${folder}`)
  return join(dir, file)
}

function stripCanvas(source) {
  return source
    .replace(/<rect\b[^>]*width="(?:640|960)"[^>]*\/?>/g, '')
    .replace(/<rect\b[^>]*fill="#f9f9f9"[^>]*\/?>/gi, '')
}

mkdirSync(outDir, { recursive: true })

for (const clip of CLIPS) {
  const source = readFileSync(findSvg(clip.folder), 'utf8')
  const cleaned = stripCanvas(source)
  const dest = join(outDir, `noot-${clip.name}.svg`)
  writeFileSync(dest, cleaned)
  console.log(clip.name, `${Math.round(cleaned.length / 1024)}kb`)
}
