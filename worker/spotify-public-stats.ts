/**
 * Play count and release date from Spotify's public web player.
 *
 * The official Web API has no listen count, and `GET /v1/tracks` is quota-blocked
 * for this app. The open.spotify.com embed page ships an anonymous web-player
 * access token in `__NEXT_DATA__`; that token can read the same undocumented
 * pathfinder GraphQL query the public track page uses, which returns `playcount`
 * and the album release date.
 *
 * This is unofficial and can break without notice. Keep the request rate low,
 * cache results in D1, and never invent a number when the query fails.
 */

const WEB_PLAYER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

const PATHFINDER_URL = 'https://api-partner.spotify.com/pathfinder/v1/query'
/** Persisted-query hash for the web player's `getTrack` operation. */
const GET_TRACK_QUERY_HASH = '5c5ec8c973a0ac2d5b38d7064056c45103c5a062ee12b62ce683ab397b5fbe7d'

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

export interface PublicTrackStats {
  id: string
  title?: string
  artist?: string
  albumArt?: string
  playCount?: number
  releaseDate?: string
  durationMs?: number
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

async function queryTrack(id: string, token: string): Promise<PublicTrackStats | null> {
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
      operationName: 'getTrack',
      variables: { uri: `spotify:track:${id}` },
      extensions: { persistedQuery: { version: 1, sha256Hash: GET_TRACK_QUERY_HASH } },
    }),
  })

  if (response.status === 401 || response.status === 403 || response.status === 429) {
    throw new PublicStatsError(`Spotify web player returned ${response.status}`, response.status)
  }
  if (!response.ok) return null

  const payload = (await response.json().catch(() => null)) as {
    data?: { trackUnion?: TrackUnion & { __typename?: string } }
  } | null
  const track = payload?.data?.trackUnion
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

export async function fetchPublicTrackStats(
  id: string,
  session: WebPlayerSession,
): Promise<PublicTrackStats | null> {
  const fromPathfinder = await queryTrack(id, session.token)
  if (fromPathfinder) return fromPathfinder
  return releaseDateFromEmbed(id)
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

  return result
}
