import { observePauseLatency } from './clip-timer'
import { getValidAccessToken } from './spotify-auth'

export interface SpotifyPlaybackState {
  position: number
  paused: boolean
  timestamp: number
  track_window: {
    current_track: { uri: string } | null
  }
}

interface SpotifyPlayer {
  connect: () => Promise<boolean>
  disconnect: () => void
  addListener: (event: string, cb: (payload: unknown) => void) => void
  removeListener: (event: string, cb: (payload: unknown) => void) => void
  getCurrentState: () => Promise<SpotifyPlaybackState | null>
  setVolume: (volume: number) => Promise<void>
  activateElement: () => Promise<void>
  pause: () => Promise<void>
  resume: () => Promise<void>
  togglePlay: () => Promise<void>
  seek: (position_ms: number) => Promise<void>
}

declare global {
  interface Window {
    Spotify?: {
      Player: new (options: {
        name: string
        getOAuthToken: (cb: (token: string) => void) => void
        volume: number
      }) => SpotifyPlayer
    }
    onSpotifyWebPlaybackSDKReady?: () => void
  }
}

type StateChangeCallback = (state: SpotifyPlaybackState | null) => void

export interface PlaySpotifyOptions {
  waitForStart?: boolean
}

export interface PlaySpotifyResult {
  started: boolean
  replayed: boolean
  playIssuedAt: number
  confirmedAt: number
}

let sdkPromise: Promise<void> | null = null
let player: SpotifyPlayer | null = null
let deviceId: string | null = null
let readyPromise: Promise<void> | null = null
let lastVolume = 1
let lastState: SpotifyPlaybackState | null = null
let lastPlayedTrackId: string | null = null
let deviceTransferred = false
let playerWarmedUp = false
let haltMuted = false
let cachedAccessToken: string | null = null
let cachedAccessTokenAt = 0
const stateListeners = new Set<StateChangeCallback>()

function notifyStateListeners(state: SpotifyPlaybackState | null) {
  lastState = state
  for (const listener of stateListeners) {
    listener(state)
  }
}

function subscribeState(callback: StateChangeCallback): () => void {
  stateListeners.add(callback)
  return () => {
    stateListeners.delete(callback)
  }
}

function resetPlayerSessionState() {
  lastPlayedTrackId = null
  deviceTransferred = false
  playerWarmedUp = false
}

function trackUri(trackId: string): string {
  return `spotify:track:${trackId}`
}

export function extrapolatePositionMs(state: SpotifyPlaybackState): number {
  if (state.paused) return state.position
  return state.position + Math.max(0, Date.now() - state.timestamp)
}

export function onSpotifyStateChange(callback: StateChangeCallback): () => void {
  const unsubscribe = subscribeState(callback)
  callback(lastState)
  return unsubscribe
}

export function isSpotifyPlaying(): boolean {
  return Boolean(lastState && !lastState.paused)
}

export function getSpotifyExtrapolatedPositionMs(): number {
  if (!lastState) return 0
  return extrapolatePositionMs(lastState)
}

export function getSpotifyDeviceId(): string | null {
  return deviceId
}

export function isSpotifyPlayerReady(): boolean {
  return Boolean(player && deviceId)
}

export function isSameSpotifyTrackLoaded(trackId: string): boolean {
  if (lastPlayedTrackId !== trackId || !isSpotifyPlayerReady()) return false
  const uri = lastState?.track_window.current_track?.uri
  if (!uri) return true
  return uri === trackUri(trackId)
}

function loadSdk(): Promise<void> {
  if (window.Spotify) return Promise.resolve()
  if (sdkPromise) return sdkPromise

  sdkPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-spotify-sdk]')
    if (existing) {
      window.onSpotifyWebPlaybackSDKReady = () => resolve()
      return
    }

    const script = document.createElement('script')
    script.src = 'https://sdk.scdn.co/spotify-player.js'
    script.async = true
    script.dataset.spotifySdk = 'true'
    script.onerror = () => reject(new Error('Could not load Spotify player SDK'))
    window.onSpotifyWebPlaybackSDKReady = () => resolve()
    document.body.appendChild(script)
  })

  return sdkPromise
}

async function ensurePlayer(volume: number): Promise<SpotifyPlayer> {
  await loadSdk()
  if (player && deviceId) {
    if (volume !== lastVolume) {
      lastVolume = volume
      try {
        await player.setVolume(volume)
      } catch {
        // Volume update is best-effort on warm player.
      }
    }
    return player
  }

  if (!readyPromise) {
    readyPromise = new Promise((resolve, reject) => {
      const tokenGetter = async (callback: (token: string) => void) => {
        const token = await getValidAccessToken()
        if (!token) throw new Error('Spotify session expired')
        callback(token)
      }

      const instance = new window.Spotify!.Player({
        name: 'SongGuessr',
        getOAuthToken: (cb) => {
          void tokenGetter(cb).catch(reject)
        },
        volume,
      })

      instance.addListener('ready', (payload) => {
        const { device_id } = payload as { device_id: string }
        deviceId = device_id
        player = instance
        resolve()
      })

      instance.addListener('player_state_changed', (payload) => {
        const state = payload as SpotifyPlaybackState | null
        if (!state) {
          if (lastState && !lastState.paused) {
            notifyStateListeners({
              ...lastState,
              paused: true,
              timestamp: Date.now(),
            })
          }
          return
        }
        notifyStateListeners(state)
      })

      instance.addListener('authentication_error', (payload) => {
        const { message } = payload as { message: string }
        reject(new Error(message))
      })

      instance.addListener('account_error', (payload) => {
        const { message } = payload as { message: string }
        reject(new Error(message))
      })

      void instance.connect()
    })
  }

  await readyPromise
  if (!player) throw new Error('Spotify player failed to initialize')
  lastVolume = volume
  return player
}

async function transferPlaybackToDevice(): Promise<void> {
  if (deviceTransferred || !deviceId) return

  const token = await playerAccessToken()
  if (!token) return

  const response = await fetch('https://api.spotify.com/v1/me/player', {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      device_ids: [deviceId],
      play: false,
    }),
  })

  if (response.status === 204 || response.ok || response.status === 404) {
    deviceTransferred = true
  }
}

async function playerAccessToken(): Promise<string | null> {
  if (cachedAccessToken && Date.now() - cachedAccessTokenAt < 30_000) {
    return cachedAccessToken
  }
  const token = await getValidAccessToken()
  cachedAccessToken = token
  cachedAccessTokenAt = Date.now()
  return token
}

async function apiPlay(trackId: string, positionMs: number) {
  const token = await playerAccessToken()
  if (!token || !deviceId) throw new Error('Spotify player not ready')

  if (!deviceTransferred) {
    await transferPlaybackToDevice()
  }

  const playOnce = () =>
    fetch(`https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(deviceId!)}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uris: [trackUri(trackId)],
        position_ms: Math.max(0, Math.floor(positionMs)),
      }),
    })

  let response = await playOnce()

  if (response.status === 404) {
    deviceTransferred = false
    await transferPlaybackToDevice()
    response = await playOnce()
  }

  if (response.status === 204 || response.ok) {
    lastPlayedTrackId = trackId
    return
  }

  if (response.status === 429) {
    throw new Error('Spotify is busy. Try again in a moment.')
  }

  if (response.status === 403) {
    throw new Error('Spotify Premium is required for full-song playback.')
  }

  const body = await response.text()
  throw new Error(body || `Spotify play failed (${response.status})`)
}

async function activatePlayer(instance: SpotifyPlayer): Promise<void> {
  try {
    await instance.activateElement()
  } catch {
    // Optional in some browsers.
  }
}

const FIRST_PLAY_WAIT_MS = 2500
const REPLAY_WAIT_MS = 1200
const PLAYING_POLL_MS = 16

function stateMatchesTrack(state: SpotifyPlaybackState, trackId: string): boolean {
  const uri = state.track_window.current_track?.uri
  if (!uri) return true
  return uri === trackUri(trackId)
}

function isActivelyPlaying(state: SpotifyPlaybackState | null, trackId: string): boolean {
  return Boolean(state && !state.paused && stateMatchesTrack(state, trackId))
}

async function restorePlaybackVolume(volume: number): Promise<void> {
  lastVolume = volume
  if (!player || haltMuted) return
  try {
    await player.setVolume(volume)
  } catch {
    // Volume restore is best-effort; playback should still start.
  }
}

/** Resolve on first `paused === false` for this track. Timeout means start was not confirmed. */
async function waitUntilPlaying(trackId: string, timeoutMs: number): Promise<boolean> {
  if (isActivelyPlaying(lastState, trackId)) return true

  if (player) {
    try {
      const state = await player.getCurrentState()
      if (state) {
        notifyStateListeners(state)
        if (isActivelyPlaying(state, trackId)) return true
      }
    } catch {
      // SDK state read is best-effort.
    }
  }

  return await new Promise<boolean>((resolve) => {
    let settled = false

    const finish = (started: boolean) => {
      if (settled) return
      settled = true
      window.clearTimeout(timeoutId)
      window.clearInterval(pollId)
      unsubscribe()
      resolve(started)
    }

    const unsubscribe = subscribeState((state) => {
      if (isActivelyPlaying(state, trackId)) finish(true)
    })

    const pollId = window.setInterval(() => {
      if (!player || settled) return
      void player
        .getCurrentState()
        .then((state) => {
          if (!state || settled) return
          notifyStateListeners(state)
          if (isActivelyPlaying(state, trackId)) finish(true)
        })
        .catch(() => {
          // Poll is best-effort.
        })
    }, PLAYING_POLL_MS)

    const timeoutId = window.setTimeout(() => {
      finish(false)
    }, timeoutMs)
  })
}

async function resumeLoadedTrack(positionMs: number): Promise<void> {
  if (!player) throw new Error('Spotify player not ready')
  await player.seek(Math.floor(Math.max(0, positionMs)))
  await player.resume()
}

export async function warmupSpotifyPlayer(volume: number): Promise<void> {
  if (playerWarmedUp && player && deviceId) {
    if (volume !== lastVolume) {
      lastVolume = volume
      try {
        await player.setVolume(volume)
      } catch {
        // Volume update is best-effort on warm player.
      }
    }
    return
  }

  lastVolume = volume
  const instance = await ensurePlayer(volume)
  if (!deviceTransferred) {
    await transferPlaybackToDevice()
  }
  await activatePlayer(instance)
  playerWarmedUp = true
}

export async function initSpotifyPlayer(volume: number) {
  await warmupSpotifyPlayer(volume)
  if (!player) throw new Error('Spotify player failed to initialize')
  return player
}

export async function preloadSpotifyTrack(trackId: string, positionMs: number, volume: number) {
  await warmupSpotifyPlayer(volume)
  if (!isSameSpotifyTrackLoaded(trackId) || !player) return

  try {
    await player.seek(Math.floor(Math.max(0, positionMs)))
  } catch {
    // Preload seek is best-effort; play will seek on demand.
  }
}

export async function activateSpotifyElement(): Promise<void> {
  if (!player) return
  await activatePlayer(player)
}

export async function playSpotifyTrack(
  trackId: string,
  positionMs: number,
  volume: number,
  options: PlaySpotifyOptions = {},
): Promise<PlaySpotifyResult> {
  const waitForStart = options.waitForStart ?? true
  const playIssuedAt = performance.now()

  // Activate on the user gesture before any other player work.
  if (player) {
    await activatePlayer(player)
  } else {
    const instance = await ensurePlayer(volume)
    await activatePlayer(instance)
  }

  if (volume !== lastVolume || haltMuted) {
    haltMuted = false
    void restorePlaybackVolume(volume)
  }

  const canResume = isSameSpotifyTrackLoaded(trackId)

  if (canResume) {
    try {
      await resumeLoadedTrack(positionMs)
      if (!waitForStart) {
        return { started: true, replayed: true, playIssuedAt, confirmedAt: performance.now() }
      }
      const started = await waitUntilPlaying(trackId, REPLAY_WAIT_MS)
      return { started, replayed: true, playIssuedAt, confirmedAt: performance.now() }
    } catch {
      lastPlayedTrackId = null
    }
  }

  if (!playerWarmedUp) {
    await warmupSpotifyPlayer(volume)
  }
  await apiPlay(trackId, positionMs)
  if (!waitForStart) {
    return { started: true, replayed: false, playIssuedAt, confirmedAt: performance.now() }
  }
  const started = await waitUntilPlaying(trackId, FIRST_PLAY_WAIT_MS)
  return { started, replayed: false, playIssuedAt, confirmedAt: performance.now() }
}

export async function pauseSpotifyPlayback() {
  const pauseStartedAt = performance.now()
  const freezeAtMs = lastState ? extrapolatePositionMs(lastState) : undefined
  const volumeToRestore = lastVolume

  if (!player) {
    if (lastState && !lastState.paused) {
      notifyStateListeners({
        ...lastState,
        paused: true,
        timestamp: Date.now(),
      })
    }
    return
  }

  haltMuted = true
  try {
    void player.setVolume(0)
  } catch {
    // Mute is the audible stop while SDK pause catches up.
  }

  try {
    await player.pause()
  } catch {
    // SDK pause is the only pause path.
  }

  observePauseLatency('spotify', performance.now() - pauseStartedAt)

  if (lastState) {
    notifyStateListeners({
      ...lastState,
      paused: true,
      position: freezeAtMs ?? lastState.position,
      timestamp: Date.now(),
    })
  }

  if (freezeAtMs !== undefined) {
    void player.seek(Math.floor(Math.max(0, freezeAtMs))).catch(() => {
      // Freeze seek is best-effort after pause.
    })
  }

  haltMuted = false
  void player.setVolume(volumeToRestore).catch(() => {
    // Volume restore is best-effort after halt.
  })
}

export async function getSpotifyPositionSeconds(): Promise<number> {
  if (lastState) return extrapolatePositionMs(lastState) / 1000
  if (!player) return 0
  const state = await player.getCurrentState()
  if (!state) return 0
  notifyStateListeners(state)
  return extrapolatePositionMs(state) / 1000
}

export async function setSpotifyVolume(volume: number) {
  lastVolume = volume
  if (!player || haltMuted) return
  await player.setVolume(volume)
}

export function disconnectSpotifyPlayer() {
  player?.disconnect()
  player = null
  deviceId = null
  readyPromise = null
  lastState = null
  cachedAccessToken = null
  cachedAccessTokenAt = 0
  haltMuted = false
  resetPlayerSessionState()
}
