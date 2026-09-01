const TOKEN_URL = 'https://accounts.spotify.com/api/token'

interface TokenResponse {
  access_token: string
  token_type: string
  scope: string
  expires_in: number
  refresh_token?: string
}

async function postToken(
  body: Record<string, string>,
  clientId: string,
  clientSecret: string,
): Promise<TokenResponse> {
  const auth = btoa(`${clientId}:${clientSecret}`)
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(body),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Spotify token error: ${response.status} ${text.slice(0, 200)}`)
  }

  return response.json() as Promise<TokenResponse>
}

export async function exchangeSpotifyCode(
  code: string,
  redirectUri: string,
  codeVerifier: string,
  clientId: string,
  clientSecret: string,
) {
  return postToken(
    {
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    },
    clientId,
    clientSecret,
  )
}

export async function refreshSpotifyToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
) {
  return postToken(
    {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    },
    clientId,
    clientSecret,
  )
}

export async function fetchSpotifyProfile(accessToken: string) {
  const response = await fetch('https://api.spotify.com/v1/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) {
    throw new Error(`Spotify profile error: ${response.status}`)
  }
  return response.json() as Promise<{ product?: string; display_name?: string }>
}
