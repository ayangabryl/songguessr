#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  echo "CLOUDFLARE_API_TOKEN must be set as an environment secret for remote R2/D1 bindings." >&2
  exit 1
fi

if [[ ! -f .dev.vars ]]; then
  echo ".dev.vars missing — run cloud-agent-install.sh first." >&2
  exit 1
fi

exec npm run dev
