import { useCallback, useEffect, useState } from 'react'
import {
  buildAuthorizeUrl,
  clearSpotifySession,
  fetchSpotifyConfig,
  handleSpotifyOAuthCallback,
  loadSpotifySession,
  type SpotifySession,
} from '../lib/spotify-auth'
import { disconnectSpotifyPlayer, warmupSpotifyPlayer } from '../lib/spotify-player'

export function useSpotify() {
  const [session, setSession] = useState<SpotifySession | null>(() => loadSpotifySession())
  const [authError, setAuthError] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)

  useEffect(() => {
    void handleSpotifyOAuthCallback()
      .then((nextSession) => {
        if (nextSession) {
          setSession(nextSession)
          setAuthError(null)
        }
      })
      .catch((error: unknown) => {
        setAuthError(error instanceof Error ? error.message : 'Spotify login failed')
      })
  }, [])

  useEffect(() => {
    if (!session?.isPremium) return
    void warmupSpotifyPlayer(1).catch(() => {
      // Warm-up is best-effort; play will retry initialization.
    })
  }, [session?.isPremium])

  const connect = useCallback(async () => {
    setConnecting(true)
    setAuthError(null)
    try {
      const { clientId } = await fetchSpotifyConfig()
      const url = await buildAuthorizeUrl(clientId)
      window.location.assign(url)
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Could not start Spotify login')
      setConnecting(false)
    }
  }, [])

  const disconnect = useCallback(() => {
    clearSpotifySession()
    disconnectSpotifyPlayer()
    setSession(null)
    setAuthError(null)
  }, [])

  const canUseStartModes = Boolean(session?.isPremium)

  return {
    session,
    isConnected: Boolean(session),
    isPremium: Boolean(session?.isPremium),
    canUseStartModes,
    connect,
    disconnect,
    authError,
    connecting,
    setSession,
  }
}
