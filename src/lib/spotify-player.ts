import { getValidAccessToken } from './spotify-auth'

interface SpotifyPlayer {
  connect: () => Promise<boolean>
  disconnect: () => void
  addListener: (event: string, cb: (payload: unknown) => void) => void
  removeListener: (event: string, cb: (payload: unknown) => void) => void
  getCurrentState: () => Promise<SpotifyPlaybackState | null>
  setVolume: (volume: number) => Promise<void>
  activateElement: () => Promise<void>
}

interface SpotifyPlaybackState {
  position: number
  paused: boolean
  track_window: {
    current_track: { uri: string } | null
  }
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

let sdkPromise: Promise<void> | null = null
let player: SpotifyPlayer | null = null
let deviceId: string | null = null
let readyPromise: Promise<void> | null = null

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
  if (player && deviceId) return player

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
  return player
}

async function apiPlay(trackId: string, positionMs: number) {
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
      body: JSON.stringify({
        uris: [`spotify:track:${trackId}`],
        position_ms: Math.max(0, Math.floor(positionMs)),
      }),
    },
  )

  if (response.status === 204 || response.ok) return

  if (response.status === 403) {
    throw new Error('Spotify Premium is required for full-song playback.')
  }

  const body = await response.text()
  throw new Error(body || `Spotify play failed (${response.status})`)
}

export async function initSpotifyPlayer(volume: number) {
  const instance = await ensurePlayer(volume)
  await instance.setVolume(volume)
  try {
    await instance.activateElement()
  } catch {
    // Optional in some browsers.
  }
  return instance
}

export async function playSpotifyTrack(trackId: string, positionMs: number, volume: number) {
  await initSpotifyPlayer(volume)
  await apiPlay(trackId, positionMs)
}

export async function pauseSpotifyPlayback() {
  if (!player) return
  const state = await player.getCurrentState()
  if (!state || state.paused) return

  const token = await getValidAccessToken()
  if (!token) return

  await fetch('https://api.spotify.com/v1/me/player/pause', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function getSpotifyPositionSeconds(): Promise<number> {
  if (!player) return 0
  const state = await player.getCurrentState()
  if (!state) return 0
  return state.position / 1000
}

export async function setSpotifyVolume(volume: number) {
  if (!player) return
  await player.setVolume(volume)
}

export function disconnectSpotifyPlayer() {
  player?.disconnect()
  player = null
  deviceId = null
  readyPromise = null
}
