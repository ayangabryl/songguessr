import { useCallback, useEffect, useState } from 'react'
import {
  addTrack,
  AuthError,
  fetchCatalog,
  fetchStatus,
  login,
  logout,
  removeTrack,
  searchSpotify,
  type CatalogTrack,
  type SpotifySearchResult,
  type StatusResponse,
} from './api'

type Tab = 'dashboard' | 'catalog' | 'add'

function formatDate(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function formatNumber(value: number): string {
  return value.toLocaleString()
}

function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await login(password)
      onLogin()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>Songgussr Admin</h1>
        <p>Sign in to manage the OPM catalog and monitor cron health.</p>
        {error ? <div className="error-banner">{error}</div> : null}
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
        />
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}

function DashboardPanel({ status }: { status: StatusResponse | null }) {
  if (!status) {
    return <div className="empty-state">Loading status…</div>
  }

  const artistPct = status.artistsTotal
    ? Math.round((status.artistsDone / status.artistsTotal) * 100)
    : 0
  const catalogPct = Math.round((status.tracks / status.catalogCap) * 100)

  return (
    <>
      <h2 className="section-title">Dashboard</h2>
      <div className="card-grid">
        <div className="stat-card">
          <div className="stat-label">Catalog tracks</div>
          <div className="stat-value">{formatNumber(status.tracks)}</div>
          <div className="stat-meta">
            {catalogPct}% of {formatNumber(status.catalogCap)} cap
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Artist progress</div>
          <div className="stat-value">{artistPct}%</div>
          <div className="stat-meta">
            {status.artistsDone} / {status.artistsTotal} artists
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Health</div>
          <div className="stat-value" style={{ fontSize: 22 }}>
            <span className={`badge ${status.ok ? 'ok' : 'warn'}`}>
              {status.health}
            </span>
          </div>
          <div className="stat-meta">R2 catalog source of truth</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Next cron run</div>
          <div className="stat-value" style={{ fontSize: 18 }}>
            {formatDate(status.nextCronEstimate)}
          </div>
          <div className="stat-meta">{status.cronDescription}</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h3>System status</h3>
        </div>
        <dl className="status-list">
          <div className="status-row">
            <dt>Catalog updated</dt>
            <dd>{formatDate(status.updatedAt)}</dd>
          </div>
          <div className="status-row">
            <dt>R2 object updated</dt>
            <dd>{formatDate(status.r2UpdatedAt)}</dd>
          </div>
          <div className="status-row">
            <dt>Genre ingest</dt>
            <dd>
              {formatDate(status.genreSyncedAt)}
              {status.genreSource ? ` · ${status.genreSource}` : ''}
            </dd>
          </div>
          <div className="status-row">
            <dt>Playlist synced</dt>
            <dd>{formatDate(status.playlistSyncedAt)}</dd>
          </div>
          <div className="status-row">
            <dt>Cron schedule</dt>
            <dd className="mono">{status.cronSchedule}</dd>
          </div>
          {status.catalogError ? (
            <div className="status-row">
              <dt>Catalog error</dt>
              <dd style={{ color: 'var(--danger)' }}>{status.catalogError}</dd>
            </div>
          ) : null}
        </dl>
      </div>
    </>
  )
}

function CatalogPanel() {
  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [tracks, setTracks] = useState<CatalogTrack[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchCatalog(page, query)
      setTracks(data.tracks)
      setTotal(data.total)
      setTotalPages(data.totalPages)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load catalog')
    } finally {
      setLoading(false)
    }
  }, [page, query])

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault()
    setQuery(input.trim())
    setPage(1)
  }

  useEffect(() => {
    void load()
  }, [load])

  const handleRemove = async (trackId: string) => {
    if (!window.confirm('Remove this track from the catalog?')) return
    setRemovingId(trackId)
    try {
      await removeTrack(trackId)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove track')
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <>
      <h2 className="section-title">Catalog</h2>
      <div className="panel">
        <div className="panel-header">
          <h3>{formatNumber(total)} tracks</h3>
          <form onSubmit={handleSearch}>
            <input
              className="search-input"
              type="search"
              placeholder="Search title, artist, or ID…"
              value={input}
              onChange={(event) => setInput(event.target.value)}
            />
          </form>
        </div>

        {error ? <div className="error-banner">{error}</div> : null}

        {loading ? (
          <div className="empty-state">Loading catalog…</div>
        ) : tracks.length === 0 ? (
          <div className="empty-state">No tracks match your search.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Track</th>
                <th>Artist</th>
                <th>Difficulty</th>
                <th>ID</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {tracks.map((track) => (
                <tr key={track.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {track.albumArt ? (
                        <img className="track-row-art" src={track.albumArt} alt="" />
                      ) : (
                        <div className="track-row-art" />
                      )}
                      <span>{track.title}</span>
                    </div>
                  </td>
                  <td>{track.artist}</td>
                  <td>
                    <span className="badge">{track.difficulty}</span>
                  </td>
                  <td className="mono">{track.id}</td>
                  <td>
                    <button
                      className="btn btn-danger"
                      type="button"
                      disabled={removingId === track.id}
                      onClick={() => void handleRemove(track.id)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="pagination">
          <span>
            Page {page} of {totalPages}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn"
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((value) => value - 1)}
            >
              Previous
            </button>
            <button
              className="btn"
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((value) => value + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

function AddSongsPanel() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SpotifySearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [addingId, setAddingId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const handleSearch = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!query.trim()) return

    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      const items = await searchSpotify(query)
      setResults(items)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async (track: SpotifySearchResult) => {
    if (!track.id) return
    setAddingId(track.id)
    setError(null)
    setMessage(null)
    try {
      await addTrack(track.id)
      setMessage(`Added “${track.title}” to catalog.`)
      setResults((current) =>
        current.map((item) => (item.id === track.id ? { ...item, inCatalog: true } : item)),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add track')
    } finally {
      setAddingId(null)
    }
  }

  return (
    <>
      <h2 className="section-title">Add songs</h2>
      <div className="panel">
        <div className="panel-header">
          <h3>Spotify search</h3>
          <form onSubmit={handleSearch}>
            <input
              className="search-input"
              type="search"
              placeholder="Search Spotify for OPM tracks…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </form>
        </div>

        {error ? <div className="error-banner">{error}</div> : null}
        {message ? (
          <div className="error-banner" style={{ color: 'var(--success)', borderColor: 'color-mix(in srgb, var(--success) 30%, var(--border))', background: 'color-mix(in srgb, var(--success) 8%, var(--bg-elevated))' }}>
            {message}
          </div>
        ) : null}

        {loading ? (
          <div className="empty-state">Searching Spotify…</div>
        ) : results.length === 0 ? (
          <div className="empty-state">Search for a song to add it to the catalog.</div>
        ) : (
          <div className="spotify-results">
            {results.map((track) => (
              <div className="spotify-result" key={track.id ?? `${track.title}-${track.artist}`}>
                {track.albumArt ? (
                  <img className="track-row-art" src={track.albumArt} alt="" />
                ) : (
                  <div className="track-row-art" />
                )}
                <div className="spotify-result-info">
                  <strong>{track.title}</strong>
                  <span>{track.artist}</span>
                </div>
                <div className="spotify-result-actions">
                  {track.isOpm ? (
                    <span className="badge ok">OPM</span>
                  ) : (
                    <span className="badge warn">Not OPM</span>
                  )}
                  {track.inCatalog ? (
                    <span className="badge muted">In catalog</span>
                  ) : (
                    <button
                      className="btn btn-primary"
                      type="button"
                      disabled={!track.isOpm || !track.id || addingId === track.id}
                      onClick={() => void handleAdd(track)}
                    >
                      {addingId === track.id ? 'Adding…' : 'Add to catalog'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

export function AdminApp() {
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [tab, setTab] = useState<Tab>('dashboard')
  const [status, setStatus] = useState<StatusResponse | null>(null)

  const checkAuth = useCallback(async () => {
    try {
      const data = await fetchStatus()
      setStatus(data)
      setAuthed(true)
    } catch (err) {
      if (err instanceof AuthError) {
        setAuthed(false)
      } else {
        setAuthed(false)
      }
    }
  }, [])

  useEffect(() => {
    void checkAuth()
  }, [checkAuth])

  useEffect(() => {
    if (!authed) return
    if (tab !== 'dashboard') return

    const interval = window.setInterval(() => {
      void fetchStatus().then(setStatus).catch(() => undefined)
    }, 30_000)

    return () => window.clearInterval(interval)
  }, [authed, tab])

  const handleLogout = async () => {
    await logout().catch(() => undefined)
    setAuthed(false)
    setStatus(null)
  }

  if (authed === null) {
    return <div className="login-screen"><div className="empty-state">Loading…</div></div>
  }

  if (!authed) {
    return <LoginScreen onLogin={() => void checkAuth()} />
  }

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div className="admin-brand">
          <h1>Songgussr</h1>
          <p>Catalog administration</p>
        </div>
        <nav className="admin-nav">
          <button
            className={`nav-btn ${tab === 'dashboard' ? 'active' : ''}`}
            type="button"
            onClick={() => setTab('dashboard')}
          >
            Dashboard
          </button>
          <button
            className={`nav-btn ${tab === 'catalog' ? 'active' : ''}`}
            type="button"
            onClick={() => setTab('catalog')}
          >
            Catalog
          </button>
          <button
            className={`nav-btn ${tab === 'add' ? 'active' : ''}`}
            type="button"
            onClick={() => setTab('add')}
          >
            Add songs
          </button>
          <button className="nav-btn" type="button" onClick={() => void handleLogout()}>
            Sign out
          </button>
        </nav>
      </header>

      <main className="admin-main">
        {tab === 'dashboard' ? <DashboardPanel status={status} /> : null}
        {tab === 'catalog' ? <CatalogPanel /> : null}
        {tab === 'add' ? <AddSongsPanel /> : null}
      </main>
    </div>
  )
}
