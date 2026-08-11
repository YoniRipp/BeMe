#!/usr/bin/env node
/**
 * PreToolUse hook: block force-pushes.
 *
 * Claude Code passes the tool call as JSON on stdin.
 * Exit 2 blocks the call and shows stderr to the agent; exit 0 allows it.
 *
 * Both the JSON parse and the force detection must be exact:
 *   - Parsing with line/comma splitting truncates commands that contain commas,
 *     which lets `git commit -m "a, b" && git push --force` through.
 *   - Testing for force flags across the whole compound command rejects
 *     `rm -f x && git push`, which is not a force push.
 * So: parse real JSON, then check each shell segment independently.
 */
import { readFileSync } from 'node:fs';

const allow = () => process.exit(0);

let payload;
try {
  payload = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  allow(); // Unparseable payload: not our call to block.
}

const command = payload?.tool_input?.command;
if (typeof command !== 'string' || !command.trim()) allow();

// Split a compound command into individually-executed segments.
const segments = command.split(/&&|\|\||[;\n|]/);

const FORCE_FLAG = /(?:^|\s)(?:-f|--force|--force-with-lease(?:=\S*)?|--force-if-includes)(?:\s|$)/;
// `git push origin +main` is a force push via refspec.
const FORCE_REFSPEC = /(?:^|\s)\+[^\s]+:[^\s]+|(?:^|\s)\+[A-Za-z0-9._\/-]+(?:\s|$)/;

for (const segment of segments) {
  const s = segment.trim();
  if (!/\bgit\b/.test(s) || !/\bpush\b/.test(s)) continue;

  if (FORCE_FLAG.test(s) || FORCE_REFSPEC.test(s)) {
    process.stderr.write(
      `BLOCKED: force-pushing is not allowed in this repo.\n` +
        `  Offending command: ${s}\n` +
        `If a branch genuinely needs rewriting, ask the user to do it manually.\n`,
    );
    process.exit(2);
  }
}

allow();
