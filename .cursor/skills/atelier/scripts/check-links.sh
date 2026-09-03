#!/usr/bin/env bash
# Validate the atelier skill tree: one SKILL.md, frontmatter names match folders, line limits, relative links resolve.
# Usage: scripts/check-links.sh   (run from anywhere; resolves the atelier root from this file)
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fail=0

n=$(find "$ROOT" -name SKILL.md | wc -l | tr -d ' ')
if [ "$n" != "1" ]; then echo "FAIL: expected exactly one SKILL.md under atelier, found $n"; fail=1; else echo "ok   one SKILL.md"; fi

check_front() {
  local f="$1" folder
  folder="$(basename "$(dirname "$f")")"
  local name
  name="$(awk 'NR==1 && $0!="---"{exit} /^name:/{sub(/^name: */,""); print; exit}' "$f")"
  if [ -z "$name" ]; then echo "FAIL: $f has no name in frontmatter"; fail=1; return; fi
  if [ "$name" != "$folder" ]; then echo "FAIL: $f name '$name' does not match folder '$folder'"; fail=1; else echo "ok   frontmatter $f"; fi
  if ! grep -q '^description:' "$f"; then echo "FAIL: $f has no description"; fail=1; fi
}
check_front "$ROOT/SKILL.md"
for f in "$ROOT"/departments/*/PLAYBOOK.md; do check_front "$f"; done

while IFS= read -r f; do
  lines=$(wc -l < "$f" | tr -d ' ')
  case "$f" in
    */SKILL.md|*/PLAYBOOK.md) limit=500 ;;   # spec ceiling; house target is 350 for playbooks
    */references/*) limit=450 ;;
    *) limit=100000 ;;
  esac
  if [ "$lines" -gt "$limit" ]; then echo "FAIL: $f is $lines lines (limit $limit)"; fail=1; fi
  if grep -qP '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]' "$f" 2>/dev/null; then echo "FAIL: $f contains an emoji"; fail=1; fi
done < <(find "$ROOT" -name '*.md')
echo "ok   line limits and emoji scan"

# Relative links and backticked paths that look like files inside the atelier.
BT=$(printf '\140')
while IFS= read -r f; do
  dir="$(dirname "$f")"
  while read -r link; do
    [ -n "$link" ] || continue
    [ -e "$dir/$link" ] || { echo "FAIL: $f links to missing $link"; fail=1; }
  done < <(grep -oE '\]\(([^)#]+)\)' "$f" | sed -E 's/^\]\((.*)\)$/\1/' | grep -vE '^(https?:|mailto:)' || true)
  while read -r p; do
    [ -n "$p" ] || continue
    if [ -e "$dir/$p" ] || [ -e "$ROOT/$p" ]; then :; else echo "FAIL: $f mentions missing path $p"; fail=1; fi
  done < <(grep -oE "${BT}(\.\./|\./)?(departments|scripts|templates|references|casework)/[A-Za-z0-9_./-]+${BT}" "$f" | tr -d "$BT" | sort -u || true)
done < <(find "$ROOT" -name '*.md')
echo "ok   path references"

for s in "$ROOT"/scripts/*.mjs; do node --check "$s" || fail=1; done
python3 -m py_compile "$ROOT/scripts/contrast.py" || fail=1
echo "ok   scripts parse"

if [ "$fail" = "0" ]; then echo "ALL CHECKS PASSED"; else echo "CHECKS FAILED"; exit 1; fi
