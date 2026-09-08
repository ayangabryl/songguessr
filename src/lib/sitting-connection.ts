/** Own every socket timer so retries cannot outlive leaving or switching tables. */
export function createSittingConnection(options: {
  url: string
  onSocket: (socket: WebSocket | null) => void
  onOpen: (socket: WebSocket) => void
  onPayload: (payload: Record<string, unknown>) => void
  onConnecting: () => void
  onSlow: () => void
  onFailure: (reason: 'timeout' | 'offline' | 'replaced') => void
  isOnline?: () => boolean
  makeSocket?: (url: string) => WebSocket
}) {
  const online = options.isOnline ?? (() => navigator.onLine)
  const makeSocket = options.makeSocket ?? (url => new WebSocket(url))
  let socket: WebSocket | null = null, disposed = false, live = false, terminal = false, attempts = 0
  let slow: ReturnType<typeof setTimeout> | undefined, handshake: ReturnType<typeof setTimeout> | undefined
  let retry: ReturnType<typeof setTimeout> | undefined, heartbeat: ReturnType<typeof setTimeout> | undefined, pong: ReturnType<typeof setTimeout> | undefined
  function clearTimers() {
    clearTimeout(slow); clearTimeout(handshake); clearTimeout(retry); clearTimeout(heartbeat); clearTimeout(pong)
    slow = handshake = retry = heartbeat = pong = undefined
  }
  function close() {
    const old = socket; socket = null; live = false; options.onSocket(null)
    if (!old) return
    old.onopen = old.onmessage = old.onerror = old.onclose = null
    if (old.readyState < 2) old.close(1000, 'client')
  }
  function scheduleRetry() {
    if (disposed) return
    clearTimers(); close()
    if (!online()) { options.onFailure('offline'); return }
    if (attempts >= 6) { options.onFailure('timeout'); return }
    options.onConnecting()
    retry = setTimeout(connect, Math.min(8000, 500 * 2 ** attempts++))
  }
  function ping() {
    if (disposed || !live || !socket || socket.readyState !== 1 || pong) return
    clearTimeout(heartbeat)
    socket.send('ping')
    pong = setTimeout(scheduleRetry, 8000)
  }
  function connect() {
    if (disposed) return
    clearTimers(); close()
    if (!online()) { options.onFailure('offline'); return }
    options.onConnecting()
    let next: WebSocket
    try { next = makeSocket(options.url) } catch { scheduleRetry(); return }
    socket = next; options.onSocket(next)
    slow = setTimeout(options.onSlow, 1000)
    handshake = setTimeout(scheduleRetry, 15000)
    next.onopen = () => { if (socket === next) options.onOpen(next) }
    next.onmessage = event => {
      if (socket !== next || disposed) return
      if (event.data === 'pong') {
        clearTimeout(pong); pong = undefined
        heartbeat = setTimeout(ping, 20000)
        return
      }
      let payload: Record<string, unknown>
      try { payload = JSON.parse(String(event.data)) } catch { return }
      if (!payload || typeof payload.type !== 'string') return
      if (payload.type === 'state') {
        clearTimeout(slow); clearTimeout(handshake)
        live = true; attempts = 0
        if (!heartbeat && !pong) heartbeat = setTimeout(ping, 20000)
      }
      if (payload.type === 'error') { terminal = true; clearTimers(); close() }
      options.onPayload(payload)
    }
    next.onerror = () => { /* Close or handshake timeout owns recovery. */ }
    next.onclose = event => {
      if (socket !== next || disposed) return
      if (event.code === 4001 || event.reason === 'replaced') {
        terminal = true; clearTimers(); close(); options.onFailure('replaced'); return
      }
      scheduleRetry()
    }
  }
  connect()
  return {
    resume() { if (disposed || terminal) return; if (live && socket?.readyState === 1) ping(); else { attempts = 0; connect() } },
    offline() { if (disposed || terminal) return; clearTimers(); close(); options.onFailure('offline') },
    dispose() { disposed = true; clearTimers(); close() },
  }
}
