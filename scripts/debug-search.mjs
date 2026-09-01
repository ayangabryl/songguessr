import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function loadEnvFile() {
  const envPath = resolve(process.cwd(), '.env.local')
  const content = readFileSync(envPath, 'utf8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    if (!process.env[key]) process.env[key] = value
  }
}

loadEnvFile()

const auth = Buffer.from(
  `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`,
).toString('base64')

const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
  method: 'POST',
  headers: {
    Authorization: `Basic ${auth}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: new URLSearchParams({ grant_type: 'client_credentials' }),
})

const { access_token: token } = await tokenResponse.json()
const searchUrl = new URL('https://api.spotify.com/v1/search')
searchUrl.searchParams.set('q', 'Ben&Ben')
searchUrl.searchParams.set('type', 'track')
searchUrl.searchParams.set('limit', '3')

const searchResponse = await fetch(searchUrl, {
  headers: { Authorization: `Bearer ${token}` },
})

const searchData = await searchResponse.json()
for (const track of searchData.tracks?.items ?? []) {
  console.log(track.id, track.name, 'preview_url=', track.preview_url)
}
