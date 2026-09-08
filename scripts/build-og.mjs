import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'
import { PNG } from 'pngjs'

// Render the source once with scripts/blender/noot_og.py. Social-card builds
// then use this checked-in render and the game's fonts, without needing Blender.
const root = new URL('../', import.meta.url)
const path = (name) => fileURLToPath(new URL(name, root))
const source = PNG.sync.read(readFileSync(path('assets/og/noot-render.png')))
let left = source.width, top = source.height, right = 0, bottom = 0
for (let y = 0; y < source.height; y++) {
  for (let x = 0; x < source.width; x++) {
    if (source.data[(y * source.width + x) * 4 + 3] > 8) {
      left = Math.min(left, x); right = Math.max(right, x)
      top = Math.min(top, y); bottom = Math.max(bottom, y)
    }
  }
}
if (left > right) throw new Error('Noot render has no visible pixels')
const crop = new PNG({ width: right - left + 1, height: bottom - top + 1 })
PNG.bitblt(source, crop, left, top, crop.width, crop.height, 0, 0)
const mascot = PNG.sync.write(crop).toString('base64')
const ink = '#19211b', green = '#00883e', muted = '#667067'
const text = (x, y, size, copy, color = ink, serif = true, anchor = 'start') =>
  `<text x="${x}" y="${y}" font-family="${serif ? 'Instrument Serif' : 'Open Runde'}" font-size="${size}" fill="${color}" text-anchor="${anchor}">${copy}</text>`
const noot = (x, y, height) => {
  const width = height * crop.width / crop.height
  return `<ellipse cx="${x + width / 2}" cy="${y + height - 1}" rx="${width * .40}" ry="9" fill="#23301c" opacity=".12" filter="url(#shadow)"/>
  <image href="data:image/png;base64,${mascot}" x="${x}" y="${y}" width="${width}" height="${height}"/>`
}
const arrangements = {
  A: `${text(76, 110, 46, 'SongGuessr')}
      ${text(76, 278, 102, 'Know it in')}
      ${text(76, 375, 102, 'a heartbeat?', green)}
      ${text(80, 438, 24, 'Guess the song. Solo or with friends.', muted, false)}
      ${text(80, 558, 20, 'songguessr.lol', muted, false)}
      ${noot(763, 64, 496)}`,
  B: `${text(600, 156, 112, 'SongGuessr', ink, true, 'middle')}
      ${text(112, 308, 74, 'Know it in')}
      ${text(112, 387, 74, 'a heartbeat?', green)}
      ${text(116, 453, 23, 'Guess the song. Solo or with friends.', muted, false)}
      ${text(116, 558, 20, 'songguessr.lol', muted, false)}
      ${noot(786, 204, 356)}`,
  C: `${noot(89, 64, 496)}
      ${text(536, 110, 46, 'SongGuessr')}
      ${text(536, 278, 102, 'Know it in')}
      ${text(536, 375, 102, 'a heartbeat?', green)}
      ${text(540, 438, 24, 'Guess the song. Solo or with friends.', muted, false)}
      ${text(540, 558, 20, 'songguessr.lol', muted, false)}`,
}
function render(arrangement, width = 1200) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <defs><filter id="shadow" x="-30%" y="-200%" width="160%" height="500%"><feGaussianBlur stdDeviation="7"/></filter></defs>
    <rect width="1200" height="630" fill="#f7f8f2"/>
    ${arrangements[arrangement]}
  </svg>`
  return new Resvg(svg, {
    font: {
      loadSystemFonts: false,
      fontFiles: [path('assets/og/InstrumentSerif.ttf'), path('assets/og/OpenRunde.ttf')],
    },
    fitTo: { mode: 'width', value: width },
  }).render().asPng()
}
writeFileSync(path('public/og.png'), render('A'))
if (process.argv.includes('--compare')) {
  mkdirSync(path('docs/design/og'), { recursive: true })
  for (const arrangement of Object.keys(arrangements)) {
    writeFileSync(path(`docs/design/og/option-${arrangement}.png`), render(arrangement))
    writeFileSync(path(`docs/design/og/option-${arrangement}-small.png`), render(arrangement, 600))
  }
}
console.log('Built public/og.png (1200 × 630) with the Blender Noot render.')
