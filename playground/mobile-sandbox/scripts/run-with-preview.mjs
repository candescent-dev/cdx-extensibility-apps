#!/usr/bin/env node
/**
 * Thin wrapper used by Nx targets to forward an optional positional preview
 * target id (widget or feature) into Expo via EXPO_PUBLIC_PREVIEW_TARGET.
 *
 * Usage (invoked by Nx run-commands with forwardAllArgs):
 *   node run-with-preview.mjs --platform=<start|ios|android> [previewTargetId]
 *
 * Examples:
 *   pnpm exec nx start   mobile-sandbox                       -> full sandbox
 *   pnpm exec nx start   mobile-sandbox agent-chat            -> preview agent-chat
 *   pnpm exec nx ios     mobile-sandbox investment-portfolio  -> preview on iOS
 *   pnpm exec nx android mobile-sandbox investment-portfolio  -> preview on Android
 *
 * Android emulator / Expo Go:
 *   Uses --localhost + adb reverse so the emulator can reach Metro (port 8083).
 *   Set MOBILE_SANDBOX_USE_LAN=1 to use the LAN URL instead (physical device on Wi‑Fi).
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  METRO_PORT,
  setupAndroidMetroPortForward,
} from './setup-android-metro.mjs';

const sandboxRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
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
const useLan = process.env.MOBILE_SANDBOX_USE_LAN === '1';
const env = { ...process.env, CI: '0' };

if (target) {
  env.EXPO_PUBLIC_PREVIEW_TARGET = target;
} else {
  // Avoid a stale shell export forcing preview mode after a prior single-target run.
  delete env.EXPO_PUBLIC_PREVIEW_TARGET;
}

if (!useLan) {
  // Emulator-safe bundler URL; pair with adb reverse below.
  env.REACT_NATIVE_PACKAGER_HOSTNAME = 'localhost';
  if (setupAndroidMetroPortForward(METRO_PORT)) {
    console.log(
      `[mobile-sandbox] adb reverse tcp:${METRO_PORT} tcp:${METRO_PORT} (Android emulator → Metro)`
    );
  }
}

const pnpmArgs = ['run', platform];
if (platform === 'start') {
  // Opt-in only: --offline skips api.expo.dev (helps corporate VPN) but prevents Expo Go
  // from being installed on emulators when you press `a` / `i`. Default stays online.
  const expoFlags = ['--clear', '--port', String(METRO_PORT)];
  if (!useLan) {
    expoFlags.unshift('--localhost');
  }
  if (process.env.MOBILE_SANDBOX_EXPO_OFFLINE === '1') {
    expoFlags.unshift('--offline');
  }
  pnpmArgs.push('--', ...expoFlags);
}

const pnpmBin = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const child = spawn(pnpmBin, pnpmArgs, {
  stdio: 'inherit',
  env,
  cwd: sandboxRoot,
});
child.on('exit', (code) => process.exit(code ?? 0));
