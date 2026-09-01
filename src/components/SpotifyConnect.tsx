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
        <p className="setting-note">Premium required for full tracks; otherwise 30s previews.</p>
      )}
      {isConnected && !isPremium && (
        <p className="setting-note spotify-error">Upgrade to Premium for full tracks.</p>
      )}
    </div>
  )
}
