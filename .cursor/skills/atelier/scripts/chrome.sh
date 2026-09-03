#!/usr/bin/env bash
# Start headless Chrome with the DevTools Protocol on 127.0.0.1:9222 for the atelier scripts.
# Usage: scripts/chrome.sh [port]
# Reuses a running instance when the port already answers. Logs to /tmp/atelier-chrome.log.
set -euo pipefail
PORT="${1:-9222}"

if curl -fsS "http://127.0.0.1:${PORT}/json/version" >/dev/null 2>&1; then
  echo "Chrome already listening on ${PORT}"
  exit 0
fi

BIN=""
for c in google-chrome google-chrome-stable chromium chromium-browser chrome; do
  if command -v "$c" >/dev/null 2>&1; then BIN="$c"; break; fi
done
if [ -z "$BIN" ] && [ -x "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ]; then
  BIN="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
fi
if [ -z "$BIN" ]; then
  echo "No Chrome or Chromium binary found on PATH. Install Chrome, or set BIN in this script." >&2
  exit 1
fi

PROFILE="$(mktemp -d /tmp/atelier-chrome-profile.XXXXXX)"
nohup "$BIN" \
  --headless=new \
  --remote-debugging-port="${PORT}" \
  --remote-allow-origins='*' \
  --user-data-dir="${PROFILE}" \
  --no-first-run --no-default-browser-check \
  --disable-gpu --hide-scrollbars \
  --window-size=1440,900 \
  about:blank >/tmp/atelier-chrome.log 2>&1 &

for _ in $(seq 1 40); do
  if curl -fsS "http://127.0.0.1:${PORT}/json/version" >/dev/null 2>&1; then
    echo "Chrome listening on ${PORT} (profile ${PROFILE})"
    exit 0
  fi
  sleep 0.25
done
echo "Chrome did not answer on ${PORT} within 10 s. See /tmp/atelier-chrome.log" >&2
exit 1
