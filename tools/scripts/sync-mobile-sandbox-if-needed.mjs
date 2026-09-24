#!/usr/bin/env node
/**
 * Ensure playground/mobile-sandbox lockfile matches package.json before frozen installs.
 *
 * When generate adds new file: deps, the sandbox lockfile is stale until synced.
 * nx start mobile-sandbox runs this automatically; set MOBILE_SANDBOX_SKIP_SYNC=1 to skip.
 *
 * Usage: node tools/scripts/sync-mobile-sandbox-if-needed.mjs
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SANDBOX_DIR = path.join(REPO_ROOT, 'playground/mobile-sandbox');

function pnpmCmd() {
  return process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
}

function runPnpm(args, cwd) {
  const result = spawnSync(pnpmCmd(), args, {
    cwd,
    stdio: 'inherit',
    env: process.env,
  });
  return result.status ?? 1;
}

function main() {
  if (process.env.MOBILE_SANDBOX_SKIP_SYNC === '1') {
    return;
  }

  const frozenStatus = runPnpm(['install', '--frozen-lockfile'], SANDBOX_DIR);
  if (frozenStatus === 0) {
    return;
  }

  console.log(
    '[sync-mobile-sandbox] Sandbox lockfile out of sync — running pnpm install...\n',
  );
  const syncStatus = runPnpm(['install'], SANDBOX_DIR);
  if (syncStatus !== 0) {
    process.exit(syncStatus);
  }
}

main();
