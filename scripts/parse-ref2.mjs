import { readFileSync } from 'node:fs'

const source = readFileSync('ref.js', 'utf8')
const needles = [
  '/api/',
  'catalogue',
  'Reroll all',
  'Loading catalogue',
  'Main hook',
  'From the start',
  'Guessed in',
  'CORRECT',
  'SKIPPED',
  'songless-',
  'playback',
  'hookOffset',
  'startMode',
]
for (const needle of needles) {
  const idx = source.indexOf(needle)
  if (idx >= 0) {
    console.log('\n==', needle, '==')
    console.log(source.slice(Math.max(0, idx - 80), idx + 120))
  }
}
