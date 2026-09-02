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
  popularityFilled?: number
  popularityMissing?: number
  lastSpotifySync?: SpotifySyncResponse | null
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
  ok?: boolean
  message: string
  skipped?: boolean
  reason?: string
  updated: number
  tracks: number
  popularityFilled?: number
  popularityMissing?: number
  source?: 'web-api' | 'embed' | 'mixed' | 'none'
  distribution?: Record<string, number>
  rateLimited: boolean
  errors: string[]
  at?: string
  error?: string
}

export async function syncSpotifyMetrics(): Promise<SpotifySyncResponse> {
  return request<SpotifySyncResponse>('/spotify/sync', {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export interface PlaylistPreviewTrack {
  id: string
  title: string
  artist: string
  albumArt: string
  alreadyInCatalog: boolean
  isDuplicate: boolean
}

export interface PlaylistPreview {
  playlistId: string
  playlistName: string
  tracks: PlaylistPreviewTrack[]
}

export async function previewPlaylist(playlistUrl: string): Promise<PlaylistPreview> {
  return request<PlaylistPreview>('/catalog/playlist/preview', {
    method: 'POST',
    body: JSON.stringify({ playlistUrl }),
  })
}

export async function startPlaylistImport(
  playlistUrl: string,
  options: {
    country?: string
    catalog?: string
    assumeAllLocal?: boolean
    trackIds?: string[]
  } = {},
): Promise<string> {
  const data = await request<{ jobId: string }>('/catalog/playlist', {
    method: 'POST',
    body: JSON.stringify({
      playlistUrl,
      country: options.country,
      catalog: options.catalog,
      assumeAllLocal: options.assumeAllLocal === true,
      trackIds: options.trackIds,
    }),
  })
  return data.jobId
}

export async function fetchJob(jobId: string): Promise<CatalogJob> {
  return request<CatalogJob>(`/jobs/${jobId}`)
}

export interface AdminArtist {
  id: string
  name: string
  country: string
  whitelisted: boolean
  songCount: number
  popularity?: number
}

export interface ArtistsResponse {
  artists: AdminArtist[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export async function fetchArtists(
  page: number,
  query: string,
): Promise<ArtistsResponse> {
  const params = new URLSearchParams({ page: String(page), pageSize: '50' })
  if (query.trim()) params.set('q', query.trim())
  return request<ArtistsResponse>(`/artists?${params}`)
}

export async function updateArtist(
  id: string,
  patch: { country?: string; whitelisted?: boolean },
): Promise<AdminArtist> {
  const data = await request<{ artist: AdminArtist }>(`/artists/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
  return data.artist
}

export async function removeArtist(
  id: string,
  options: { removeSongs?: boolean } = {},
): Promise<{ songsRemoved: number }> {
  const params = options.removeSongs ? '?removeSongs=1' : ''
  return request<{ songsRemoved: number }>(`/artists/${encodeURIComponent(id)}${params}`, {
    method: 'DELETE',
  })
}

export interface AdminCatalog {
  id: string
  name: string
  emoji: string
  country: string | null
  createdAt: string
  trackCount?: number
}

export async function fetchCatalogs(): Promise<AdminCatalog[]> {
  const data = await request<{ catalogs: AdminCatalog[] }>('/catalogs')
  return data.catalogs
}

export async function createCatalog(input: {
  name: string
  emoji: string
  country?: string | null
  id?: string
}): Promise<AdminCatalog> {
  const data = await request<{ catalog: AdminCatalog }>('/catalogs', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return data.catalog
}

export async function updateCatalog(
  id: string,
  patch: { name?: string; emoji?: string; country?: string | null },
): Promise<AdminCatalog> {
  const data = await request<{ catalog: AdminCatalog }>(`/catalogs/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
  return data.catalog
}

export async function deleteCatalog(id: string): Promise<void> {
  await request(`/catalogs/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function dedupeCatalog(): Promise<{ removed: number; kept: number; groups: number }> {
  return request('/catalog/dedupe', { method: 'POST', body: JSON.stringify({}) })
}
