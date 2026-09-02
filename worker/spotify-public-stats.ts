/**
 * Every Spotify metric the catalog scores on, read from public web-player
 * services instead of the official Web API.
 *
 * `GET /v1/tracks` is quota-blocked for this app, and the Web API has no listen
 * count at all. The open.spotify.com embed page ships an anonymous web-player
 * access token in `__NEXT_DATA__`, and that one token unlocks:
 *
 *   - pathfinder `getTrack`        -> playcount, album release date
 *   - spclient `/metadata/4/track` -> popularity 0-100
 *   - spclient `/metadata/4/artist`-> artist popularity 0-100
 *   - pathfinder `searchTracks`    -> unthrottled track search
 *
 * All of this is unofficial and can break without notice. Keep the request rate
 * low, cache results in D1, and never invent a number when a query fails —
 * a missing signal must stay null so a later sweep retries it.
 */

const WEB_PLAYER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

const PATHFINDER_URL = 'https://api-partner.spotify.com/pathfinder/v1/query'
/** Persisted-query hash for the web player's `getTrack` operation. */
const GET_TRACK_QUERY_HASH = '5c5ec8c973a0ac2d5b38d7064056c45103c5a062ee12b62ce683ab397b5fbe7d'
/**
 * Persisted-query hashes harvested from the web player's own bundles
 * (`scripts/spotify-operations.mjs` re-derives them). Pathfinder rejects raw
 * GraphQL documents with "Missing extensions in the request", so these hashes
 * are required and will need re-harvesting whenever Spotify ships a new player.
 */
const SEARCH_TRACKS_QUERY_HASH =
  '59ee4a659c32e9ad894a71308207594a65ba67bb6b632b183abe97303a51fa55'
const FETCH_PLAYLIST_QUERY_HASH =
  'b39f62e9b566aa849b1780927de1450f47e02c54abf1e66e513f96e849591e41'

/** Parallel pathfinder calls. Measured safe; stay well under the web player's own burst. */
export const PUBLIC_STATS_CONCURRENCY = 4
/** Pause between chunks so a full backfill trickles rather than bursts. */
export const PUBLIC_STATS_CHUNK_DELAY_MS = 120
/** Per-run cap so a cron tick cannot walk the whole catalog. */
export const PUBLIC_STATS_RUN_LIMIT = 250
/** Refresh the anonymous token a minute before Spotify expires it. */
const TOKEN_SAFETY_WINDOW_MS = 60_000
/** Seed used when we need a token but have no track in hand. */
const SEED_TRACK_ID = '6DyUH0V8c8fy5hg40O16Jn'

/**
 * spclient serves track/artist metadata keyed by a 32-char hex "gid" rather
 * than the base62 ID used in URLs. Primary host first, regional as a fallback.
 */
const SPCLIENT_HOSTS = ['spclient.wg.spotify.com', 'guc3-spclient.spotify.com']
const BASE62_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'

/** Base62 Spotify ID -> zero-padded 32-char hex gid. */
export function spotifyIdToGid(id: string): string | undefined {
  if (!/^[0-9A-Za-z]{22}$/.test(id)) return undefined
  let value = 0n
  for (const character of id) {
    const index = BASE62_ALPHABET.indexOf(character)
    if (index < 0) return undefined
    value = value * 62n + BigInt(index)
  }
  const hex = value.toString(16)
  return hex.length > 32 ? undefined : hex.padStart(32, '0')
}

export interface PublicTrackStats {
  id: string
  title?: string
  artist?: string
  albumArt?: string
  playCount?: number
  releaseDate?: string
  durationMs?: number
  /** Spotify's own 0-100 popularity, from spclient rather than the Web API. */
  popularity?: number
  artistPopularity?: number
  artistIds?: string[]
}

export interface WebPlayerSession {
  token: string
  expiresAt: number
}

export interface PublicStatsBatchResult {
  stats: PublicTrackStats[]
  attempted: number
  rateLimited: boolean
  errors: string[]
}

class PublicStatsError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'PublicStatsError'
  }
}

function parsePlayCount(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return value
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const parsed = Number(value)
    if (Number.isSafeInteger(parsed) && parsed >= 0) return parsed
  }
  return undefined
}

function isoDay(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const match = value.match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/)
  if (!match) return undefined
  return `${match[1]}-${match[2] ?? '01'}-${match[3] ?? '01'}`
}

function parseNextData(html: string): Record<string, unknown> | undefined {
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
  if (!match?.[1]) return undefined
  try {
    return JSON.parse(match[1]) as Record<string, unknown>
  } catch {
    return undefined
  }
}

/**
 * Reads the anonymous web-player token out of an embed page. This is a public
 * page token with no user identity attached; nothing is stored beyond this run.
 */
export async function openWebPlayerSession(seedTrackId?: string): Promise<WebPlayerSession | null> {
  const id = seedTrackId?.trim() || SEED_TRACK_ID
  let html: string
  try {
    const response = await fetch(`https://open.spotify.com/embed/track/${encodeURIComponent(id)}`, {
      headers: { 'User-Agent': WEB_PLAYER_USER_AGENT, Accept: 'text/html' },
    })
    if (!response.ok) return null
    html = await response.text()
  } catch {
    return null
  }

  const session = (
    parseNextData(html)?.props as
      | {
          pageProps?: {
            state?: {
              settings?: {
                session?: { accessToken?: string; accessTokenExpirationTimestampMs?: number }
              }
            }
          }
        }
      | undefined
  )?.pageProps?.state?.settings?.session

  if (!session?.accessToken) return null
  const expiresAt =
    typeof session.accessTokenExpirationTimestampMs === 'number'
      ? session.accessTokenExpirationTimestampMs
      : Date.now() + 30 * 60_000
  return { token: session.accessToken, expiresAt }
}

function sessionIsUsable(session: WebPlayerSession | null): session is WebPlayerSession {
  return Boolean(session && session.expiresAt - TOKEN_SAFETY_WINDOW_MS > Date.now())
}

interface TrackUnion {
  name?: string
  playcount?: unknown
  duration?: { totalMilliseconds?: number }
  artists?: { items?: Array<{ profile?: { name?: string } }> }
  albumOfTrack?: {
    date?: { isoString?: string }
    coverArt?: { sources?: Array<{ url?: string; width?: number }> }
  }
}

function statsFromTrackUnion(id: string, track: TrackUnion): PublicTrackStats {
  const artist = (track.artists?.items ?? [])
    .map((item) => item.profile?.name ?? '')
    .filter(Boolean)
    .join(', ')
  const cover = [...(track.albumOfTrack?.coverArt?.sources ?? [])].sort(
    (left, right) => (right.width ?? 0) - (left.width ?? 0),
  )[0]?.url

  return {
    id,
    title: typeof track.name === 'string' ? track.name : undefined,
    artist: artist || undefined,
    albumArt: cover,
    playCount: parsePlayCount(track.playcount),
    releaseDate: isoDay(track.albumOfTrack?.date?.isoString),
    durationMs:
      typeof track.duration?.totalMilliseconds === 'number'
        ? track.duration.totalMilliseconds
        : undefined,
  }
}

/** One persisted-query call. Throws PublicStatsError on auth/throttle statuses. */
async function pathfinderQuery<T>(
  token: string,
  operationName: string,
  variables: Record<string, unknown>,
  sha256Hash: string,
): Promise<T | null> {
  const response = await fetch(PATHFINDER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': WEB_PLAYER_USER_AGENT,
      Origin: 'https://open.spotify.com',
      Referer: 'https://open.spotify.com/',
      'App-Platform': 'WebPlayer',
    },
    body: JSON.stringify({
      operationName,
      variables,
      extensions: { persistedQuery: { version: 1, sha256Hash } },
    }),
  })

  if (response.status === 401 || response.status === 403 || response.status === 429) {
    throw new PublicStatsError(`Spotify web player returned ${response.status}`, response.status)
  }
  if (!response.ok) return null

  const payload = (await response.json().catch(() => null)) as { data?: T } | null
  return payload?.data ?? null
}

async function queryTrack(id: string, token: string): Promise<PublicTrackStats | null> {
  const data = await pathfinderQuery<{ trackUnion?: TrackUnion & { __typename?: string } }>(
    token,
    'getTrack',
    { uri: `spotify:track:${id}` },
    GET_TRACK_QUERY_HASH,
  )
  const track = data?.trackUnion
  if (!track || (track.__typename && track.__typename !== 'Track')) return null

  const stats = statsFromTrackUnion(id, track)
  return stats.playCount == null && !stats.releaseDate && !stats.title ? null : stats
}

/**
 * Fallback for release date only. The embed `__NEXT_DATA__` entity carries
 * `releaseDate` but never a play count.
 */
async function releaseDateFromEmbed(id: string): Promise<PublicTrackStats | null> {
  let html: string
  try {
    const response = await fetch(`https://open.spotify.com/embed/track/${encodeURIComponent(id)}`, {
      headers: { 'User-Agent': WEB_PLAYER_USER_AGENT, Accept: 'text/html' },
    })
    if (!response.ok) return null
    html = await response.text()
  } catch {
    return null
  }

  const entity = (
    parseNextData(html)?.props as
      | { pageProps?: { state?: { data?: { entity?: Record<string, unknown> } } } }
      | undefined
  )?.pageProps?.state?.data?.entity
  if (!entity) return null

  const releaseDate =
    isoDay((entity.releaseDate as { isoString?: string } | undefined)?.isoString) ??
    isoDay(entity.releaseDate)
  if (!releaseDate) return null

  return {
    id,
    title: typeof entity.name === 'string' ? entity.name : undefined,
    releaseDate,
    durationMs: typeof entity.duration === 'number' ? entity.duration : undefined,
  }
}

interface SpclientEntity {
  gid?: string
  name?: string
  popularity?: unknown
  duration?: unknown
  artist?: Array<{ gid?: string; name?: string }>
  album?: { name?: string; date?: { year?: number; month?: number; day?: number } }
}

function clampPopularity(value: unknown): number | undefined {
  const parsed = typeof value === 'string' ? Number(value) : value
  if (typeof parsed !== 'number' || !Number.isFinite(parsed)) return undefined
  if (parsed < 0 || parsed > 100) return undefined
  return Math.round(parsed)
}

function isoFromSpclientDate(date?: {
  year?: number
  month?: number
  day?: number
}): string | undefined {
  if (!date || typeof date.year !== 'number' || date.year < 1900) return undefined
  const month = String(date.month ?? 1).padStart(2, '0')
  const day = String(date.day ?? 1).padStart(2, '0')
  return `${date.year}-${month}-${day}`
}

/** GET spclient metadata, trying the regional host if the primary refuses. */
async function spclientEntity(
  kind: 'track' | 'artist' | 'album',
  id: string,
  token: string,
): Promise<SpclientEntity | null> {
  const gid = spotifyIdToGid(id)
  if (!gid) return null

  let lastStatus = 0
  for (const host of SPCLIENT_HOSTS) {
    const suffix = kind === 'track' ? '?market=from_token' : ''
    let response: Response
    try {
      response = await fetch(`https://${host}/metadata/4/${kind}/${gid}${suffix}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'User-Agent': WEB_PLAYER_USER_AGENT,
        },
      })
    } catch {
      continue
    }
    if (response.ok) return (await response.json().catch(() => null)) as SpclientEntity | null
    lastStatus = response.status
    // 404 means Spotify genuinely has no such entity; other hosts will agree.
    if (response.status === 404) return null
  }

  if (lastStatus === 401 || lastStatus === 403 || lastStatus === 429) {
    throw new PublicStatsError(`Spotify spclient returned ${lastStatus}`, lastStatus)
  }
  return null
}

/** Track popularity (and a release-date fallback) from spclient. */
export async function fetchSpclientTrack(
  id: string,
  session: WebPlayerSession,
): Promise<Pick<PublicTrackStats, 'popularity' | 'releaseDate' | 'artistIds' | 'title' | 'artist'> | null> {
  const entity = await spclientEntity('track', id, session.token)
  if (!entity) return null
  const artists = entity.artist ?? []
  return {
    popularity: clampPopularity(entity.popularity),
    releaseDate: isoFromSpclientDate(entity.album?.date),
    artistIds: artists.map((item) => item.gid).filter((gid): gid is string => Boolean(gid)),
    title: typeof entity.name === 'string' ? entity.name : undefined,
    artist: artists.map((item) => item.name ?? '').filter(Boolean).join(', ') || undefined,
  }
}

/**
 * Artist popularity by base62 artist ID. spclient returns artist gids rather
 * than base62 IDs, so callers usually already hold a hex gid — pass it through
 * `spclientArtistPopularityByGid` in that case.
 */
export async function fetchSpclientArtistPopularity(
  artistId: string,
  session: WebPlayerSession,
): Promise<number | undefined> {
  const entity = await spclientEntity('artist', artistId, session.token)
  return clampPopularity(entity?.popularity)
}

/** Same as above but for the 32-char hex gid spclient hands back on a track. */
export async function spclientArtistPopularityByGid(
  gid: string,
  token: string,
): Promise<number | undefined> {
  if (!/^[0-9a-f]{32}$/.test(gid)) return undefined
  for (const host of SPCLIENT_HOSTS) {
    try {
      const response = await fetch(`https://${host}/metadata/4/artist/${gid}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'User-Agent': WEB_PLAYER_USER_AGENT,
        },
      })
      if (response.status === 404) return undefined
      if (!response.ok) continue
      const entity = (await response.json().catch(() => null)) as SpclientEntity | null
      return clampPopularity(entity?.popularity)
    } catch {
      continue
    }
  }
  return undefined
}

/**
 * Every signal for one track: plays and release date from pathfinder, then
 * popularity from spclient. Each source is optional — a failure in one leaves
 * that field undefined rather than poisoning the others.
 */
export async function fetchPublicTrackStats(
  id: string,
  session: WebPlayerSession,
  options: { includePopularity?: boolean } = {},
): Promise<PublicTrackStats | null> {
  const includePopularity = options.includePopularity ?? true
  const [pathfinder, spclient] = await Promise.all([
    queryTrack(id, session.token).catch((error: unknown) => {
      if (error instanceof PublicStatsError) throw error
      return null
    }),
    includePopularity
      ? fetchSpclientTrack(id, session).catch((error: unknown) => {
          if (error instanceof PublicStatsError) throw error
          return null
        })
      : Promise.resolve(null),
  ])

  const base = pathfinder ?? (await releaseDateFromEmbed(id))
  if (!base && !spclient) return null

  return {
    id,
    title: base?.title ?? spclient?.title,
    artist: base?.artist ?? spclient?.artist,
    albumArt: base?.albumArt,
    playCount: base?.playCount,
    releaseDate: base?.releaseDate ?? spclient?.releaseDate,
    durationMs: base?.durationMs,
    popularity: spclient?.popularity,
    artistIds: spclient?.artistIds,
  }
}

export interface PublicSearchTrack {
  id: string
  title: string
  artist: string
  artistIds: string[]
  albumArt: string
  albumName?: string
  durationMs?: number
  explicit: boolean
}

interface SearchTrackNode {
  __typename?: string
  id?: string
  uri?: string
  name?: string
  duration?: { totalMilliseconds?: number }
  contentRating?: { label?: string }
  artists?: { items?: Array<{ uri?: string; profile?: { name?: string } }> }
  albumOfTrack?: {
    name?: string
    coverArt?: { sources?: Array<{ url?: string; width?: number }> }
  }
}

function idFromUri(uri: string | undefined): string {
  return typeof uri === 'string' ? (uri.split(':').pop() ?? '') : ''
}

/**
 * Track search through the same public web-player gateway as the play counts,
 * so admin search does not burn the Web API's quota.
 *
 * Note this response carries no preview URL and no play count; enrich with
 * `fetchPublicTrackStats` (or the Web API) when those are needed.
 */
export async function searchPublicTracks(
  query: string,
  session: WebPlayerSession,
  limit = 20,
): Promise<PublicSearchTrack[]> {
  const searchTerm = query.trim()
  if (!searchTerm) return []

  const data = await pathfinderQuery<{
    searchV2?: { tracksV2?: { items?: Array<{ item?: { data?: SearchTrackNode } }> } }
  }>(
    session.token,
    'searchTracks',
    {
      searchTerm,
      offset: 0,
      limit: Math.min(Math.max(limit, 1), 50),
      numberOfTopResults: 5,
      includeAudiobooks: true,
    },
    SEARCH_TRACKS_QUERY_HASH,
  )

  const items = data?.searchV2?.tracksV2?.items ?? []
  const results: PublicSearchTrack[] = []
  for (const entry of items) {
    const node = entry?.item?.data
    if (!node || (node.__typename && node.__typename !== 'Track')) continue
    const id = node.id ?? idFromUri(node.uri)
    if (!id) continue

    const artists = node.artists?.items ?? []
    const cover = [...(node.albumOfTrack?.coverArt?.sources ?? [])].sort(
      (left, right) => (right.width ?? 0) - (left.width ?? 0),
    )[0]?.url

    results.push({
      id,
      title: node.name ?? 'Unknown',
      artist: artists.map((item) => item.profile?.name ?? '').filter(Boolean).join(', '),
      artistIds: artists.map((item) => idFromUri(item.uri)).filter(Boolean),
      albumArt: cover ?? '',
      albumName: node.albumOfTrack?.name,
      durationMs: node.duration?.totalMilliseconds,
      explicit: node.contentRating?.label === 'EXPLICIT',
    })
  }
  return results
}

interface PlaylistTrackNode extends TrackUnion {
  __typename?: string
  id?: string
  uri?: string
}

/**
 * One request returns up to 100 tracks with their play counts, which is far
 * cheaper than per-track `getTrack` calls when importing a whole playlist.
 */
export async function fetchPlaylistTrackStats(
  playlistId: string,
  session: WebPlayerSession,
  limit = 100,
): Promise<PublicTrackStats[]> {
  const id = playlistId.trim()
  if (!id) return []

  const data = await pathfinderQuery<{
    playlistV2?: { content?: { items?: Array<{ itemV2?: { data?: PlaylistTrackNode } }> } }
  }>(
    session.token,
    'fetchPlaylist',
    { uri: `spotify:playlist:${id}`, offset: 0, limit: Math.min(Math.max(limit, 1), 100) },
    FETCH_PLAYLIST_QUERY_HASH,
  )

  const items = data?.playlistV2?.content?.items ?? []
  const stats: PublicTrackStats[] = []
  for (const entry of items) {
    const node = entry?.itemV2?.data
    if (!node || (node.__typename && node.__typename !== 'Track')) continue
    const trackId = node.id ?? idFromUri(node.uri)
    if (!trackId) continue
    stats.push(statsFromTrackUnion(trackId, node))
  }
  return stats
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms))
}

/**
 * Walks `ids` in small parallel chunks, refreshing the anonymous token when it
 * ages out and stopping early on 429 so we never hammer Spotify.
 */
export async function fetchPublicTrackStatsBatch(
  ids: string[],
  options: {
    session?: WebPlayerSession | null
    concurrency?: number
    chunkDelayMs?: number
    deadlineAt?: number
    log?: (message: string) => void
  } = {},
): Promise<PublicStatsBatchResult> {
  const result: PublicStatsBatchResult = {
    stats: [],
    attempted: 0,
    rateLimited: false,
    errors: [],
  }
  if (ids.length === 0) return result

  const concurrency = Math.max(1, options.concurrency ?? PUBLIC_STATS_CONCURRENCY)
  const chunkDelayMs = options.chunkDelayMs ?? PUBLIC_STATS_CHUNK_DELAY_MS
  let session = sessionIsUsable(options.session ?? null)
    ? (options.session as WebPlayerSession)
    : await openWebPlayerSession(ids[0])

  if (!session) {
    result.errors.push('Could not read an anonymous Spotify web-player token')
    return result
  }

  for (let index = 0; index < ids.length; index += concurrency) {
    if (options.deadlineAt != null && Date.now() >= options.deadlineAt) {
      options.log?.(`Time budget reached after ${index} tracks`)
      break
    }
    if (!sessionIsUsable(session)) {
      const refreshed = await openWebPlayerSession(ids[index])
      if (!refreshed) {
        result.errors.push('Anonymous Spotify web-player token could not be refreshed')
        break
      }
      session = refreshed
    }

    const chunk = ids.slice(index, index + concurrency)
    const active = session
    const rows = await Promise.all(
      chunk.map(async (id) => {
        result.attempted += 1
        try {
          return await fetchPublicTrackStats(id, active)
        } catch (error) {
          return error instanceof PublicStatsError ? error : null
        }
      }),
    )

    let blocked = false
    for (const row of rows) {
      if (row instanceof PublicStatsError) {
        blocked = true
        if (row.status === 429) result.rateLimited = true
        if (!result.errors.includes(row.message)) result.errors.push(row.message)
        continue
      }
      if (row) result.stats.push(row)
    }
    if (blocked) {
      options.log?.(`Spotify web player pushed back after ${result.stats.length} tracks; stopping`)
      break
    }

    if (chunkDelayMs > 0) await sleep(chunkDelayMs)
  }

  await attachArtistPopularity(result.stats, session, options.log)
  return result
}

/**
 * Fills `artistPopularity` for every track, looking each artist up once per run.
 * Catalogs repeat artists heavily, so this is a handful of extra requests rather
 * than one per track. Failures are silent: the signal is optional.
 */
async function attachArtistPopularity(
  stats: PublicTrackStats[],
  session: WebPlayerSession,
  log?: (message: string) => void,
): Promise<void> {
  const gids = new Set<string>()
  for (const item of stats) {
    for (const gid of item.artistIds ?? []) gids.add(gid)
  }
  if (gids.size === 0) return

  const popularityByGid = new Map<string, number>()
  const list = [...gids]
  for (let index = 0; index < list.length; index += PUBLIC_STATS_CONCURRENCY) {
    const chunk = list.slice(index, index + PUBLIC_STATS_CONCURRENCY)
    const values = await Promise.all(
      chunk.map((gid) => spclientArtistPopularityByGid(gid, session.token).catch(() => undefined)),
    )
    chunk.forEach((gid, position) => {
      const value = values[position]
      if (value != null) popularityByGid.set(gid, value)
    })
  }

  for (const item of stats) {
    let best: number | undefined
    for (const gid of item.artistIds ?? []) {
      const value = popularityByGid.get(gid)
      if (value == null) continue
      best = best == null ? value : Math.max(best, value)
    }
    if (best != null) item.artistPopularity = best
  }
  log?.(`Artist popularity resolved for ${popularityByGid.size}/${gids.size} artists`)
}
