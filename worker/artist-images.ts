import {
  fetchSpotifyArtistEmbedImage,
  fetchSpotifyArtistOembed,
  isSpotifyArtistPortrait,
} from './album-art'
import { openWebPlayerSession, searchPublicTracks, type WebPlayerSession } from './spotify-public-stats'

const HYDRATE_CAP = 16
const ID_SEARCH_CAP = 8
const SPOTIFY_ID = /^[0-9A-Za-z]{22}$/

export interface ArtistPortraitHit {
  id?: string
  name: string
  imageUrl?: string | null
}

async function resolveArtistIdFromPublicSearch(
  name: string,
  session: WebPlayerSession,
): Promise<string | null> {
  const needle = name.trim().toLowerCase()
  if (!needle) return null
  const tracks = await searchPublicTracks(name, session, 8)

  for (const track of tracks) {
    const artists = track.artist.split(',').map((part) => part.trim())
    const index = artists.findIndex((artist) => artist.toLowerCase() === needle)
    const id = track.artistIds[index]
    if (index >= 0 && id && SPOTIFY_ID.test(id)) return id
  }
  for (const track of tracks) {
    const artists = track.artist.split(',').map((part) => part.trim())
    const index = artists.findIndex(
      (artist) => artist.toLowerCase().includes(needle) || needle.includes(artist.toLowerCase()),
    )
    const id = track.artistIds[index]
    if (index >= 0 && id && SPOTIFY_ID.test(id)) return id
  }
  return null
}

export async function resolveArtistPortrait(hit: ArtistPortraitHit): Promise<string | null> {
  if (isSpotifyArtistPortrait(hit.imageUrl)) return hit.imageUrl ?? null
  if (hit.id && SPOTIFY_ID.test(hit.id)) {
    const oembed = await fetchSpotifyArtistOembed(hit.id)
    if (oembed) return oembed
    const embed = await fetchSpotifyArtistEmbedImage(hit.id)
    if (embed) return embed
  }
  return null
}

export async function hydrateArtistPortraits<T extends ArtistPortraitHit>(
  db: D1Database,
  hits: T[],
): Promise<T[]> {
  for (const hit of hits) {
    if (hit.imageUrl && !isSpotifyArtistPortrait(hit.imageUrl)) hit.imageUrl = null
  }

  const missing = hits.filter((hit) => !isSpotifyArtistPortrait(hit.imageUrl)).slice(0, HYDRATE_CAP)
  if (missing.length === 0) return hits

  const needsId = missing.filter((hit) => !hit.id || !SPOTIFY_ID.test(hit.id))
  if (needsId.length > 0) {
    try {
      const placeholders = needsId.map(() => '?').join(', ')
      const rows = await db
        .prepare(
          `SELECT id, name FROM artists WHERE whitelisted = 1 AND lower(name) IN (${placeholders})`,
        )
        .bind(...needsId.map((hit) => hit.name.toLowerCase()))
        .all<{ id: string; name: string }>()
      const byName = new Map(
        (rows.results ?? []).map((row) => [row.name.toLowerCase(), row.id] as const),
      )
      for (const hit of needsId) {
        const id = byName.get(hit.name.toLowerCase())
        if (id) hit.id = id
      }
    } catch {
      // Older local DBs may not have artists.
    }
  }

  const stillNeedsId = missing
    .filter((hit) => !hit.id || !SPOTIFY_ID.test(hit.id))
    .slice(0, ID_SEARCH_CAP)
  if (stillNeedsId.length > 0) {
    const session = await openWebPlayerSession().catch(() => null)
    if (session) {
      for (const hit of stillNeedsId) {
        const id = await resolveArtistIdFromPublicSearch(hit.name, session).catch(() => null)
        if (id) hit.id = id
      }
    }
  }

  const resolved = await Promise.all(
    missing.map(async (hit) => {
      const imageUrl = await resolveArtistPortrait(hit)
      return { hit, imageUrl }
    }),
  )

  const now = new Date().toISOString()
  const writes: D1PreparedStatement[] = []
  for (const { hit, imageUrl } of resolved) {
    if (!isSpotifyArtistPortrait(imageUrl)) {
      hit.imageUrl = null
      continue
    }
    hit.imageUrl = imageUrl
    if (hit.id) {
      writes.push(
        db
          .prepare(`UPDATE artists SET image_url = ?, updated_at = ? WHERE id = ?`)
          .bind(imageUrl, now, hit.id),
      )
    } else {
      writes.push(
        db
          .prepare(`UPDATE artists SET image_url = ?, updated_at = ? WHERE lower(name) = lower(?)`)
          .bind(imageUrl, now, hit.name),
      )
    }
  }
  if (writes.length > 0) {
    await db.batch(writes).catch(() => undefined)
  }
  return hits
}
