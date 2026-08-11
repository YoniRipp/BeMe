#!/usr/bin/env bash
# PreToolUse hook: block force-pushes.
#
# Claude Code passes the tool call as JSON on stdin. Exit code 2 blocks the
# tool call and shows stderr to the agent; exit 0 allows it.

set -uo pipefail

payload="$(cat)"

command_str="$(printf '%s' "$payload" \
  | tr ',' '\n' \
  | grep -m1 '"command"' \
  | sed 's/.*"command"[[:space:]]*:[[:space:]]*"\(.*\)".*/\1/')"

[ -z "$command_str" ] && exit 0

# Only care about git push. Match --force, -f, and --force-with-lease.
case "$command_str" in
  *git*push*)
    if printf '%s' "$command_str" | grep -Eq '(--force|--force-with-lease|[[:space:]]-f([[:space:]]|$))'; then
      echo "BLOCKED: force-pushing is not allowed in this repo." >&2
      echo "If a branch genuinely needs rewriting, ask the user to do it manually." >&2
      exit 2
    fi
    ;;
esac

exit 0
