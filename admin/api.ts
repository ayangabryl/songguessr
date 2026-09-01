const ADMIN_BASE = window.location.hostname.startsWith('admin.')
  ? ''
  : '/admin'

export const API_BASE = `${ADMIN_BASE}/api`

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })

  if (response.status === 401) {
    throw new AuthError()
  }

  const data = (await response.json().catch(() => ({}))) as T & { error?: string }
  if (!response.ok) {
    throw new Error(data.error ?? `Request failed (${response.status})`)
  }
  return data
}

export class AuthError extends Error {
  constructor() {
    super('Unauthorized')
    this.name = 'AuthError'
  }
}

export interface StatusResponse {
  ok: boolean
  health: string
  tracks: number
  catalogCap: number
  updatedAt: string | null
  r2UpdatedAt: string | null
  artistsDone: number
  artistsTotal: number
  playlistSyncedAt: string | null
  genreSyncedAt: string | null
  genreSource: string | null
  genrePlaylistCursor: number
  cronSchedule: string
  cronDescription: string
  nextCronEstimate: string
  catalogError: string | null
}

export interface CatalogTrack {
  id: string
  title: string
  artist: string
  difficulty: string
  releaseYear?: number
  albumArt: string
  hasPreview: boolean
}

export interface CatalogResponse {
  tracks: CatalogTrack[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface SpotifySearchResult {
  id?: string
  title: string
  artist: string
  albumArt: string
  previewUrl: string | null
  isOpm: boolean
  inCatalog: boolean
}

export async function login(password: string): Promise<void> {
  await request('/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  })
}

export async function logout(): Promise<void> {
  await request('/logout', { method: 'POST' })
}

export async function fetchStatus(): Promise<StatusResponse> {
  return request<StatusResponse>('/status')
}

export async function fetchCatalog(page: number, query: string): Promise<CatalogResponse> {
  const params = new URLSearchParams({ page: String(page), pageSize: '50' })
  if (query.trim()) params.set('q', query.trim())
  return request<CatalogResponse>(`/catalog?${params}`)
}

export async function searchSpotify(query: string): Promise<SpotifySearchResult[]> {
  const params = new URLSearchParams({ q: query })
  const data = await request<{ results: SpotifySearchResult[] }>(`/spotify/search?${params}`)
  return data.results
}

export async function addTrack(trackId: string): Promise<void> {
  await request('/catalog/add', {
    method: 'POST',
    body: JSON.stringify({ trackId }),
  })
}

export async function removeTrack(trackId: string): Promise<void> {
  await request(`/catalog/${trackId}`, { method: 'DELETE' })
}
