const PLAYLIST_URL =
  'https://open.spotify.com/playlist/37i9dQZEVXbNBz9cRCSFkY?si=Z-cIomNrSy2dlr8snfrGLA'
const ADMIN_ORIGIN = process.env.ADMIN_ORIGIN ?? 'https://admin.songguessr.lol'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'wizard123'

async function request(path, init = {}, cookie = '') {
  const response = await fetch(`${ADMIN_ORIGIN}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
      ...(init.headers ?? {}),
    },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error ?? `Request failed (${response.status})`)
  }
  return { data, response }
}

function readSessionCookie(response) {
  const raw = response.headers.getSetCookie?.() ?? response.headers.get('set-cookie')
  const cookies = Array.isArray(raw) ? raw : raw ? [raw] : []
  const session = cookies.find((value) => value.startsWith('songguessr_admin='))
  return session ? session.split(';')[0] : ''
}

async function main() {
  const login = await request('/api/login', {
    method: 'POST',
    body: JSON.stringify({ password: ADMIN_PASSWORD }),
  })
  const cookie = readSessionCookie(login.response)
  if (!cookie) throw new Error('Admin login did not return a session cookie')

  const started = await request(
    '/api/catalog/playlist',
    {
      method: 'POST',
      body: JSON.stringify({
        playlistUrl: PLAYLIST_URL,
        country: 'PH',
        catalog: 'opm',
        assumeAllLocal: false,
        wait: true,
      }),
    },
    cookie,
  )

  console.log(JSON.stringify(started.data, null, 2))
}

await main()
