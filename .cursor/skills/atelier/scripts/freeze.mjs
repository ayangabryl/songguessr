// Freeze-frame a character or any animated element at fixed fractions of its running animations and save crops,
// so poses can be judged frame by frame instead of by eye. Also samples blink events for 60 s when --blink is given.
//
//   node scripts/freeze.mjs <url> <selector> <outDir> [--poses=idle,win,lose] [--pose-attr=data-pose] [--fractions=0,0.25,0.5,0.75,1] [--blink=.lid-selector] [--wait=.sel]
//
// For each pose, the attribute (default data-pose) is set on the element, all animations are paused and seeked to each
// fraction, and a 2x crop of the element is written as <pose>-<pct>.png. The bounding box at 0 and 100 percent is compared
// (drift over 0.5 px is a finding). --blink samples the lid transform per frame for 60 s and prints blink count, mean gap,
// coefficient of variation, close/total ratio and double-blink count, which is the pass sheet in illustration/references/character.md.

import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { connect, sleep } from './cdp.mjs'

const args = process.argv.slice(2)
const flags = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => { const [k, ...v] = a.slice(2).split('='); return [k, v.join('=') || true] }))
const [url, selector, outDir] = args.filter((a) => !a.startsWith('--'))
if (!url || !selector || !outDir) {
  console.error('usage: node scripts/freeze.mjs <url> <selector> <outDir> [--poses=a,b] [--pose-attr=data-pose] [--fractions=0,0.5,1] [--blink=.lid] [--wait=.sel]')
  process.exit(1)
}
mkdirSync(outDir, { recursive: true })
const poses = (flags.poses ?? 'idle').split(',')
const attr = flags['pose-attr'] ?? 'data-pose'
const fractions = (flags.fractions ?? '0,0.25,0.5,0.75,1').split(',').map(Number)

const { page } = await connect()
await page.viewport(1440, 900)
await page.navigate(url, 200)
if (flags.wait) await page.waitFor(flags.wait)
await page.waitFor(selector)
await sleep(600)

const drift = []
for (const pose of poses) {
  await page.evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.setAttribute(${JSON.stringify(attr)}, ${JSON.stringify(pose)}); return true })()`)
  await sleep(120)
  const boxes = {}
  for (const f of fractions) {
    await page.evaluate(`(() => { for (const a of document.getAnimations()) { const t = a.effect.getComputedTiming(); if (t.iterations === Infinity) continue; a.pause(); a.currentTime = t.duration * ${f}; } return true })()`)
    await sleep(60)
    const b = await page.evaluate(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) } })()`)
    boxes[f] = b
    const file = join(outDir, `${pose}-${Math.round(f * 100)}.png`)
    await page.shot(file, { x: b.x - 24, y: b.y - 24, width: b.w + 48, height: b.h + 48, scale: 2 })
    console.log(`frame ${file}  bbox ${b.w}x${b.h} at ${b.x},${b.y}`)
  }
  await page.evaluate(`(() => { for (const a of document.getAnimations()) a.play(); return true })()`)
  const a = boxes[fractions[0]], z = boxes[fractions[fractions.length - 1]]
  const d = Math.max(Math.abs(a.x - z.x), Math.abs(a.y - z.y), Math.abs(a.w - z.w), Math.abs(a.h - z.h))
  drift.push({ pose, driftPx: +d.toFixed(1), pass: d <= 0.5 ? 'pass' : 'FAIL' })
}
console.log('\nBounding box drift between first and last fraction (floor 0.5 px)')
console.table(drift)

if (flags.blink && flags.blink !== true) {
  console.log('\nSampling blinks for 60 s...')
  const stats = await page.evaluate(`new Promise((done) => {
    const lid = document.querySelector(${JSON.stringify(flags.blink)}); if (!lid) return done({ error: 'no lid element' });
    const frames = [], start = performance.now();
    const tick = (now) => { const m = new DOMMatrixReadOnly(getComputedStyle(lid).transform); frames.push({ t: now - start, v: [m.a, m.d, m.e, m.f] }); now - start < 60000 ? requestAnimationFrame(tick) : finish(); };
    const finish = () => { const key = (v) => v.map((x) => x.toFixed(2)).join(','); const counts = {}; for (const f of frames) counts[key(f.v)] = (counts[key(f.v)] || 0) + 1;
      const rest = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0].split(',').map(Number); const dist = (v) => Math.hypot(...v.map((x, i) => x - rest[i]));
      const ev = []; let cur = null; for (const f of frames) { const d = dist(f.v); if (d > 0.01 && !cur) cur = { at: f.t, peakT: f.t, peak: d }; else if (cur && d > cur.peak) { cur.peak = d; cur.peakT = f.t; } else if (cur && d <= 0.01) { ev.push({ at: Math.round(cur.at), close: Math.round(cur.peakT - cur.at), total: Math.round(f.t - cur.at) }); cur = null; } }
      const gaps = ev.slice(1).map((b, i) => b.at - ev[i].at); const mean = gaps.reduce((a, b) => a + b, 0) / (gaps.length || 1);
      done({ blinks: ev.length, meanGapMs: Math.round(mean), cv: +(Math.sqrt(gaps.reduce((a, g) => a + (g - mean) ** 2, 0) / (gaps.length || 1)) / (mean || 1)).toFixed(2), doubles: gaps.filter((g) => g < 600).length, closeOverTotal: +(ev.reduce((a, b) => a + b.close / b.total, 0) / (ev.length || 1)).toFixed(2), totalsMs: ev.map((b) => b.total) }); };
    requestAnimationFrame(tick); })`)
  console.log(stats)
  if (!stats.error) {
    const pass = stats.blinks >= 6 && stats.blinks <= 20 && stats.cv >= 0.25 && stats.closeOverTotal >= 0.2 && stats.closeOverTotal <= 0.45 && stats.totalsMs.every((t) => t >= 100 && t <= 400)
    console.log(`Blink sheet: 6 to 20 blinks, CV >= 0.25, close/total 0.20 to 0.45, each 100 to 400 ms -> ${pass ? 'pass' : 'FAIL'}`)
  }
}
await page.close()
process.exit(0)
