// Capture matrix: viewports x themes x states, DPR 2, named <name>-<state>-<theme>-<width>.png.
//
//   node scripts/capture.mjs <url> <outDir> [states.json] [--name=screen] [--theme-key=localStorageKey] [--wait=.selector]
//
// states.json maps a state name to a JavaScript expression run in the page before the shot, e.g.
//   { "idle": "true", "menu-open": "document.querySelector('.menu-btn').click()" }
// The default is a single "idle" state. Themes are emulated with prefers-color-scheme; when --theme-key is given,
// the same value ("light" or "dark") is also written to localStorage under that key before navigating, for apps
// with a manual toggle. Prints a markdown table for the QA report.

import { mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { connect, sleep } from './cdp.mjs'

const args = process.argv.slice(2)
const flags = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')))
const positional = args.filter((a) => !a.startsWith('--'))
const [url, outDir, statesFile] = positional
if (!url || !outDir) {
  console.error('usage: node scripts/capture.mjs <url> <outDir> [states.json] [--name=screen] [--theme-key=key] [--wait=.selector] [--viewports=1440x900,390x844m]')
  process.exit(1)
}
mkdirSync(outDir, { recursive: true })
const name = flags.name ?? 'screen'
const states = statesFile ? JSON.parse(readFileSync(statesFile, 'utf8')) : { idle: 'true' }
const viewports = (flags.viewports ?? '1440x900,1280x660,768x1024m,390x844m').split(',').map((v) => {
  const mobile = v.endsWith('m')
  const [w, h] = v.replace(/m$/, '').split('x').map(Number)
  return { w, h, mobile }
})
const themes = (flags.themes ?? 'light,dark').split(',')

const { page } = await connect()
const rows = []
for (const { w, h, mobile } of viewports) {
  for (const theme of themes) {
    await page.viewport(w, h, mobile)
    await page.media({ 'prefers-color-scheme': theme })
    await page.navigate(url, 200)
    if (flags['theme-key']) {
      await page.evaluate(`localStorage.setItem(${JSON.stringify(flags['theme-key'])}, ${JSON.stringify(theme)})`)
      await page.navigate(url, 200)
    }
    if (flags.wait) await page.waitFor(flags.wait)
    await sleep(600)
    for (const [state, script] of Object.entries(states)) {
      try {
        await page.evaluate(`(async () => { ${script.includes('return') || script.includes(';') ? script : `return (${script})`} })()`)
      } catch (e) {
        console.error(`state "${state}" script failed at ${w}x${h} ${theme}: ${e.message}`)
      }
      await sleep(700)
      const overflow = await page.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth')
      const file = join(outDir, `${name}-${state}-${theme}-${w}.png`)
      await page.shot(file)
      rows.push({ viewport: `${w}x${h}${mobile ? ' (touch)' : ''}`, theme, state, file, overflow })
      console.log(`shot ${file}${overflow > 0 ? `  horizontal overflow ${overflow} px` : ''}`)
    }
  }
}
await page.close()

console.log('\n| Viewport | Theme | State | File | Overflow px |\n|---|---|---|---|---|')
for (const r of rows) console.log(`| ${r.viewport} | ${r.theme} | ${r.state} | ${r.file} | ${r.overflow} |`)
process.exit(0)
