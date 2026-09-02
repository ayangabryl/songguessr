import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'
import { PNG } from 'pngjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const sequences = join(root, 'public', 'mascot', 'video-kit', 'sequences')
const outDir = join(root, 'public', 'mascot')
const SIZE = 256
const TARGET_FRAMES = 24

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

function frameStarts(source) {
  const marker = 'data-flipbook-frame="'
  const indexes = []
  let searchFrom = 0
  while (searchFrom < source.length) {
    const found = source.indexOf(marker, searchFrom)
    if (found < 0) break
    const tagStart = source.lastIndexOf('<g', found)
    const numberStart = found + marker.length
    const numberEnd = source.indexOf('"', numberStart)
    indexes.push({ n: Number(source.slice(numberStart, numberEnd)), i: tagStart })
    searchFrom = numberEnd + 1
  }
  return indexes
}

function extractGroup(source, start) {
  let depth = 0
  let cursor = start
  while (cursor < source.length) {
    const open = source.indexOf('<g', cursor)
    const close = source.indexOf('</g>', cursor)
    if (close < 0) throw new Error('Unclosed frame group')
    if (open >= 0 && open < close) {
      depth += 1
      cursor = open + 2
      continue
    }
    depth -= 1
    cursor = close + 4
    if (depth === 0) return source.slice(start, cursor)
  }
  throw new Error('Unclosed frame group')
}

function stripBackground(frameSvg) {
  return frameSvg
    .replace(/<animate\b[^>]*\/>/g, '')
    .replace(/<animate\b[^>]*>[\s\S]*?<\/animate>/g, '')
    .replace(/\svisibility="(?:hidden|visible)"/g, '')
    .replace(/<rect\b[^>]*width="(?:640|960)"[^>]*\/?>/g, '')
    .replace(/<rect\b[^>]*fill="#f[0-9a-f]{5}"[^>]*\/?>/gi, '')
    .replace(/<rect\b[^>]*fill="#fff(?:fff)?"[^>]*\/?>/gi, '')
}

function wrapSvg(inner) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 960 960">${inner}</svg>`
}

function pickIndexes(total, want) {
  if (total <= want) return Array.from({ length: total }, (_, i) => i)
  const picks = []
  for (let i = 0; i < want; i += 1) {
    picks.push(Math.round((i * (total - 1)) / (want - 1)))
  }
  return [...new Set(picks)]
}

function defringe(data) {
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3]
    if (alpha === 0 || alpha === 255) continue
    const luma = (data[i] + data[i + 1] + data[i + 2]) / 3
    if (luma >= 230) data[i + 3] = 0
  }
}

function isHeadphonePixel(r, g, b, a) {
  if (a < 40) return false
  const spread = Math.max(r, g, b) - Math.min(r, g, b)
  return spread < 45 && g <= r + 18
}

function stabilizeHeadband(base, frame) {
  for (let y = 8; y < 56; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const i = (y * SIZE + x) * 4
      if (!isHeadphonePixel(base[i], base[i + 1], base[i + 2], base[i + 3])) continue
      if (frame[i + 3] >= 80) continue
      frame[i] = base[i]
      frame[i + 1] = base[i + 1]
      frame[i + 2] = base[i + 2]
      frame[i + 3] = base[i + 3]
    }
  }
}

function renderFrame(svg, label) {
  try {
    const resvg = new Resvg(svg, {
      fitTo: { mode: 'width', value: SIZE },
      background: 'rgba(0,0,0,0)',
    })
    const png = PNG.sync.read(resvg.render().asPng())
    if (png.width !== SIZE || png.height !== SIZE) {
      throw new Error(`Unexpected size ${png.width}x${png.height}`)
    }
    defringe(png.data)
    return png.data
  } catch (error) {
    writeFileSync(join(outDir, 'debug-frame.svg'), svg)
    throw new Error(`${label}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function stitch(frames) {
  const sheet = new PNG({ width: SIZE * frames.length, height: SIZE })
  for (let i = 0; i < frames.length; i += 1) {
    const src = frames[i]
    for (let y = 0; y < SIZE; y += 1) {
      const srcStart = y * SIZE * 4
      const destStart = (y * sheet.width + i * SIZE) * 4
      src.copy(sheet.data, destStart, srcStart, srcStart + SIZE * 4)
    }
  }
  return PNG.sync.write(sheet, { colorType: 6 })
}

mkdirSync(outDir, { recursive: true })

for (const clip of CLIPS) {
  const source = readFileSync(findSvg(clip.folder), 'utf8')
  const starts = frameStarts(source)
  if (starts.length < 2) throw new Error(`${clip.folder} has ${starts.length} frames`)
  const picks = pickIndexes(starts.length, TARGET_FRAMES)
  const frames = picks.map((frameIndex) => {
    const inner = stripBackground(extractGroup(source, starts[frameIndex].i)).trim()
    const svg = wrapSvg(inner)
    if (frameIndex === picks[0]) {
      console.log(clip.name, 'head', svg.slice(0, 180))
      console.log(clip.name, 'tail', svg.slice(-80))
    }
    return renderFrame(svg, `${clip.name}#${frameIndex}`)
  })
  for (let i = 1; i < frames.length; i += 1) stabilizeHeadband(frames[0], frames[i])
  const sheet = stitch(frames)
  writeFileSync(join(outDir, `noot-${clip.name}.png`), sheet)
  console.log(clip.name, `${frames.length} frames from ${starts.length}`, `${Math.round(sheet.length / 1024)}kb`)
  if (clip.name === 'idle') {
    const still = new PNG({ width: SIZE, height: SIZE })
    frames[0].copy(still.data, 0, 0, frames[0].length)
    writeFileSync(join(outDir, 'noot-still.png'), PNG.sync.write(still, { colorType: 6 }))
  }
}
