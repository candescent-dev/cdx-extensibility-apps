#!/usr/bin/env node
/**
 * Thin wrapper used by Nx targets to forward an optional positional preview
 * target id (widget or feature) into Expo via EXPO_PUBLIC_PREVIEW_TARGET.
 *
 * Usage (invoked by Nx run-commands with forwardAllArgs):
 *   node run-with-preview.mjs --platform=<start|ios|android> [previewTargetId]
 *
 * Examples:
 *   npx nx start   mobile-sandbox                       -> full sandbox
 *   npx nx start   mobile-sandbox agent-chat            -> preview agent-chat
 *   npx nx ios     mobile-sandbox investment-portfolio  -> preview on iOS
 *   npx nx android mobile-sandbox investment-portfolio  -> preview on Android
 */
import { spawn } from 'node:child_process';

const args = process.argv.slice(2);

let platform = 'start';
const pIdx = args.findIndex((a) => a === '--platform' || a.startsWith('--platform='));
if (pIdx >= 0) {
  const a = args[pIdx];
  if (a.includes('=')) {
    platform = a.split('=')[1];
    args.splice(pIdx, 1);
  } else {
    platform = args[pIdx + 1];
    args.splice(pIdx, 2);
  }
}

if (!['start', 'ios', 'android'].includes(platform)) {
  console.error(`run-with-preview: unsupported --platform "${platform}"`);
  process.exit(2);
}

const target = args[0];
const env = { ...process.env, CI: '0' };
if (target) {
  env.EXPO_PUBLIC_PREVIEW_TARGET = target;
} else {
  // Avoid a stale shell export forcing preview mode after a prior single-target run.
  delete env.EXPO_PUBLIC_PREVIEW_TARGET;
}

const npmArgs = ['run', platform, '--workspace=mobile-sandbox'];
if (platform === 'start') {
  // Opt-in only: --offline skips api.expo.dev (helps corporate VPN) but prevents Expo Go
  // from being installed on emulators when you press `a` / `i`. Default stays online.
  const expoFlags = ['--clear', '--port', '8083'];
  if (process.env.MOBILE_SANDBOX_EXPO_OFFLINE === '1') {
    expoFlags.unshift('--offline');
  }
  npmArgs.push('--', ...expoFlags);
}

const child = spawn('npm', npmArgs, { stdio: 'inherit', env, shell: true });
child.on('exit', (code) => process.exit(code ?? 0));
