import {
  DEFAULT_CATALOG,
  DEFAULT_COUNTRY,
  isCatalogKind,
  isCountryCode,
  type CatalogKind,
  type CountryCode,
} from '../shared/catalog-meta'
import {
  isAllowedTrack,
  loadArtistAllowlist,
  seedOpmArtists,
  upsertArtists,
} from './artists-d1'
import { resolveCatalogIds, addTracksToCollections } from './catalogs-d1'
import {
  applyChartImportPatches,
  findExistingIdentities,
  insertTracks,
  MAX_CATALOG_TRACKS,
  upsertTracks,
} from './catalog-d1'
import { assignChartDifficulty, parseReleaseYear } from './difficulty'
import {
  fetchPlaylistTracks,
  MAX_PLAYLIST_TRACKS,
  OPM_PLAYLIST_ID,
  parseSpotifyPlaylistId,
  type PlaylistTrackSource,
} from './playlist-source'
import {
  fetchSpotifyArtists,
  fetchSpotifyTracks,
  getSpotifyClientCredentialsToken,
  spotifyApiGet,
  type SpotifyArtistDetails,
} from './spotify-api'
import { syncPopularityByIds } from './spotify-sync'
import { songIdentityKey } from './track-dedupe'
import { buildTrackFromSpotify } from './track-builder'
import type { Env, Track } from './types'

const IMPORT_TIME_BUDGET_MS = 90_000
const PERSIST_EVERY_ADDED = 10
const MAX_ERROR_MESSAGES = 8

export type PlaylistImportPhase = 'fetching' | 'filtering' | 'resolving' | 'saving' | 'done'

export interface PlaylistImportOptions {
  country?: string
  catalog?: string
  catalogs?: string[]
  collections?: string[]
  assumeAllLocal?: boolean
  /** Add selected artists to each row's country known-artist list. */
  trustArtists?: boolean
  /** Skip artists not already known for their row's country. */
  requireKnownArtists?: boolean
  chartBoost?: boolean
  trackIds?: string[]
  /** Per-track origin; falls back to `country`. Independent from catalog. */
  trackCountries?: Record<string, string>
}

export interface PlaylistImportProgress {
  phase: PlaylistImportPhase
  processed: number
  total: number
  added: number
  skipped: number
  playlistName?: string
}

export interface PlaylistImportResult {
  added: number
  updated: number
  skippedExisting: number
  skippedNonOpm: number
  skippedNoPreview: number
  skippedNonOpmNames: string[]
  errors: string[]
  playlistId: string
  playlistName: string
  source: PlaylistTrackSource
  fetched: number
  country: CountryCode
  catalog: CatalogKind
  assumeAllLocal: boolean
  chartBoost: boolean
}

function pushError(errors: string[], message: string): void {
  if (errors.length < MAX_ERROR_MESSAGES) {
    errors.push(message)
    return
  }
  if (errors.length === MAX_ERROR_MESSAGES) {
    errors.push('Additional errors omitted')
  }
}

export function parseImportCountry(value: string | undefined): CountryCode {
  const normalized = value?.trim().toUpperCase()
  return normalized && isCountryCode(normalized) ? normalized : DEFAULT_COUNTRY
}

function parseTrackCountries(
  value: Record<string, string> | undefined,
  fallback: CountryCode,
): Map<string, CountryCode> {
  const map = new Map<string, CountryCode>()
  if (!value) return map
  for (const [id, code] of Object.entries(value)) {
    if (!id.trim()) continue
    map.set(id, parseImportCountry(code ?? fallback))
  }
  return map
}

function countryForTrack(
  trackId: string,
  fallback: CountryCode,
  trackCountries: Map<string, CountryCode>,
): CountryCode {
  return trackCountries.get(trackId) ?? fallback
}

export function parseImportCatalog(value: string | undefined): CatalogKind {
  const normalized = value?.trim().toLowerCase()
  return normalized && isCatalogKind(normalized) ? normalized : DEFAULT_CATALOG
}

function spotifyTrackIdentity(track: { name?: string; artists?: Array<{ name?: string }> }): string {
  return songIdentityKey({
    title: track.name ?? '',
    artist: (track.artists ?? []).map((artist) => artist.name ?? '').join(', '),
  })
}

function collapsePlaylistTracks<T extends { id?: string; name?: string; artists?: Array<{ name?: string }> }>(
  tracks: T[],
): { tracks: T[]; collapsed: number } {
  const seenIds = new Set<string>()
  const seenKeys = new Set<string>()
  const unique: T[] = []
  let collapsed = 0

  for (const track of tracks) {
    if (!track.id) continue
    const key = spotifyTrackIdentity(track)
    if (seenIds.has(track.id) || seenKeys.has(key)) {
      collapsed += 1
      continue
    }
    seenIds.add(track.id)
    seenKeys.add(key)
    unique.push(track)
  }

  return { tracks: unique, collapsed }
}

export interface PlaylistPreviewTrack {
  id: string
  title: string
  artist: string
  albumArt: string
  alreadyInCatalog: boolean
  isDuplicate: boolean
}

export interface PlaylistPreviewResult {
  playlistId: string
  playlistName: string
  tracks: PlaylistPreviewTrack[]
}

export async function previewPlaylistForCatalog(
  env: Env,
  playlistUrl: string,
): Promise<PlaylistPreviewResult> {
  const playlistId = parseSpotifyPlaylistId(playlistUrl)
  if (!playlistId) {
    throw Object.assign(new Error('Invalid Spotify playlist URL or ID'), { status: 400 })
  }

  const clientId = env.SPOTIFY_CLIENT_ID
  const clientSecret = env.SPOTIFY_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw Object.assign(new Error('Spotify is not configured'), { status: 503 })
  }

  const token = await getSpotifyClientCredentialsToken(clientId, clientSecret)
  const spotifyGet = (path: string, params?: Record<string, string | number | undefined>) =>
    spotifyApiGet(token, path, params)
  const playlist = await fetchPlaylistTracks(spotifyGet, playlistId)
  const tracks = playlist.tracks.filter((track): track is typeof track & { id: string } => Boolean(track.id))

  const identities = await findExistingIdentities(
    env,
    tracks.map((track) => ({
      id: track.id,
      title: track.name ?? '',
      artist: (track.artists ?? []).map((artist) => artist.name).join(', '),
    })),
  )

  const seenIds = new Set<string>()
  const seenKeys = new Set<string>()

  return {
    playlistId: playlist.playlistId,
    playlistName: playlist.playlistName,
    tracks: tracks.map((track) => {
      const title = track.name ?? 'Unknown'
      const artist = (track.artists ?? []).map((item) => item.name).join(', ')
      const key = songIdentityKey({ title, artist })
      const isDuplicate = seenIds.has(track.id) || seenKeys.has(key)
      seenIds.add(track.id)
      seenKeys.add(key)
      return {
        id: track.id,
        title,
        artist,
        albumArt: track.album?.images?.[0]?.url ?? '',
        alreadyInCatalog: identities.ids.has(track.id) || identities.songKeys.has(key),
        isDuplicate,
      }
    }),
  }
}

function uniqueArtistNames(track: { artists?: Array<{ name?: string }> }): string[] {
  return [
    ...new Set(
      (track.artists ?? [])
        .map((artist) => artist.name?.trim())
        .filter((name): name is string => Boolean(name)),
    ),
  ]
}

export async function importPlaylistToCatalog(
  env: Env,
  playlistUrl: string,
  onProgress?: (progress: PlaylistImportProgress) => void,
  options: PlaylistImportOptions = {},
): Promise<PlaylistImportResult> {
  const playlistId = parseSpotifyPlaylistId(playlistUrl)
  if (!playlistId) {
    throw Object.assign(new Error('Invalid Spotify playlist URL or ID'), { status: 400 })
  }

  const clientId = env.SPOTIFY_CLIENT_ID
  const clientSecret = env.SPOTIFY_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw Object.assign(new Error('Spotify is not configured'), { status: 503 })
  }

  const country = parseImportCountry(options.country)
  const collectionIds = await resolveCatalogIds(
    env,
    options.collections?.length
      ? options.collections
      : options.catalogs?.length
        ? options.catalogs
        : options.catalog
          ? [options.catalog]
          : [],
  )
  const catalog = collectionIds[0] ?? ''
  const trustArtists = options.trustArtists === true || options.assumeAllLocal === true
  const requireKnownArtists =
    options.requireKnownArtists === true
      ? true
      : options.requireKnownArtists === false
        ? false
        : !trustArtists
  const assumeAllLocal = trustArtists
  const trackCountryMap = parseTrackCountries(options.trackCountries, country)
  const chartBoost = options.chartBoost === true || playlistId === OPM_PLAYLIST_ID
  const selectedIds = options.trackIds?.filter(Boolean) ?? []
  const selectedSet = selectedIds.length > 0 ? new Set(selectedIds) : null

  onProgress?.({
    phase: 'fetching',
    processed: 0,
    total: 0,
    added: 0,
    skipped: 0,
  })

  await seedOpmArtists(env)

  const token = await getSpotifyClientCredentialsToken(clientId, clientSecret)
  const spotifyGet = (path: string, params?: Record<string, string | number | undefined>) =>
    spotifyApiGet(token, path, params)

  const playlist = await fetchPlaylistTracks(spotifyGet, playlistId)
  let fetchedTracks = playlist.tracks
    .filter((track): track is typeof track & { id: string } => Boolean(track.id))
    .slice(0, MAX_PLAYLIST_TRACKS)
  if (selectedSet) {
    fetchedTracks = fetchedTracks.filter((track) => selectedSet.has(track.id))
  }
  const { tracks, collapsed } = collapsePlaylistTracks(fetchedTracks)
  const identities = await findExistingIdentities(
    env,
    tracks.map((track) => ({
      id: track.id,
      title: track.name ?? '',
      artist: (track.artists ?? []).map((artist) => artist.name).join(', '),
    })),
  )
  const existingIds = identities.ids
  const existingKeys = identities.songKeys
  const total = tracks.length
  let skippedExisting = collapsed

  const pending: Track[] = []
  const chartPatches: Array<{
    id: string
    popularity?: number
    artistPopularity?: number
    releaseYear?: number
    releaseDate?: string
    spotifyGenres?: string[]
    difficulty: Track['difficulty']
    country: CountryCode
    catalog: CatalogKind
    forceTier: Track['difficulty']
  }> = []
  let added = 0
  let updated = 0
  let skippedNonOpm = 0
  let skippedNoPreview = 0
  const skippedNonOpmNames = new Set<string>()
  const errors: string[] = []
  const idsToHydrate = new Set<string>()
  const runStartedAt = Date.now()

  const skipped = () => skippedExisting + skippedNonOpm + skippedNoPreview
  let currentProcessed = 0

  const report = (phase: PlaylistImportPhase, processed: number) => {
    currentProcessed = processed
    onProgress?.({
      phase,
      processed,
      total,
      added,
      skipped: skipped(),
      playlistName: playlist.playlistName,
    })
  }

  report('filtering', 0)

  const allowlists = new Map<CountryCode, Awaited<ReturnType<typeof loadArtistAllowlist>>>()
  const allowlistFor = async (origin: CountryCode) => {
    const existing = allowlists.get(origin)
    if (existing) return existing
    const loaded = await loadArtistAllowlist(env, origin)
    allowlists.set(origin, loaded)
    return loaded
  }

  if (trustArtists) {
    const artistsByCountry = new Map<CountryCode, Array<{ id?: string; name: string }>>()
    for (const track of tracks) {
      const origin = countryForTrack(track.id ?? '', country, trackCountryMap)
      const list = artistsByCountry.get(origin) ?? []
      for (const artist of track.artists ?? []) {
        list.push({ id: artist.id, name: artist.name })
      }
      artistsByCountry.set(origin, list)
    }
    for (const [origin, artists] of artistsByCountry) {
      await upsertArtists(env, artists, origin)
    }
  }

  const persistPending = async (): Promise<boolean> => {
    if (pending.length === 0) return false
    report('saving', currentProcessed)
    const ids = pending.map((track) => track.id)
    for (const id of ids) idsToHydrate.add(id)
    const saved = chartBoost
      ? await upsertTracks(env, pending)
      : await insertTracks(env, pending)
    added += saved.added
    updated += 'updated' in saved ? saved.updated : 0
    try {
      await addTracksToCollections(env, ids, collectionIds)
    } catch (error) {
      pushError(errors, error instanceof Error ? error.message : 'Could not assign collections')
    }
    pending.length = 0
    if (saved.skippedCap > 0) {
      pushError(errors, `Catalog at ${MAX_CATALOG_TRACKS.toLocaleString()} track cap`)
      return true
    }
    return false
  }

  const artistIds = [
    ...new Set(
      tracks.flatMap((track) => (track.artists ?? []).map((artist) => artist.id).filter(Boolean)),
    ),
  ] as string[]

  let artistDetails = new Map<string, SpotifyArtistDetails>()
  try {
    artistDetails = new Map(
      (await fetchSpotifyArtists(token, artistIds)).map((artist) => [artist.id, artist]),
    )
    if (trustArtists) {
      const artistsByCountry = new Map<CountryCode, Array<{ id: string; name: string; popularity?: number }>>()
      for (const track of tracks) {
        const origin = countryForTrack(track.id ?? '', country, trackCountryMap)
        const list = artistsByCountry.get(origin) ?? []
        for (const artist of track.artists ?? []) {
          if (!artist.id) continue
          const details = artistDetails.get(artist.id)
          list.push({
            id: artist.id,
            name: details?.name ?? artist.name,
            popularity: details?.popularity,
          })
        }
        artistsByCountry.set(origin, list)
      }
      for (const [origin, artists] of artistsByCountry) {
        await upsertArtists(env, artists, origin)
      }
    }
  } catch (error) {
    pushError(errors, error instanceof Error ? error.message : 'Could not load artist details')
  }

  const hydrateIds = tracks.map((track) => track.id).filter((id): id is string => Boolean(id))
  if (hydrateIds.length > 0) {
    try {
      const hydrated = await fetchSpotifyTracks(token, hydrateIds)
      const byId = new Map(hydrated.map((track) => [track.id, track]))
      for (const [index, track] of tracks.entries()) {
        const full = track.id ? byId.get(track.id) : undefined
        if (full) tracks[index] = { ...track, ...full }
      }
    } catch (error) {
      pushError(errors, error instanceof Error ? error.message : 'Could not hydrate track popularity')
    }
  }

  for (const [index, track] of tracks.entries()) {
    if (existingIds.size >= MAX_CATALOG_TRACKS && !chartBoost) {
      pushError(errors, `Catalog at ${MAX_CATALOG_TRACKS.toLocaleString()} track cap`)
      break
    }

    if (Date.now() - runStartedAt >= IMPORT_TIME_BUDGET_MS) {
      pushError(errors, 'Stopped after time budget. Re-run to continue.')
      break
    }

    if (!track?.id) {
      report('filtering', index + 1)
      continue
    }

    const trackCountry = countryForTrack(track.id, country, trackCountryMap)

    if (requireKnownArtists && trackCountry !== 'GLOBAL') {
      const allowlist = await allowlistFor(trackCountry)
      if (!isAllowedTrack(track, trackCountry, allowlist, { assumeAllLocal: false })) {
        skippedNonOpm += 1
        for (const name of uniqueArtistNames(track)) {
          skippedNonOpmNames.add(name)
        }
        report('filtering', index + 1)
        continue
      }
    }

    const primaryArtist = track.artists?.[0]
    const primaryDetails = primaryArtist?.id ? artistDetails.get(primaryArtist.id) : undefined
    const spotifyGenres = [
      ...new Set(
        (track.artists ?? []).flatMap((artist) =>
          artist.id ? (artistDetails.get(artist.id)?.genres ?? []) : [],
        ),
      ),
    ]

    const identityKey = spotifyTrackIdentity(track)

    if (existingIds.has(track.id)) {
      if (chartBoost) {
        const popularity = track.popularity ?? 0
        const artistPopularity = primaryDetails?.popularity ?? 0
        const difficulty = assignChartDifficulty({
          popularity,
          artistPopularity,
          artistName: track.artists?.map((item) => item.name).join(', '),
        })
        chartPatches.push({
          id: track.id,
          popularity: track.popularity,
          artistPopularity: primaryDetails?.popularity,
          releaseYear: parseReleaseYear(track.album?.release_date),
          releaseDate: track.album?.release_date,
          spotifyGenres,
          difficulty,
          country: trackCountry,
          catalog,
          forceTier: difficulty,
        })
        updated += 1
      } else {
        skippedExisting += 1
      }
      report('filtering', index + 1)
      continue
    }

    if (existingKeys.has(identityKey)) {
      skippedExisting += 1
      report('filtering', index + 1)
      continue
    }

    try {
      report('resolving', index + 1)
      const built = await buildTrackFromSpotify(track, {
        country: trackCountry,
        catalog,
        chartBoost,
        requireOpm: false,
        artistPopularity: primaryDetails?.popularity,
        spotifyGenres,
      })
      if (!built.track) {
        if (built.reason?.toLowerCase().includes('preview')) {
          skippedNoPreview += 1
        } else if (built.reason?.toLowerCase().includes('opm')) {
          skippedNonOpm += 1
          for (const name of uniqueArtistNames(track)) {
            skippedNonOpmNames.add(name)
          }
        } else {
          pushError(errors, built.reason ?? `Could not add ${track.name ?? track.id}`)
        }
        report('resolving', index + 1)
        continue
      }

      pending.push(built.track)
      existingIds.add(built.track.id)
      existingKeys.add(identityKey)
      existingKeys.add(songIdentityKey(built.track))

      if (pending.length >= PERSIST_EVERY_ADDED) {
        const hitCap = await persistPending()
        report('resolving', index + 1)
        if (hitCap) break
      }
    } catch (error) {
      const status = (error as { status?: number }).status
      if (status === 429) {
        pushError(errors, 'Spotify rate limited')
        break
      }
      pushError(
        errors,
        error instanceof Error ? error.message : `Failed ${track.name ?? track.id}`,
      )
      report('resolving', index + 1)
    }
  }

  await persistPending()
  if (chartPatches.length > 0) {
    report('saving', total)
    for (const patch of chartPatches) idsToHydrate.add(patch.id)
    updated = await applyChartImportPatches(env, chartPatches)
    try {
      await addTracksToCollections(
        env,
        chartPatches.map((patch) => patch.id),
        collectionIds,
      )
    } catch (error) {
      pushError(errors, error instanceof Error ? error.message : 'Could not assign collections')
    }
  }
  if (idsToHydrate.size > 0) {
    try {
      const hydrate = await syncPopularityByIds(env, [...idsToHydrate])
      if (hydrate.errors.length > 0) {
        for (const message of hydrate.errors.slice(0, 3)) pushError(errors, message)
      }
    } catch (error) {
      pushError(errors, error instanceof Error ? error.message : 'Could not sync popularity for new tracks')
    }
  }
  report('done', total)

  return {
    added,
    updated,
    skippedExisting,
    skippedNonOpm,
    skippedNoPreview,
    skippedNonOpmNames: [...skippedNonOpmNames].sort((left, right) => left.localeCompare(right)),
    errors,
    playlistId: playlist.playlistId,
    playlistName: playlist.playlistName,
    source: playlist.source,
    fetched: playlist.tracks.length,
    country,
    catalog,
    assumeAllLocal,
    chartBoost,
  }
}
