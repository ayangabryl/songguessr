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

let sdkPromise: Promise<void> | null = null
let player: SpotifyPlayer | null = null
let deviceId: string | null = null
let readyPromise: Promise<void> | null = null
let lastVolume = 1
let lastState: SpotifyPlaybackState | null = null
let lastTrackId: string | null = null
let deviceTransferred = false
let playerWarmedUp = false
const stateListeners = new Set<StateChangeCallback>()

function notifyStateListeners(state: SpotifyPlaybackState | null) {
  lastState = state
  for (const listener of stateListeners) {
    listener(state)
  }
}

function resetPlayerSessionState() {
  lastTrackId = null
  deviceTransferred = false
  playerWarmedUp = false
}

export function extrapolatePositionMs(state: SpotifyPlaybackState): number {
  if (state.paused) return state.position
  return state.position + Math.max(0, Date.now() - state.timestamp)
}

export function onSpotifyStateChange(callback: StateChangeCallback): () => void {
  stateListeners.add(callback)
  callback(lastState)
  return () => {
    stateListeners.delete(callback)
  }
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
  if (lastTrackId !== trackId || !isSpotifyPlayerReady()) return false
  const uri = lastState?.track_window.current_track?.uri
  if (!uri) return true
  return uri === `spotify:track:${trackId}`
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
        name: 'OPM Songgussr',
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
        notifyStateListeners(payload as SpotifyPlaybackState | null)
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
  const token = await getValidAccessToken()
  if (!token || !deviceId) return

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

  if (response.status === 204 || response.ok) {
    deviceTransferred = true
    return
  }
  if (response.status === 404) {
    deviceTransferred = true
    return
  }
}

async function apiSeek(positionMs: number): Promise<void> {
  const token = await getValidAccessToken()
  if (!token || !deviceId) throw new Error('Spotify player not ready')

  const response = await fetch(
    `https://api.spotify.com/v1/me/player/seek?position_ms=${Math.floor(Math.max(0, positionMs))}&device_id=${encodeURIComponent(deviceId)}`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    },
  )

  if (response.status === 204 || response.ok || response.status === 404) return
  const body = await response.text()
  throw new Error(body || `Spotify seek failed (${response.status})`)
}

async function apiResume(): Promise<void> {
  const token = await getValidAccessToken()
  if (!token || !deviceId) throw new Error('Spotify player not ready')

  const response = await fetch(
    `https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(deviceId)}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    },
  )

  if (response.status === 204 || response.ok) return
  if (response.status === 403) {
    throw new Error('Spotify Premium is required for full-song playback.')
  }
  const body = await response.text()
  throw new Error(body || `Spotify resume failed (${response.status})`)
}

async function apiPlay(trackId: string, positionMs: number, options?: { transfer?: boolean }) {
  const token = await getValidAccessToken()
  if (!token || !deviceId) throw new Error('Spotify player not ready')

  if (options?.transfer !== false && !deviceTransferred) {
    await transferPlaybackToDevice()
  }

  const response = await fetch(
    `https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(deviceId)}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uris: [`spotify:track:${trackId}`],
        position_ms: Math.max(0, Math.floor(positionMs)),
      }),
    },
  )

  if (response.status === 204 || response.ok) {
    lastTrackId = trackId
    return
  }

  if (response.status === 403) {
    throw new Error('Spotify Premium is required for full-song playback.')
  }

  const body = await response.text()
  throw new Error(body || `Spotify play failed (${response.status})`)
}

async function resumeSpotifyTrack(positionMs: number, volume: number): Promise<void> {
  const instance = await ensurePlayer(volume)
  try {
    await instance.activateElement()
  } catch {
    // Optional in some browsers.
  }
  await apiSeek(positionMs)
  await apiResume()
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
  try {
    await instance.activateElement()
  } catch {
    // Optional in some browsers.
  }
  playerWarmedUp = true
}

export async function initSpotifyPlayer(volume: number) {
  await warmupSpotifyPlayer(volume)
  if (!player) throw new Error('Spotify player failed to initialize')
  return player
}

export async function preloadSpotifyTrack(trackId: string, positionMs: number, volume: number) {
  await warmupSpotifyPlayer(volume)
  if (isSameSpotifyTrackLoaded(trackId)) {
    await apiSeek(positionMs)
    return
  }

  await apiPlay(trackId, positionMs, { transfer: false })
  await restPause(positionMs)
  lastTrackId = trackId
}

async function waitForSpotifyPlaybackStarted(timeoutMs = 5000): Promise<void> {
  if (!player) throw new Error('Spotify player not ready')

  if (lastState && !lastState.paused) return

  const initial = await player.getCurrentState()
  if (initial) notifyStateListeners(initial)
  if (initial && !initial.paused) return

  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (lastState && !lastState.paused) return
    const state = await player.getCurrentState()
    if (state) notifyStateListeners(state)
    if (state && !state.paused) return
    await new Promise((resolve) => setTimeout(resolve, 30))
  }

  throw new Error('Spotify playback did not start in time')
}

export async function playSpotifyTrack(
  trackId: string,
  positionMs: number,
  volume: number,
  options: PlaySpotifyOptions = {},
) {
  const waitForStart = options.waitForStart ?? true
  const canResume = isSameSpotifyTrackLoaded(trackId)

  if (canResume) {
    await resumeSpotifyTrack(positionMs, volume)
    if (waitForStart) {
      await waitForSpotifyPlaybackStarted(800)
    }
  } else {
    await warmupSpotifyPlayer(volume)
    await apiPlay(trackId, positionMs, { transfer: !deviceTransferred })
    if (waitForStart) {
      await waitForSpotifyPlaybackStarted(3000)
    }
  }

  if (player) {
    const state = await player.getCurrentState()
    if (state) notifyStateListeners(state)
  }
}

async function restPause(positionMs?: number): Promise<void> {
  const token = await getValidAccessToken()
  if (!token) return

  const attempts = [
    'https://api.spotify.com/v1/me/player/pause',
    ...(deviceId
      ? [`https://api.spotify.com/v1/me/player/pause?device_id=${encodeURIComponent(deviceId)}`]
      : []),
  ]

  for (const url of attempts) {
    const response = await fetch(url, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (response.status === 204 || response.ok || response.status === 404) break
  }

  if (positionMs !== undefined && deviceId) {
    await fetch(
      `https://api.spotify.com/v1/me/player/seek?position_ms=${Math.floor(positionMs)}&device_id=${encodeURIComponent(deviceId)}`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      },
    )
  }
}

export async function pauseSpotifyPlayback() {
  let positionMs: number | undefined

  if (player) {
    try {
      const state = await player.getCurrentState()
      if (state) {
        positionMs = extrapolatePositionMs(state)
      }
    } catch {
      if (lastState) {
        positionMs = extrapolatePositionMs(lastState)
      }
    }

    try {
      await player.pause()
    } catch {
      // Fall through to additional pause strategies.
    }
  } else if (lastState) {
    positionMs = extrapolatePositionMs(lastState)
  }

  let paused = lastState?.paused ?? false
  if (player) {
    try {
      const state = await player.getCurrentState()
      if (state) {
        notifyStateListeners(state)
        paused = state.paused
        if (positionMs === undefined) {
          positionMs = extrapolatePositionMs(state)
        }
      }
    } catch {
      // Continue with fallback strategies.
    }
  }

  if (!paused) {
    if (player) {
      try {
        await player.setVolume(0)
      } catch {
        // Mute fallback is best-effort.
      }
    }

    await restPause(positionMs)

    if (player) {
      try {
        const state = await player.getCurrentState()
        if (state) {
          notifyStateListeners(state)
          paused = state.paused
        }
      } catch {
        // Best-effort state refresh.
      }
    }
  } else if (positionMs !== undefined) {
    await restPause(positionMs)
  }

  if (player && paused) {
    try {
      await player.setVolume(lastVolume)
    } catch {
      // Volume restore is best-effort; next play sets it again.
    }
  }

  if (paused && lastState) {
    notifyStateListeners({
      ...lastState,
      paused: true,
      position: positionMs ?? lastState.position,
    })
  }
}

export async function getSpotifyPositionSeconds(): Promise<number> {
  if (!player) return 0
  const state = await player.getCurrentState()
  if (!state) return 0
  notifyStateListeners(state)
  return extrapolatePositionMs(state) / 1000
}

export async function setSpotifyVolume(volume: number) {
  lastVolume = volume
  if (!player) return
  await player.setVolume(volume)
}

export function disconnectSpotifyPlayer() {
  player?.disconnect()
  player = null
  deviceId = null
  readyPromise = null
  lastState = null
  resetPlayerSessionState()
}
