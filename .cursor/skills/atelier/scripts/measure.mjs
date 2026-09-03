// Measurement pass on a rendered page: contrast of every visible text node against its effective background,
// token conformance (spacing, radius, font-size read from :root custom properties), touch targets, type metrics,
// unlabelled icon buttons, shouting labels, horizontal overflow and concentric corners.
//
//   node scripts/measure.mjs <url> [--viewport=1440x900|390x844m] [--theme=light|dark] [--theme-key=key] [--wait=.sel] [--count=.row --count-min=20] [--json=out.json]
//   --count reports how many matching elements sit fully inside the first viewport (the brief's density metric); --count-min turns it into a pass/fail.
//
// Exit code is 0 when every floor passes and 1 otherwise, so it can gate a pipeline. Reads the scales from
// --space-*, --r-* or --radius-*, and --fs-* on :root; falls back to the atelier default scales when absent.

import { writeFileSync } from 'node:fs'
import { connect, sleep } from './cdp.mjs'

const args = process.argv.slice(2)
const flags = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')))
const url = args.find((a) => !a.startsWith('--'))
if (!url) {
  console.error('usage: node scripts/measure.mjs <url> [--viewport=390x844m] [--theme=dark] [--theme-key=key] [--wait=.sel] [--count=.row --count-min=20] [--json=out.json]')
  process.exit(1)
}
const vp = flags.viewport ?? '1440x900'
const mobile = vp.endsWith('m')
const [w, h] = vp.replace(/m$/, '').split('x').map(Number)
const theme = flags.theme ?? 'light'

const { page } = await connect()
await page.viewport(w, h, mobile)
await page.media({ 'prefers-color-scheme': theme })
await page.navigate(url, 200)
if (flags['theme-key']) {
  await page.evaluate(`localStorage.setItem(${JSON.stringify(flags['theme-key'])}, ${JSON.stringify(theme)})`)
  await page.navigate(url, 200)
}
if (flags.wait) await page.waitFor(flags.wait)
await sleep(800)

const report = await page.evaluate(`(() => {
  const root = getComputedStyle(document.documentElement);
  // Custom properties may be declared on :root, html, body or an app shell; resolve each on the element its rule matches.
  const customProps = new Map();
  const walk = (rules) => { for (const r of rules) { if (r.style) for (const m of r.style.cssText.matchAll(/(--[\\w-]+)\\s*:/g)) { if (!customProps.has(m[1])) customProps.set(m[1], new Set()); customProps.get(m[1]).add(r.selectorText || ':root'); } if (r.cssRules) walk(r.cssRules); } };
  for (const sheet of document.styleSheets) { try { walk(sheet.cssRules) } catch {} }
  const resolve = (p, selector) => { let el = null; try { el = document.querySelector(selector) } catch {} const v = el ? getComputedStyle(el).getPropertyValue(p).trim() : ''; return v || root.getPropertyValue(p).trim(); };
  const readScale = (prefixes, fallback) => {
    const vals = new Set();
    for (const [p, selectors] of customProps) if (prefixes.some((x) => p.startsWith(x))) for (const selector of selectors) {
      const raw = resolve(p, selector); const v = parseFloat(raw); if (Number.isNaN(v)) continue;
      vals.add(raw.endsWith('rem') ? v * 16 : raw.endsWith('em') ? v * 16 : v);
    }
    return vals.size ? [0, ...vals].sort((a, b) => a - b) : fallback;
  };
  const SPACE = readScale(['--space-'], [0, 4, 8, 12, 16, 24, 32, 48, 64, 96]);
  const RADIUS = readScale(['--r-', '--radius-'], [0, 6, 12, 20, 28, 999]);
  const FS = readScale(['--fs-'], [12.8, 14, 16, 20, 25, 31.25, 39, 49]);
  const near = (v, scale, tol = 0.6) => scale.some((s) => Math.abs(v - s) <= tol) || v >= 999;

  const cvs = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  const parse = (css) => { cvs.clearRect(0, 0, 1, 1); cvs.fillStyle = css; cvs.fillRect(0, 0, 1, 1); const [r, g, b, a] = cvs.getImageData(0, 0, 1, 1).data; const lin = (v) => (v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; return [[lin(r), lin(g), lin(b)], a / 255]; };
  const lum = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const over = (fg, a, bg) => fg.map((v, i) => v * a + bg[i] * (1 - a));
  const ratio = (fg, bg) => { const [l1, l2] = [lum(fg), lum(bg)].sort((x, y) => y - x); return (l1 + 0.05) / (l2 + 0.05); };
  const bgOf = (el) => { let acc = null, accA = 0; for (let n = el; n; n = n.parentElement) { const [c, a] = parse(getComputedStyle(n).backgroundColor); if (a > 0) { acc = acc ? over(c, a, acc) : over(c, a, [1, 1, 1]); accA = Math.max(accA, a); if (a > 0.999) return acc; } } return acc ?? [1, 1, 1]; };
  const sel = (el) => el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : '');

  const visible = [...document.querySelectorAll('body *')].filter((el) => el.checkVisibility && el.checkVisibility());
  const text = visible.filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()))
    .map((el) => { const cs = getComputedStyle(el); const [fg, a] = parse(cs.color); const bg = bgOf(el); const px = parseFloat(cs.fontSize), wt = +cs.fontWeight;
      const large = px >= 24 || (px >= 18.66 && wt >= 700); const r = ratio(over(fg, a, bg), bg); const lh = cs.lineHeight === 'normal' ? 1.2 : parseFloat(cs.lineHeight) / px;
      const chars = el.getBoundingClientRect().width / (px * 0.5); const caps = cs.textTransform === 'uppercase' || /^[A-Z0-9 ]{4,}$/.test(el.textContent.trim());
      return { el: sel(el), text: el.textContent.trim().slice(0, 28), px: +px.toFixed(1), weight: wt, ratio: +r.toFixed(2), floor: large ? 3 : 4.5, pass: r >= (large ? 3 : 4.5), lineHeight: +lh.toFixed(2), measureCh: Math.round(chars), caps, tabular: cs.fontVariantNumeric.includes('tabular') }; });

  const off = [];
  for (const el of visible) { const cs = getComputedStyle(el);
    const props = { paddingTop: SPACE, paddingRight: SPACE, paddingBottom: SPACE, paddingLeft: SPACE, marginTop: SPACE, marginBottom: SPACE, borderTopLeftRadius: RADIUS, fontSize: FS };
    if (cs.rowGap === cs.columnGap) props.gap = SPACE; else { props.rowGap = SPACE; props.columnGap = SPACE; }
    for (const [p, scale] of Object.entries(props)) { const raw = cs[p]; const v = parseFloat(raw); if (Number.isNaN(v) || raw === 'normal' || raw.endsWith('%') || v === 0) continue; if (!near(v, scale)) off.push({ el: sel(el), prop: p, value: raw }); } }

  const minTarget = mobile => mobile ? 44 : 32;
  // Inline links in running text are exempt from the target rule (WCAG 2.2 SC 2.5.8 "inline" exception); they are counted, not failed.
  const inlineLink = (el) => el.tagName === 'A' && getComputedStyle(el).display === 'inline' && !el.matches('nav a, [role=menubar] a, [role=tablist] a, footer a');
  const all = [...document.querySelectorAll('a,button,input,select,textarea,[role=button],[role=option],[role=tab],[tabindex]:not([tabindex="-1"])')].filter((el) => el.checkVisibility && el.checkVisibility());
  const inlineLinks = all.filter(inlineLink).length;
  const targets = all.filter((el) => !inlineLink(el)).map((el) => { const r = el.getBoundingClientRect(); return { el: sel(el), w: Math.round(r.width), h: Math.round(r.height) }; });
  const isTouch = matchMedia('(pointer: coarse)').matches;
  const smallTargets = targets.filter((t) => t.w < minTarget(isTouch) || t.h < minTarget(isTouch));
  // Above-the-fold count for the brief's density metric: --count=<selector> (elements fully inside the first viewport).
  const countSel = ${JSON.stringify(flags.count ?? '')};
  const fold = countSel ? [...document.querySelectorAll(countSel)].filter((el) => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.height > 0; }).length : null;

  const unlabelled = [...document.querySelectorAll('button,a[role=button]')].filter((b) => b.checkVisibility && b.checkVisibility() && !b.textContent.trim() && !b.getAttribute('aria-label') && !b.getAttribute('aria-labelledby') && !b.getAttribute('title')).map(sel);
  const shouting = text.filter((t) => t.caps && t.text.length >= 4).map((t) => t.el + ' "' + t.text + '"');
  const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;

  const concentric = [];
  for (const el of visible) { const p = el.parentElement; if (!p) continue; const ro = parseFloat(getComputedStyle(p).borderTopLeftRadius), ri = parseFloat(getComputedStyle(el).borderTopLeftRadius);
    if (!ro || !ri || ro >= 999 || ri >= 999) continue; const inset = el.getBoundingClientRect().left - p.getBoundingClientRect().left; if (inset > 0 && Math.abs(ri - (ro - inset)) > 1) concentric.push({ el: sel(el), outer: ro, inset: +inset.toFixed(1), inner: ri, expected: +(ro - inset).toFixed(1) }); }

  const focusRemoved = [...document.styleSheets].some((s) => { try { return [...s.cssRules].some((r) => r.selectorText && /:focus(-visible)?/.test(r.selectorText) && r.style.outlineStyle === 'none' && !r.style.boxShadow); } catch { return false; } });

  return { scales: { SPACE, RADIUS, FS }, text, contrastFails: text.filter((t) => !t.pass), offScale: off, targets: targets.length, inlineLinks, smallTargets, fold, countSel, unlabelled, shouting, overflow, concentric, focusRemoved, isTouch, minTarget: minTarget(isTouch) };
})()`)
await page.close()

const smallest = report.text.reduce((m, t) => (t.px < m ? t.px : m), Infinity)
const lowest = report.text.reduce((m, t) => (t.ratio < m.ratio ? t : m), { ratio: Infinity })
const summary = [
  ['Text nodes measured', report.text.length, '', ''],
  ['Lowest contrast', `${lowest.ratio}:1 (${lowest.el} "${lowest.text}")`, `${lowest.floor}:1`, lowest.ratio >= lowest.floor ? 'pass' : 'FAIL'],
  ['Contrast failures', report.contrastFails.length, 0, report.contrastFails.length === 0 ? 'pass' : 'FAIL'],
  ['Off-scale values', report.offScale.length, 0, report.offScale.length === 0 ? 'pass' : 'FAIL'],
  [`Targets under ${report.minTarget} px`, `${report.smallTargets.length} of ${report.targets} controls (${report.inlineLinks} inline text links exempt)`, 0, report.smallTargets.length === 0 ? 'pass' : 'FAIL'],
  ...(report.countSel ? [[`Above the fold: ${report.countSel}`, report.fold, flags['count-min'] ? `${flags['count-min']} at least` : 'brief metric', flags['count-min'] ? (report.fold >= +flags['count-min'] ? 'pass' : 'FAIL') : 'info']] : []),
  ['Smallest text', `${smallest} px`, '12 px', smallest >= 12 ? 'pass' : 'FAIL'],
  ['Unlabelled icon buttons', report.unlabelled.length, 0, report.unlabelled.length === 0 ? 'pass' : 'FAIL'],
  ['Uppercase labels', report.shouting.length, '1 at most', report.shouting.length <= 1 ? 'pass' : 'FAIL'],
  ['Horizontal overflow', `${report.overflow} px`, '0 px', report.overflow === 0 ? 'pass' : 'FAIL'],
  ['Non-concentric nested corners', report.concentric.length, 0, report.concentric.length === 0 ? 'pass' : 'FAIL'],
  ['Focus outline removed without replacement', report.focusRemoved, false, report.focusRemoved ? 'FAIL' : 'pass'],
]
console.log(`\nMeasure: ${url} at ${vp} ${theme}\nScales read from tokens (fallback to atelier defaults when a scale is absent)  space ${JSON.stringify(report.scales.SPACE)}  radius ${JSON.stringify(report.scales.RADIUS)}  fs ${JSON.stringify(report.scales.FS.map((v) => +v.toFixed(2)))}\n`)
console.log('| Check | Result | Floor | Pass |\n|---|---|---|---|')
for (const r of summary) console.log(`| ${r[0]} | ${r[1]} | ${r[2]} | ${r[3]} |`)
const detail = (title, rows) => { if (rows.length) { console.log(`\n${title}`); console.table(rows.slice(0, 40)); if (rows.length > 40) console.log(`... ${rows.length - 40} more`) } }
detail('Contrast failures', report.contrastFails.map(({ el, text, px, ratio, floor }) => ({ el, text, px, ratio, floor })))
detail('Off-scale values', report.offScale)
detail('Small targets', report.smallTargets)
detail('Unlabelled buttons', report.unlabelled.map((el) => ({ el })))
detail('Uppercase labels', report.shouting.map((s) => ({ s })))
detail('Non-concentric corners', report.concentric)
if (flags.json) { writeFileSync(flags.json, JSON.stringify(report, null, 2)); console.log(`\nfull report -> ${flags.json}`) }
process.exit(summary.every((r) => r[3] === 'pass') ? 0 : 1)
