#!/bin/bash
# SessionStart hook for Claude Code on the web.
#
# A fresh remote container is a clean clone of the repo. `node_modules` is
# gitignored, so it is absent on startup and `vitest` / `tsc` fail with
# "Cannot find package ..." errors. This installs JS dependencies for the
# projects that have tests and linters (backend + frontend) so they work
# out of the box.
#
# Idempotent (safe to re-run) and non-interactive. Verbose npm output is
# sent to a log so it does not pollute the session context; only a short
# status line is printed.
set -euo pipefail

# Only run in the remote (Claude Code on the web) environment. Locally,
# developers manage their own dependencies.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# Repo root: prefer the value Claude provides, otherwise derive it from this
# script's location (.claude/hooks/session-start.sh -> repo root).
ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
LOG="$(mktemp)"

install_deps() {
  local dir="$1"
  [ -f "$ROOT/$dir/package.json" ] || return 0
  printf 'Installing %s dependencies...\n' "$dir"
  if ! ( cd "$ROOT/$dir" && npm install --no-fund --no-audit ) >>"$LOG" 2>&1; then
    printf 'npm install failed in %s:\n' "$dir" >&2
    tail -n 30 "$LOG" >&2
    exit 1
  fi
}

install_deps backend
install_deps frontend

printf 'Dependencies installed (backend, frontend). Tests and linters are ready.\n'
