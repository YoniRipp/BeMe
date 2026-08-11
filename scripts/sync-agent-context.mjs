#!/usr/bin/env node
/**
 * Generates AGENTS.md from the shared section of CLAUDE.md.
 *
 * CLAUDE.md is the source of truth. Everything between the AGENT-CONTEXT
 * markers is shared by every coding agent; each tool then gets its own footer.
 *
 * Run: npm run sync:agents
 * Check without writing (CI): npm run sync:agents -- --check
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(ROOT, 'CLAUDE.md');
const TARGET = join(ROOT, 'AGENTS.md');

const START = '<!-- AGENT-CONTEXT:START -->';
const END = '<!-- AGENT-CONTEXT:END -->';

const source = readFileSync(SOURCE, 'utf8');
const start = source.indexOf(START);
const end = source.indexOf(END);

if (start === -1 || end === -1) {
  console.error(`sync-agent-context: missing ${START} / ${END} markers in CLAUDE.md`);
  process.exit(1);
}

const shared = source.slice(start + START.length, end).trim();

const generated = `<!-- GENERATED FILE — do not edit directly.
     Source: CLAUDE.md (between the AGENT-CONTEXT markers).
     Regenerate with: npm run sync:agents -->

${shared}

## Tool configuration

Agent profiles, slash commands, hooks, and permissions live in \`.claude/\` — that is where the files are on disk regardless of which agent reads them. The Agent OS standards in \`agent-os/\` are plain markdown and are readable by any agent.

If your tool has no slash-command support, read the relevant \`agent-os/standards/\` files directly instead of running \`/inject-standards\`. \`agent-os/standards/index.yml\` lists what exists.
`;

const isCheck = process.argv.includes('--check');

if (isCheck) {
  let current = '';
  try {
    current = readFileSync(TARGET, 'utf8');
  } catch {
    console.error('sync-agent-context: AGENTS.md missing. Run: npm run sync:agents');
    process.exit(1);
  }
  if (current !== generated) {
    console.error('sync-agent-context: AGENTS.md is out of date. Run: npm run sync:agents');
    process.exit(1);
  }
  console.log('sync-agent-context: AGENTS.md is up to date.');
} else {
  writeFileSync(TARGET, generated);
  console.log('sync-agent-context: wrote AGENTS.md from CLAUDE.md');
}
