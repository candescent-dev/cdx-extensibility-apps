/**
 * Install devDependencies for mobile sample packages used by the sandbox.
 *
 * pnpm isolates each package; file: links from the sandbox do not install sample
 * devDependencies (tsup, react-native types, etc.). Nx builds run from each sample
 * directory and need a local node_modules.
 *
 * Usage:
 *   node tools/scripts/install-mobile-samples.mjs [--frozen]
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** Relative paths to package roots with their own package.json + dev build deps. */
const SAMPLE_ROOTS = [
  'samples/mobile/widgets/investment-portfolio',
  'samples/mobile/feature/agent-feature',
];

function runPnpm(cwd, frozen) {
  const args = frozen ? ['install', '--frozen-lockfile'] : ['install'];
  const pnpmCmd = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  console.log(`[install-mobile-samples] pnpm ${args.join(' ')} (${path.relative(REPO_ROOT, cwd)})`);
  const result = spawnSync(pnpmCmd, args, {
    cwd,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const frozen = process.argv.includes('--frozen');

for (const rel of SAMPLE_ROOTS) {
  const dir = path.join(REPO_ROOT, rel);
  if (!existsSync(path.join(dir, 'package.json'))) {
    console.warn(`[install-mobile-samples] skip (no package.json): ${rel}`);
    continue;
  }
  const hasLockfile = existsSync(path.join(dir, 'pnpm-lock.yaml'));
  if (frozen && !hasLockfile) {
    throw new Error(
      `[install-mobile-samples] missing pnpm-lock.yaml in ${rel}; run pnpm install there and commit the lockfile.`,
    );
  }
  runPnpm(dir, frozen && hasLockfile);
}
