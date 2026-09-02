const ADMIN_BASE = window.location.hostname.startsWith('admin.') ? '' : '/admin'

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
  source?: string
  spotifySyncedAt?: string | null
}

export interface CatalogTrack {
  id: string
  title: string
  artist: string
  difficulty: string
  releaseYear?: number
  releaseDate?: string
  genreGroups?: string[]
  spotifyGenres?: string[]
  era?: string | null
  albumArt: string
  hasPreview: boolean
  popularity?: number
  country?: string
  catalog?: string
}

export interface CatalogCounts {
  difficulty: Record<string, number>
  genre: Record<string, number>
  era: Record<string, number>
  country?: Record<string, number>
  missingPreview: number
}

export interface CatalogFilters {
  difficulty?: string
  genre?: string
  era?: string
  country?: string
  missingPreview?: boolean
}

export interface CatalogResponse {
  tracks: CatalogTrack[]
  page: number
  pageSize: number
  total: number
  totalPages: number
  counts: CatalogCounts
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

export interface CronTriggerResponse {
  ok: boolean
  message: string
  skipped?: boolean
  reason?: string
  tracksAdded: number
  totalTracks?: number
  tracks?: number
  rateLimited: boolean
  errors: string[]
  playlistsProcessed?: number
  artistsProcessed?: number
  error?: string
}

export type JobStatus = 'queued' | 'running' | 'done' | 'error'
export type JobPhase =
  | 'queued'
  | 'fetching'
  | 'filtering'
  | 'resolving'
  | 'saving'
  | 'done'
  | 'error'

export interface CatalogJob {
  status: JobStatus
  processed: number
  total: number
  added: number
  skipped: number
  phase: JobPhase
  error?: string
  playlistName?: string
  skippedExisting?: number
  skippedNonOpm?: number
  skippedNoPreview?: number
  skippedNonOpmNames?: string[]
  updated?: number
  country?: string
  catalog?: string
  errors?: string[]
  source?: string
  fetched?: number
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

export async function fetchCatalog(
  page: number,
  query: string,
  filters: CatalogFilters,
): Promise<CatalogResponse> {
  const params = new URLSearchParams({ page: String(page), pageSize: '50' })
  if (query.trim()) params.set('q', query.trim())
  if (filters.difficulty && filters.difficulty !== 'all') {
    params.set('difficulty', filters.difficulty)
  }
  if (filters.genre && filters.genre !== 'all') {
    params.set('genre', filters.genre)
  }
  if (filters.era && filters.era !== 'all') {
    params.set('era', filters.era)
  }
  if (filters.country && filters.country !== 'all') {
    params.set('country', filters.country)
  }
  if (filters.missingPreview) params.set('missingPreview', '1')
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

export async function triggerCron(): Promise<CronTriggerResponse> {
  return request<CronTriggerResponse>('/cron/trigger', {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export interface SpotifySyncResponse {
  ok: boolean
  message: string
  skipped?: boolean
  reason?: string
  updated: number
  tracks: number
  distribution?: Record<string, number>
  rateLimited: boolean
  errors: string[]
  error?: string
}

export async function syncSpotifyMetrics(): Promise<SpotifySyncResponse> {
  return request<SpotifySyncResponse>('/spotify/sync', {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export async function startPlaylistImport(
  playlistUrl: string,
  options: { country?: string; catalog?: string; assumeAllLocal?: boolean } = {},
): Promise<string> {
  const data = await request<{ jobId: string }>('/catalog/playlist', {
    method: 'POST',
    body: JSON.stringify({
      playlistUrl,
      country: options.country,
      catalog: options.catalog,
      assumeAllLocal: options.assumeAllLocal === true,
    }),
  })
  return data.jobId
}

export async function fetchJob(jobId: string): Promise<CatalogJob> {
  return request<CatalogJob>(`/jobs/${jobId}`)
}
