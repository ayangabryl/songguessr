#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

npm ci

# Spotify app credentials (optional at install — game/catalog from R2 works without them).
if [[ -n "${SPOTIFY_CLIENT_ID:-}" && -n "${SPOTIFY_CLIENT_SECRET:-}" ]]; then
  umask 077
  cat > .dev.vars <<EOF
SPOTIFY_CLIENT_ID=${SPOTIFY_CLIENT_ID}
SPOTIFY_CLIENT_SECRET=${SPOTIFY_CLIENT_SECRET}
EOF
  echo "Wrote .dev.vars (Spotify credentials)."
else
  echo "Note: SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET not set."
  echo "      Game + catalog from R2/D1 still work; Spotify connect and admin search need these later."
fi
