#!/usr/bin/env node
/**
 * Forward Metro port from Android emulator/device to the host via adb reverse.
 * Required for Expo Go when using --localhost (emulator cannot reach LAN IPs).
 */
import { execSync } from 'node:child_process';

export const METRO_PORT = 8083;

export function hasAdbDevice() {
  try {
    const output = execSync('adb devices', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return output
      .split('\n')
      .slice(1)
      .some((line) => {
        const trimmed = line.trim();
        return trimmed.endsWith('device') && !trimmed.startsWith('List of');
      });
  } catch {
    return false;
  }
}

/** @returns {boolean} true when reverse was applied */
export function setupAndroidMetroPortForward(port = METRO_PORT) {
  if (!hasAdbDevice()) {
    return false;
  }
  try {
    execSync(`adb reverse tcp:${port} tcp:${port}`, {
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return true;
  } catch {
    return false;
  }
}
