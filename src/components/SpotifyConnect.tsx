interface SpotifyConnectProps {
  isConnected: boolean
  isPremium: boolean
  displayName?: string
  connecting: boolean
  authError: string | null
  onConnect: () => void
  onDisconnect: () => void
}

export function SpotifyConnect({
  isConnected,
  isPremium,
  displayName,
  connecting,
  authError,
  onConnect,
  onDisconnect,
}: SpotifyConnectProps) {
  return (
    <div className="spotify-connect">
      <p className="eyebrow">Spotify</p>
      {isConnected ? (
        <>
          <p className="spotify-status">
            Connected{displayName ? ` as ${displayName}` : ''}
            {!isPremium ? ' (Premium required)' : ''}
          </p>
          <button type="button" className="setting-value" onClick={onDisconnect}>
            Disconnect
          </button>
        </>
      ) : (
        <button
          type="button"
          className="setting-value spotify-connect-button active-setting"
          disabled={connecting}
          onClick={onConnect}
        >
          {connecting ? 'Redirecting…' : 'Connect Spotify'}
        </button>
      )}
      {authError && <p className="setting-note spotify-error">{authError}</p>}
      {!isConnected && (
        <p className="setting-note">
          Connect a Spotify Premium account to use From the start and Main hook with full songs.
          Without Spotify, only 30-second previews play.
        </p>
      )}
      {isConnected && !isPremium && (
        <p className="setting-note spotify-error">
          Spotify Premium is required for intro and hook playback. Previews will be used instead.
        </p>
      )}
    </div>
  )
}
