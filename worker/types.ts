import type { CatalogKind, CountryCode } from '../shared/catalog-meta'

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert' | 'impossible'

export type EraFilter = 'modern' | '2010s' | '2000s' | 'classics'
export type GenreFilter = 'pop' | 'hip-hop' | 'r&b' | 'rock' | 'dance' | 'other'
export type { CatalogKind, CountryCode }

export interface Track {
  id: string
  title: string
  artist: string
  previewUrl: string
  hookPreviewUrl?: string
  hookStartSeconds?: number
  /** Full licensed audio on R2 (or `/api/audio/...`). */
  audioUrl?: string
  /** Optional pre-cut intro clip on R2. */
  introClipUrl?: string
  /** Optional pre-cut hook clip on R2. */
  hookClipUrl?: string
  /** Intro seek offset in ms when using `audioUrl` (default 0). */
  startAtMs?: number
  /** Hook seek offset in ms when using `audioUrl` (reference: hookStartMs). */
  hookStartMs?: number
  albumArt: string
  difficulty: Difficulty
  releaseYear?: number
  releaseDate?: string
  genreGroups?: GenreFilter[]
  /** Artist genres from Spotify when available. */
  spotifyGenres?: string[]
  /** Official Spotify track.popularity 0–100. No public play-count exists. */
  popularity?: number
  /** Official Spotify primary-artist.popularity 0–100. */
  artistPopularity?: number
  durationMs?: number
  spotifySyncedAt?: string
  /** ISO-like origin: PH, KR, JP, US, GLOBAL. */
  country?: CountryCode
  /** Catalog bucket: opm, kpop, anime, other. */
  catalog?: CatalogKind
  /** Popular-chart imports stay easy/medium on later metric syncs. */
  chartBoost?: boolean
  forceTier?: Difficulty
}

export interface Catalog {
  updatedAt: string
  tracks: Track[]
}

export interface Env {
  SPOTIFY_CLIENT_ID?: string
  SPOTIFY_CLIENT_SECRET?: string
  ADMIN_PASSWORD?: string
  AUDIO_BUCKET: R2Bucket
  DB: D1Database
  ASSETS?: Fetcher
}
