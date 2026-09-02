#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

ensure_cloudflare_auth() {
  local out
  out="$(npx wrangler whoami 2>&1)" || true
  if grep -q 'You are not authenticated' <<<"$out"; then
    echo ""
    echo "Cloudflare login required for remote R2 + D1 (same as production)."
    echo "Use your phone — no API token needed."
    echo ""
    ./scripts/cloud-agent-auth.sh
  fi
}

ensure_cloudflare_auth

exec npm run dev
