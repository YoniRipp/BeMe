#!/usr/bin/env node
/**
 * PostToolUse hook: typecheck the package that was just edited.
 *
 * There is no root tsconfig.json, so a typecheck at the repo root does
 * nothing useful -- resolve the owning package and run its own lint script
 * (`tsc --noEmit`, using the package-local binary) there instead.
 *
 * Always exits 0: this reports type errors, it does not block the edit.
 */
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, isAbsolute } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PACKAGES = ['backend', 'frontend', 'mobile'];
const TIMEOUT_MS = 120_000;

let payload;
try {
  payload = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  process.exit(0);
}

const filePath = payload?.tool_input?.file_path;
if (typeof filePath !== 'string' || !/\.tsx?$/.test(filePath)) process.exit(0);

const rel = isAbsolute(filePath) ? relative(ROOT, filePath) : filePath;
if (rel.startsWith('..')) process.exit(0); // Outside the repo.

const pkg = PACKAGES.find((p) => rel === p || rel.startsWith(`${p}/`));
if (!pkg) process.exit(0);

const pkgDir = join(ROOT, pkg);
if (!existsSync(join(pkgDir, 'tsconfig.json'))) process.exit(0);
if (!existsSync(join(pkgDir, 'node_modules'))) process.exit(0); // Deps not installed yet.

let script = 'lint';
try {
  const manifest = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
  if (!manifest.scripts?.lint) script = null;
} catch {
  script = null;
}

const result = script
  ? spawnSync('npm', ['run', '--silent', script], {
      cwd: pkgDir,
      encoding: 'utf8',
      timeout: TIMEOUT_MS,
      shell: process.platform === 'win32',
    })
  : spawnSync('./node_modules/.bin/tsc', ['--noEmit', '--pretty'], {
      cwd: pkgDir,
      encoding: 'utf8',
      timeout: TIMEOUT_MS,
    });

if (result.error?.code === 'ETIMEDOUT') {
  console.log(`[typecheck: ${pkg}] timed out after ${TIMEOUT_MS / 1000}s — run \`npm run lint\` in ${pkg}/ manually.`);
  process.exit(0);
}

if (result.status !== 0) {
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
  if (output) {
    console.log(`[typecheck: ${pkg}]`);
    console.log(output.split('\n').slice(0, 20).join('\n'));
  }
}

process.exit(0);
