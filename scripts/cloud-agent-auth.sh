#!/usr/bin/env bash
# Phone-friendly Cloudflare login (OAuth device flow).
# Open the URL on your phone, enter the code, approve — no API token needed.
set -euo pipefail

cd "$(dirname "$0")/.."

is_cloudflare_authenticated() {
  local out
  out="$(npx wrangler whoami 2>&1)" || return 1
  ! grep -q 'You are not authenticated' <<<"$out"
}

if is_cloudflare_authenticated; then
  echo "Already logged in to Cloudflare:"
  npx wrangler whoami
  exit 0
fi

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  Cloudflare login (works from your phone)"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "  1. On your phone, open:"
echo "     https://dash.cloudflare.com/oauth2/device/verify"
echo ""
echo "  2. Enter the code below when prompted:"
echo ""

exec npx wrangler login --device --browser=false
