#!/usr/bin/env node
/**
 * Wrapper for catalog mobile generators that normalizes --fiId before invoking Nx.
 *
 * - Accepts 4- or 5-digit numeric FI ids (digits only).
 * - Re-emits fiId as a separate argv string so leading zeros are preserved (e.g. 03100).
 *
 * Note: do not import from templates/mobile — that tree is not synced to the public apps repo.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');

const NUMERIC_FI_SCOPE_MIN_WIDTH = 4;
const NUMERIC_FI_SCOPE_MAX_WIDTH = 5;

function normalizeFiScope(fiId) {
  if (fiId === undefined || fiId === null) return '';
  if (typeof fiId === 'number') {
    if (!Number.isFinite(fiId) || fiId < 0) return '';
    const base = String(Math.trunc(fiId));
    return base.padStart(Math.max(NUMERIC_FI_SCOPE_MIN_WIDTH, base.length), '0');
  }
  const s = String(fiId).trim();
  if (!s || !/^\d+$/.test(s)) return '';
  return s.padStart(Math.max(NUMERIC_FI_SCOPE_MIN_WIDTH, s.length), '0');
}

function assertValidFiScope(fiId) {
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

function usage() {
  console.error(`Usage: node tools/scripts/run-generate-mobile.mjs <generator> [nx args...]

Generators: generate | widget | feature | list
`);
}

function rewriteFiIdArgs(argv) {
  const out = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg.startsWith('--fiId=')) {
      const value = assertValidFiScope(arg.slice('--fiId='.length));
      out.push('--fiId', value);
      continue;
    }

    if (arg === '--fiId') {
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        throw new Error('Missing value for --fiId');
      }
      const value = assertValidFiScope(next);
      out.push('--fiId', value);
      i += 1;
      continue;
    }

    out.push(arg);
  }
  return out;
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

  process.exit(result.status ?? 1);
}

main();
