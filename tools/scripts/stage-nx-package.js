/**
 * Cross-platform staging helper for Nx publishable packages.
 *
 * Usage (from any cwd):
 *   npx stage-nx-package --projectRoot <path> --outDir <path> --copy <paths...>
 *
 * Example:
 *   npx stage-nx-package --projectRoot . --outDir ../../../dist/packages/my-lib --copy dist package.json README.md
 */
/* eslint-disable no-console */

const fs = require('fs/promises');
const path = require('path');

function usageAndExit(message) {
  if (message) console.error(message);
  console.error(
    [
      '',
      'stage-nx-package',
      '  --projectRoot <path>   (required, relative to process.cwd())',
      '  --outDir <path>        (required, relative to process.cwd())',
      '  --copy <paths...>      (required, one or more paths relative to projectRoot)',
      '',
      'Example:',
      '  npx stage-nx-package --projectRoot . --outDir ../../../dist/packages/my-lib --copy dist package.json README.md',
      '',
    ].join('\n')
  );
  process.exit(1);
}

function parseArgs(argv) {
  const args = { copy: [] };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--projectRoot') args.projectRoot = argv[++i];
    else if (token === '--outDir') args.outDir = argv[++i];
    else if (token === '--copy') {
      while (argv[i + 1] && !String(argv[i + 1]).startsWith('--')) {
        args.copy.push(argv[++i]);
      }
    } else {
      usageAndExit(`Unknown arg: ${token}`);
    }
  }
  return args;
}

async function copyPath(src, dest) {
  const stat = await fs.stat(src);
  if (stat.isDirectory()) {
    await fs.mkdir(dest, { recursive: true });
    await fs.cp(src, dest, { recursive: true });
  } else {
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(src, dest);
  }
}

async function main() {
  const { projectRoot, outDir, copy } = parseArgs(process.argv.slice(2));
  if (!projectRoot) usageAndExit('Missing --projectRoot');
  if (!outDir) usageAndExit('Missing --outDir');
  if (!copy || copy.length === 0) usageAndExit('Missing --copy <paths...>');

  const absProjectRoot = path.resolve(process.cwd(), projectRoot);
  const absOutDir = path.resolve(process.cwd(), outDir);

  // Clean the output dir.
  await fs.rm(absOutDir, { recursive: true, force: true });
  await fs.mkdir(absOutDir, { recursive: true });

  const copied = [];
  for (const rel of copy) {
    const src = path.join(absProjectRoot, rel);
    try {
      await fs.access(src);
    } catch {
      console.warn('stage-nx-package: skip (missing):', rel);
      continue;
    }
    const dest = path.join(absOutDir, rel);
    await copyPath(src, dest);
    copied.push(rel);
  }

  console.log('Staged package files:', {
    projectRoot: absProjectRoot,
    outDir: absOutDir,
    copied,
  });
}

main().catch((err) => {
  console.error('Failed to stage Nx package:', err);
  process.exit(1);
});