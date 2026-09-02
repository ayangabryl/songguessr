#!/usr/bin/env bash
# Print the public dev-server URL from Vite logs (for phone preview).
set -euo pipefail

LOG="${1:-/tmp/dev-server.log}"
URL="$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com/?' "$LOG" 2>/dev/null | tail -1 | sed 's:/$::')"

if [[ -z "$URL" ]]; then
  echo "No tunnel URL found yet. Start the dev server with ./scripts/cloud-agent-start.sh" >&2
  echo "and wait for: Tunnel: https://....trycloudflare.com/" >&2
  exit 1
fi

echo "$URL"
