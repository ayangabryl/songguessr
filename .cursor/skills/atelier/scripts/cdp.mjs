// Zero-dependency Chrome DevTools Protocol client for the atelier QA scripts.
// Requires Node 22+ (global WebSocket and fetch) and Chrome listening on 127.0.0.1:9222 (scripts/chrome.sh).
//
//   import { connect, sleep } from './cdp.mjs'
//   const { page } = await connect()
//   await page.viewport(390, 844, true)
//   await page.media({ 'prefers-color-scheme': 'dark' })
//   await page.navigate('http://127.0.0.1:5173/')
//   await page.shot('/tmp/out.png')
//   await page.close()

import { setTimeout as sleep } from 'node:timers/promises'
import { writeFileSync } from 'node:fs'

const BROWSER = process.env.ATELIER_CDP ?? 'http://127.0.0.1:9222'

export async function connect() {
  let info
  try {
    info = await (await fetch(`${BROWSER}/json/version`)).json()
  } catch {
    throw new Error(`No Chrome at ${BROWSER}. Run scripts/chrome.sh first.`)
  }
  const ws = new WebSocket(info.webSocketDebuggerUrl)
  await new Promise((res, rej) => {
    ws.onopen = res
    ws.onerror = () => rej(new Error('WebSocket to Chrome failed; start Chrome with --remote-allow-origins=*'))
  })
  let id = 0
  const pending = new Map()
  const handlers = []
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id)
      pending.delete(msg.id)
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result)
    } else if (msg.method) for (const h of handlers) h(msg)
  }
  function send(method, params = {}, sessionId) {
    id += 1
    const payload = { id, method, params }
    if (sessionId) payload.sessionId = sessionId
    ws.send(JSON.stringify(payload))
    return new Promise((resolve, reject) => pending.set(id, { resolve, reject }))
  }
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
  const S = (m, p) => send(m, p, sessionId)
  await S('Page.enable')
  await S('Runtime.enable')

  const page = {
    send: S,
    onEvent: (fn) => handlers.push(fn),
    async viewport(width, height, mobile = false, dpr = 2) {
      await S('Emulation.setDeviceMetricsOverride', {
        width, height, deviceScaleFactor: dpr, mobile, screenWidth: width, screenHeight: height,
      })
      if (mobile) await S('Emulation.setTouchEmulationEnabled', { enabled: true })
    },
    // features: { 'prefers-color-scheme': 'dark', 'prefers-reduced-motion': 'reduce' }
    async media(features) {
      await S('Emulation.setEmulatedMedia', {
        features: Object.entries(features).map(([name, value]) => ({ name, value })),
      })
    },
    async navigate(url, settleMs = 500) {
      await S('Page.navigate', { url })
      await new Promise((res) => {
        const h = (m) => { if (m.method === 'Page.loadEventFired') { res() } }
        handlers.push(h)
        setTimeout(res, 8000)
      })
      await sleep(settleMs)
    },
    async evaluate(expression) {
      const r = await S('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
      if (r.exceptionDetails) {
        const text = r.exceptionDetails.exception?.description ?? r.exceptionDetails.text
        throw new Error(`${text} :: ${expression.slice(0, 120)}`)
      }
      return r.result.value
    },
    async waitFor(selector, timeout = 15000) {
      const start = Date.now()
      while (Date.now() - start < timeout) {
        if (await page.evaluate(`!!document.querySelector(${JSON.stringify(selector)})`)) return true
        await sleep(120)
      }
      throw new Error(`waitFor timed out: ${selector}`)
    },
    async click(selector) {
      const box = await page.evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
      if (!box) throw new Error(`click: no element for ${selector}`)
      for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) {
        await S('Input.dispatchMouseEvent', { type, x: box.x, y: box.y, button: 'left', clickCount: 1 })
      }
    },
    async type(selector, text) {
      await page.evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`)
      await S('Input.insertText', { text })
    },
    async key(key, code = key) {
      const keyMap = { Tab: 9, Enter: 13, Escape: 27, ArrowDown: 40, ArrowUp: 38, Space: 32 }
      const windowsVirtualKeyCode = keyMap[key] ?? key.charCodeAt(0)
      await S('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode })
      await S('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode })
    },
    async shot(path, clip) {
      const params = { format: 'png' }
      if (clip) params.clip = { x: clip.x, y: clip.y, width: clip.width, height: clip.height, scale: clip.scale ?? 1 }
      const r = await S('Page.captureScreenshot', params)
      writeFileSync(path, Buffer.from(r.data, 'base64'))
      return path
    },
    async shotElement(selector, path, pad = 8, scale = 2) {
      const r = await page.evaluate(`(() => { const b = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height } })()`)
      return page.shot(path, { x: r.x - pad, y: r.y - pad, width: r.width + pad * 2, height: r.height + pad * 2, scale })
    },
    async close() {
      await send('Target.closeTarget', { targetId })
      ws.close()
    },
  }
  return { page, send, ws }
}

export { sleep }
