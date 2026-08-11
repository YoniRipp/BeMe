#!/usr/bin/env bash
# PostToolUse hook: typecheck the package that was just edited.
#
# Claude Code passes the tool call as JSON on stdin. We pull out the edited
# file path and run tsc in that package only -- there is no root tsconfig.json,
# so running tsc at the repo root does nothing useful.
#
# Always exits 0: this reports type errors, it does not block the edit.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

payload="$(cat)"

# Extract tool_input.file_path without requiring jq.
file_path="$(printf '%s' "$payload" \
  | tr ',' '\n' \
  | grep -m1 '"file_path"' \
  | sed 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')"

[ -z "$file_path" ] && exit 0

case "$file_path" in
  *.ts|*.tsx) ;;
  *) exit 0 ;;
esac

case "$file_path" in
  "$ROOT"/backend/*|backend/*) pkg="backend" ;;
  "$ROOT"/frontend/*|frontend/*) pkg="frontend" ;;
  "$ROOT"/mobile/*|mobile/*) pkg="mobile" ;;
  *) exit 0 ;;
esac

[ -f "$ROOT/$pkg/tsconfig.json" ] || exit 0

cd "$ROOT/$pkg" || exit 0
output="$(npx tsc --noEmit --pretty 2>&1 | head -20)"

if [ -n "$output" ]; then
  echo "[typecheck: $pkg]"
  echo "$output"
fi

exit 0
