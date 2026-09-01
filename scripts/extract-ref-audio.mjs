import { readFileSync } from 'node:fs'

const source = readFileSync('ref.js', 'utf8')
const needles = [
  'From the start',
  'Main hook',
  'hookOffset',
  'startMode',
  'previewUrl',
  'preview_url',
  'audioUrl',
  'audioSrc',
  'hookStart',
  'startOffset',
  'currentTime',
  '.mp3',
  'deezer',
  'itunes',
  'spotify',
  'catalogue',
  '/api/',
  'playback',
  'intro',
  'hook',
  '12',
  'cloudinary',
  'supabase',
  'r2.dev',
  'storage',
]

for (const needle of needles) {
  let idx = 0
  let count = 0
  while ((idx = source.indexOf(needle, idx)) >= 0 && count < 3) {
    console.log(`\n== ${needle} @${idx} ==`)
    console.log(source.slice(Math.max(0, idx - 100), idx + 200))
    idx += needle.length
    count += 1
  }
}
