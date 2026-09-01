import { readFileSync } from 'node:fs'

const source = readFileSync('ref.js', 'utf8')
const needles = [
  'hookStartMs',
  'startAtMs',
  'kind===`hosted`',
  'kind===`synth`',
  'audio.kind',
  'hosted',
  'catalog.json',
  'review-catalog',
  'startAtMs:0',
  'noteLengthMs',
  'clueGainDb',
]

for (const needle of needles) {
  let idx = 0
  let count = 0
  while ((idx = source.indexOf(needle, idx)) >= 0 && count < 5) {
    console.log(`\n== ${needle} @${idx} ==`)
    console.log(source.slice(Math.max(0, idx - 150), idx + 300))
    idx += needle.length
    count += 1
  }
}
