#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

npm ci

if [[ -z "${SPOTIFY_CLIENT_ID:-}" || -z "${SPOTIFY_CLIENT_SECRET:-}" ]]; then
  echo "SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET must be set as environment secrets." >&2
  exit 1
fi

umask 077
cat > .dev.vars <<EOF
SPOTIFY_CLIENT_ID=${SPOTIFY_CLIENT_ID}
SPOTIFY_CLIENT_SECRET=${SPOTIFY_CLIENT_SECRET}
EOF

echo "Wrote .dev.vars for wrangler dev (Spotify credentials)."
