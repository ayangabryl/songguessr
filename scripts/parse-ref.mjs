import { readFileSync } from 'node:fs'

const source = readFileSync('ref.js', 'utf8')
const matches = [...source.matchAll(/`([a-z][a-z0-9-]{2,40})`/g)].map((m) => m[1])
const unique = [...new Set(matches)].sort()
for (const item of unique) {
  if (
    item.includes('panel') ||
    item.includes('stage') ||
    item.includes('game') ||
    item.includes('play') ||
    item.includes('result') ||
    item.includes('guess') ||
    item.includes('search') ||
    item.includes('difficulty') ||
    item.includes('setting') ||
    item.includes('mode') ||
    item.includes('volume') ||
    item.includes('wrong') ||
    item.includes('suggest') ||
    item.includes('empty') ||
    item.includes('round')
  ) {
    console.log(item)
  }
}

const strings = [...source.matchAll(/`([^`\\]{4,60})`/g)]
  .map((m) => m[1])
  .filter((s) => /[A-Z]/.test(s) && /\s/.test(s))
console.log('\n--- UI strings ---')
for (const s of [...new Set(strings)].sort()) {
  console.log(s)
}
