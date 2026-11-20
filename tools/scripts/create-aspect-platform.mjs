#!/usr/bin/env node
/**
 * `pnpm run create-aspect`: asks web or mobile, then runs that platform's create script.
 *
 *   pnpm run create-aspect                          asks Web or Mobile
 *   pnpm run create-aspect -- --platform web ...    skips the question (web options)
 *   pnpm run create-aspect -- --platform mobile ... skips the question (mobile options)
 *   pnpm run create-aspect -- --yes ...             no question; mobile, as before web was added
 *
 * The platform scripts are not changed: web is create-web-aspect.mjs, mobile is create-aspect.mjs.
 */
/* eslint-disable no-console */
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createPrompter } from './prompt.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPTS = {
  web: join(HERE, 'create-web-aspect.mjs'),
  mobile: join(HERE, 'create-aspect.mjs'),
};
const CHOICES = [
  { value: 'web', label: 'Web', hint: 'OLB web playground → aspects/web/' },
  {
    value: 'mobile',
    label: 'Mobile',
    hint: 'mobile aspect preview → aspects/mobile/',
  },
];

/** Removes --platform from argv and returns the chosen platform (or undefined). */
export function splitPlatform(argv) {
  const rest = [];
  let platform;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--') continue;
    if (a === '--platform' || a === '-p') {
      platform = argv[++i]?.toLowerCase();
      if (!platform) throw new Error('--platform needs web or mobile.');
      continue;
    }
    rest.push(a);
  }
  if (platform && !SCRIPTS[platform]) {
    throw new Error(`Unknown platform "${platform}". Use web or mobile.`);
  }
  return { platform, rest };
}

async function askPlatform() {
  const p = createPrompter({
    cancelMessage: 'Cancelled. Nothing was created.',
  });
  try {
    console.log('\nCreate an aspect\n');
    return CHOICES[await p.choose('Platform', CHOICES)].value;
  } finally {
    // The platform script reads stdin itself; a reader left open here would swallow its input.
    p.close();
  }
}

export async function main(argv = process.argv.slice(2)) {
  const { platform: asked, rest } = splitPlatform(argv);
  const yes = rest.includes('--yes') || rest.includes('-y');
  const help = rest.includes('--help') || rest.includes('-h');

  if (help && !asked) {
    console.log(`\
Create a web or mobile aspect.

  pnpm run create-aspect                          asks Web or Mobile
  pnpm run create-aspect -- --platform web ...    web options (see --platform web --help)
  pnpm run create-aspect -- --platform mobile ... mobile options (see --platform mobile --help)

Shortcuts: pnpm run create-aspect:web -- ...  |  pnpm run create-aspect:mobile -- ...
`);
    return 0;
  }

  const platform = asked ?? (yes ? 'mobile' : await askPlatform());
  const child = spawnSync(process.execPath, [SCRIPTS[platform], ...rest], {
    stdio: 'inherit',
  });
  return child.status ?? 1;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      console.error(`\n${err.message}`);
      process.exit(1);
    }
  );
}
