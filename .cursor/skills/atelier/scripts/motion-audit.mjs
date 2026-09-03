// Motion audit on the running page: every animation that starts during a sampling window, with its target, property,
// duration, easing and iteration count; whether each duration and easing resolves to a token read from :root
// (--dur-*, --ease-*); idle concurrency; long animation frames; and an optional reduced-motion re-run.
//
//   node scripts/motion-audit.mjs <url> [--seconds=6] [--trigger="document.querySelector('.play').click()"] [--reduced] [--theme-key=key] [--wait=.sel]
//
// Pass criteria printed at the end: 0 off-token durations, 0 ease-in on UI elements, 0 non-character animations running
// at idle, 0 long animation frames (>= 50 ms) during the window. --reduced re-runs with prefers-reduced-motion: reduce and
// lists any transform animation on a non-character element (one --character=.selector is exempt).

import { connect, sleep } from './cdp.mjs'

const args = process.argv.slice(2)
const flags = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => { const [k, ...v] = a.slice(2).split('='); return [k, v.join('=') || true] }))
const url = args.find((a) => !a.startsWith('--'))
if (!url) {
  console.error('usage: node scripts/motion-audit.mjs <url> [--seconds=6] [--trigger=js] [--reduced] [--character=.selector] [--theme-key=key] [--wait=.sel]')
  process.exit(1)
}
const seconds = Number(flags.seconds ?? 6)
const character = flags.character ?? '.noot, .mascot, [data-character]'

async function run(reduced) {
  const { page } = await connect()
  await page.viewport(1440, 900)
  await page.media(reduced ? { 'prefers-reduced-motion': 'reduce' } : { 'prefers-reduced-motion': 'no-preference' })
  await page.navigate(url, 200)
  if (flags['theme-key']) { await page.evaluate(`localStorage.setItem(${JSON.stringify(flags['theme-key'])}, 'light')`); await page.navigate(url, 200) }
  if (flags.wait) await page.waitFor(flags.wait)
  await sleep(800)

  await page.evaluate(`(() => {
    window.__atelier = { seen: new Map(), loaf: [], samples: [] };
    const root = getComputedStyle(document.documentElement);
    const tokens = { dur: new Map(), ease: new Map() };
    const props = new Map();
    const walk = (rules) => { for (const r of rules) { if (r.style) for (const m of r.style.cssText.matchAll(/(--[\\w-]+)\\s*:/g)) { if (!props.has(m[1])) props.set(m[1], new Set()); props.get(m[1]).add(r.selectorText || ':root'); } if (r.cssRules) walk(r.cssRules); } };
    for (const sheet of document.styleSheets) { try { walk(sheet.cssRules) } catch {} }
    const pairs = [];
    for (const [p, selectors] of props) for (const selector of selectors) { let el = null; try { el = document.querySelector(selector) } catch {} const raw = (el ? getComputedStyle(el).getPropertyValue(p).trim() : '') || root.getPropertyValue(p).trim(); if (raw) pairs.push([p, raw]); }
    for (const [p, raw] of pairs) {
      if (p.startsWith('--dur')) tokens.dur.set(Math.round(parseFloat(raw) * (raw.endsWith('ms') ? 1 : 1000)), p);
      if (p.startsWith('--ease')) tokens.ease.set(raw.replace(/\\s+/g, ''), p); }
    window.__atelier.tokens = { dur: [...tokens.dur.entries()], ease: [...tokens.ease.entries()] };
    const sel = (el) => el ? el.tagName.toLowerCase() + (el.getAttribute && el.getAttribute('class') ? '.' + el.getAttribute('class').split(' ')[0] : '') : '?';
    const splitList = (s) => s.split(/,(?![^()]*\\))/).map((x) => x.trim());
    const easingOf = (a, el) => { const cs = getComputedStyle(el);
      if (a.animationName) { const i = splitList(cs.animationName).indexOf(a.animationName); const list = splitList(cs.animationTimingFunction); return list[i] ?? list[0]; }
      if (a.transitionProperty) { const i = splitList(cs.transitionProperty).indexOf(a.transitionProperty); const list = splitList(cs.transitionTimingFunction); return list[i] ?? list[0]; }
      return a.effect.getTiming().easing; };
    const record = () => { for (const a of document.getAnimations()) { const t = a.effect.getComputedTiming(); const el = a.effect.target; if (!el) continue;
      const key = sel(el) + '|' + (a.animationName ?? a.transitionProperty ?? 'waapi') + '|' + t.duration;
      if (!window.__atelier.seen.has(key)) window.__atelier.seen.set(key, { target: sel(el), name: a.animationName ?? a.transitionProperty ?? 'waapi', ms: Math.round(t.duration), easing: easingOf(a, el).replace(/\\s+/g, ''), iterations: t.iterations, isCharacter: !!(el.closest && el.closest(${JSON.stringify(character)})), transform: !!(a.effect.getKeyframes && a.effect.getKeyframes().some((k) => 'transform' in k || 'translate' in k || 'scale' in k)) }); } };
    window.__atelier.record = record;
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__atelier.loaf.push(Math.round(e.duration)) }).observe({ type: 'long-animation-frame', buffered: true });
    record();
  })()`)

  // idle sampling: what is running with no input, after entrance animations have had 1.5 s to finish
  await sleep(1500)
  for (let i = 0; i < 10; i++) {
    await page.evaluate(`(() => { window.__atelier.record(); window.__atelier.samples.push(document.getAnimations().filter((a) => a.playState === 'running' && a.effect.getComputedTiming().iterations !== Infinity ? true : a.playState === 'running').map((a) => { const el = a.effect.target; return (el.closest && el.closest(${JSON.stringify(character)})) ? 'character' : 'ui' })) })()`)
    await sleep(100)
  }
  const idleUi = await page.evaluate(`window.__atelier.samples.flat().filter((s) => s === 'ui').length`)

  if (flags.trigger && flags.trigger !== true) {
    try { await page.evaluate(`(async () => { ${flags.trigger} })()`) } catch (e) { console.error('trigger failed:', e.message) }
  }
  const start = Date.now()
  while (Date.now() - start < seconds * 1000) { await page.evaluate('window.__atelier.record()'); await sleep(50) }

  const out = await page.evaluate(`({ rows: [...window.__atelier.seen.values()], tokens: window.__atelier.tokens, loaf: window.__atelier.loaf })`)
  await page.close()
  return { ...out, idleUi }
}

const { rows, tokens, loaf, idleUi } = await run(false)
const durTokens = new Map(tokens.dur)
const easeTokens = new Map(tokens.ease)
for (const r of rows) {
  r.durToken = durTokens.get(r.ms) ?? (r.isCharacter ? 'character' : 'OFF')
  r.easeToken = easeTokens.get(r.easing) ?? (r.isCharacter ? 'character' : r.easing === 'linear' || /^steps\(/.test(r.easing) ? 'linear' : 'OFF')
  // A curve that resolves to the sheet's own --ease-in-out (theme switch, crossfades) is a token, not an ease-in;
  // only untokenised curves with a slow start are flagged.
  const inOutToken = /in-out/.test(r.easeToken)
  r.easeIn = /^ease-in$|cubic-bezier\(0\.[4-9]/.test(r.easing) && !r.isCharacter && !inOutToken
}
console.log(`\nMotion audit: ${url}\nTokens found  durations ${JSON.stringify([...durTokens.entries()])}  easings ${JSON.stringify([...easeTokens.entries()])}\n`)
console.table(rows.map(({ target, name, ms, easing, iterations, isCharacter, durToken, easeToken }) => ({ target, name, ms, easing: easing.slice(0, 40), iterations, character: isCharacter, durToken, easeToken })))
const offDur = rows.filter((r) => r.durToken === 'OFF')
const offEase = rows.filter((r) => r.easeToken === 'OFF' && !r.isCharacter)
const loops = rows.filter((r) => r.iterations === Infinity && !r.isCharacter)
const longFrames = loaf.filter((d) => d >= 50)
const checks = [
  ['Animations observed', rows.length, '', ''],
  ['Off-token durations (non-character)', offDur.length, 0, offDur.length ? 'FAIL' : 'pass'],
  ['Off-token easings (non-character)', offEase.length, 0, offEase.length ? 'FAIL' : 'pass'],
  ['ease-in on UI', rows.filter((r) => r.easeIn).length, 0, rows.some((r) => r.easeIn) ? 'FAIL' : 'pass'],
  ['Infinite loops outside the character', loops.length, 0, loops.length ? 'FAIL' : 'pass'],
  ['UI animations running at idle (10 samples)', idleUi, 0, idleUi ? 'FAIL' : 'pass'],
  ['Long animation frames >= 50 ms', longFrames.length + (longFrames.length ? ` (${longFrames.join(', ')} ms)` : ''), 0, longFrames.length ? 'FAIL' : 'pass'],
]
console.log('| Check | Result | Floor | Pass |\n|---|---|---|---|')
for (const c of checks) console.log(`| ${c[0]} | ${c[1]} | ${c[2]} | ${c[3]} |`)
if (offDur.length) { console.log('\nOff-token durations'); console.table(offDur.map(({ target, name, ms, easing }) => ({ target, name, ms, easing }))) }
if (offEase.length) { console.log('\nOff-token easings'); console.table(offEase.map(({ target, name, ms, easing }) => ({ target, name, ms, easing }))) }

if (flags.reduced) {
  const r = await run(true)
  const moving = r.rows.filter((x) => x.transform && !x.isCharacter)
  console.log(`\nReduced motion: ${r.rows.length} animations observed; transform animations outside the character: ${moving.length} ${moving.length ? 'FAIL' : 'pass'}`)
  if (moving.length) console.table(moving.map(({ target, name, ms }) => ({ target, name, ms })))
}
process.exit(checks.every((c) => c[3] !== 'FAIL') ? 0 : 1)
