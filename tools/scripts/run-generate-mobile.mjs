#!/usr/bin/env node
/**
 * Wrapper for catalog mobile generators that normalizes --fiId before invoking Nx.
 *
 * - Accepts 4- or 5-digit numeric FI ids (digits only).
 * - Re-emits fiId as a separate argv string so leading zeros are preserved (e.g. 03100).
 * - After generate/widget/feature:
 *   - FI pnpm workspaces: `pnpm install --lockfile-only` at repo root when
 *     `pnpm-lock.yaml` and `pnpm-workspace.yaml` both exist.
 *   - Apps repo (split install): sync `playground/mobile-sandbox` lockfile via
 *     `sync-mobile-sandbox-if-needed.mjs` (same logic as nx start mobile-sandbox).
 *
 * Note: do not import from templates/mobile — that tree is not synced to the public apps repo.
 */
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(scriptDir, '../..');

export const NUMERIC_FI_SCOPE_MIN_WIDTH = 4;
export const NUMERIC_FI_SCOPE_MAX_WIDTH = 5;
export const FI_ID_STRING_PREFIX = 'str:';

function padNumericScopeSegment(value) {
  return value.padStart(Math.max(NUMERIC_FI_SCOPE_MIN_WIDTH, value.length), '0');
}

// Local copy of the generator-side helper in templates/mobile/tools/lib/naming
// (that tree is not imported here — it is not synced to the public apps repo).
function stripFiIdStringPrefix(value) {
  return value.startsWith(FI_ID_STRING_PREFIX)
    ? value.slice(FI_ID_STRING_PREFIX.length)
    : value;
}

export function normalizeFiScope(fiId) {
  if (fiId === undefined || fiId === null) return '';
  if (typeof fiId === 'number') {
    if (!Number.isFinite(fiId) || fiId < 0) return '';
    const base = String(Math.trunc(fiId));
    return padNumericScopeSegment(base);
  }
  const s = stripFiIdStringPrefix(String(fiId).trim());
  if (!s || !/^\d+$/.test(s)) return '';
  return padNumericScopeSegment(s);
}

export function assertValidFiScope(fiId) {
  const scope = normalizeFiScope(fiId);
  if (!scope) {
    throw new Error(
      'FI Id must be digits only (0-9). No letters, hyphens, spaces, or other symbols.',
    );
  }
  if (
    scope.length < NUMERIC_FI_SCOPE_MIN_WIDTH ||
    scope.length > NUMERIC_FI_SCOPE_MAX_WIDTH
  ) {
    throw new Error(
      `FI Id must be ${NUMERIC_FI_SCOPE_MIN_WIDTH} or ${NUMERIC_FI_SCOPE_MAX_WIDTH} digits (got "${scope}").`,
    );
  }
  return scope;
}

/** True when passing the raw token to Nx/yargs would drop leading zeros after numeric coercion. */
export function needsFiIdStringPrefix(raw) {
  if (raw === undefined || raw === null) return false;
  const s = String(raw).trim();
  if (!/^\d+$/.test(s)) return false;
  const asNumber = String(Number(s));
  return padNumericScopeSegment(asNumber) !== padNumericScopeSegment(s);
}

/** Nx/yargs-safe argv token. Generators must strip `str:` (SDK PR #571). */
export function formatFiIdForNxArgv(scope) {
  return needsFiIdStringPrefix(scope) ? `${FI_ID_STRING_PREFIX}${scope}` : scope;
}

function usage() {
  console.error(`Usage: node tools/scripts/run-generate-mobile.mjs <generator> [nx args...]

Generators: generate | widget | feature | list
`);
}

export function rewriteFiIdArgs(argv) {
  const out = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg.startsWith('--fiId=')) {
      const value = formatFiIdForNxArgv(
        assertValidFiScope(arg.slice('--fiId='.length)),
      );
      out.push('--fiId', value);
      continue;
    }

    if (arg === '--fiId') {
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        throw new Error('Missing value for --fiId');
      }
      const value = formatFiIdForNxArgv(assertValidFiScope(next));
      out.push('--fiId', value);
      i += 1;
      continue;
    }

    out.push(arg);
  }
  return out;
}

function syncRootLockfileIfPnpmWorkspace() {
  const lockfile = path.join(REPO_ROOT, 'pnpm-lock.yaml');
  const workspace = path.join(REPO_ROOT, 'pnpm-workspace.yaml');
  if (!existsSync(lockfile) || !existsSync(workspace)) {
    return 0;
  }

  const result = spawnSync('pnpm', ['install', '--lockfile-only'], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    env: process.env,
  });
  return result.status ?? 1;
}

function syncMobileSandboxIfNeeded() {
  const script = path.join(REPO_ROOT, 'tools/scripts/sync-mobile-sandbox-if-needed.mjs');
  if (!existsSync(script)) {
    return 0;
  }

  const result = spawnSync('node', [script], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    env: process.env,
  });
  return result.status ?? 1;
}

function main() {
  const generator = process.argv[2];
  const allowed = new Set(['generate', 'widget', 'feature', 'list']);
  if (!generator || !allowed.has(generator)) {
    usage();
    process.exit(1);
  }

  let forwarded;
  try {
    forwarded = rewriteFiIdArgs(process.argv.slice(3));
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  const result = spawnSync(
    'nx',
    [
      'g',
      `@cdx-extensions/extension-generator-mobile:${generator}`,
      ...forwarded,
    ],
    {
      cwd: REPO_ROOT,
      stdio: 'inherit',
      env: process.env,
    },
  );

  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }

  if (generator !== 'list') {
    const lockfileStatus = syncRootLockfileIfPnpmWorkspace();
    if (lockfileStatus !== 0) {
      process.exit(lockfileStatus);
    }

    const sandboxStatus = syncMobileSandboxIfNeeded();
    if (sandboxStatus !== 0) {
      process.exit(sandboxStatus);
    }
  }

  process.exit(0);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
