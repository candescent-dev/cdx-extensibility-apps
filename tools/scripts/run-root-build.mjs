#!/usr/bin/env node
/**
 * Root build entrypoint — avoids Nx recursion when package.json "build" is inferred
 * as @dbk-olb-platform/template:build (which would otherwise call "nx build" again).
 *
 * Usage (from repo root):
 *   pnpm run build                         → build sample projects only (matches CI)
 *   pnpm run build -- agent-widget         → build one web widget
 *   pnpm run build:sandbox -- agent-widget → build with sandbox configuration
 */
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const configArg = args.find((arg) => arg.startsWith('--configuration='));
const projectArgs = args.filter((arg) => !arg.startsWith('--configuration='));

const nxArgs =
  projectArgs.length > 0
    ? ['build', ...projectArgs, ...(configArg ? [configArg] : [])]
    : [
        'run-many',
        '-t',
        'build',
        '--projects=samples/**',
        ...(configArg ? [configArg] : []),
      ];

const result = spawnSync('nx', nxArgs, { stdio: 'inherit', shell: process.platform === 'win32' });
process.exit(result.status ?? 1);
