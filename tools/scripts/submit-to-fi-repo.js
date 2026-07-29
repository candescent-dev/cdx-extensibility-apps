/**
 * Copy a widget, feature, or aspect into your FI extensions repo and open or update a PR.
 * Syncs source files, then validates mobile packages in the FI repo when applicable.
 * A PR is created or updated after sync (and mobile `npm install` when relevant).
 *
 * Validation (no `npm install` at FI repo root — avoids private-registry auth there):
 *   - mobile widget/feature: `npm install` in the synced folder only
 *   - web / aspect: no validation step
 *
 * Only the synced project path is committed (not `.nx/cache`, `dist`, etc.).
 * Root `package-lock.json` is staged only when mobile validation modified it.
 *
 * If open PR(s) exist for feature/add-<project>* branches, updates the selected PR
 * (prompts when multiple match). Otherwise creates a new branch and opens a new PR.
 *
 * Run from repository root:
 *   node tools/scripts/submit-to-fi-repo.js
 */
/* eslint-disable no-console */

const { spawnSync } = require('child_process');
const fsp = require('fs/promises');
const path = require('path');
const readline = require('readline/promises');
const { stdin, stdout } = require('process');

const ROOT = path.resolve(__dirname, '../..');

const PATHS = {
  web: ['widgets/web', 'samples/web/widgets'],
  'mobile-widget': ['widgets/mobile', 'samples/mobile/widgets'],
  'mobile-feature': ['features/mobile', 'samples/mobile/feature'],
  aspect: ['samples/web/aspects'],
};

const EXCLUDE = new Set(['node_modules', 'dist', '.nx', 'coverage', '.expo']);

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === '--fi-url') args.fiUrl = argv[++i];
    else if (flag === '--local-path') args.localPath = argv[++i];
    else if (flag === '--project') args.project = argv[++i];
    else if (flag === '--new-pr') args.newPr = true;
  }
  return args;
}

async function ask(rl, question, defaultValue) {
  const hint = defaultValue ? ` [${defaultValue}]` : '';
  const answer = (await rl.question(`${question}${hint}: `)).trim();
  return answer || defaultValue || '';
}

async function exists(p) {
  try {
    await fsp.access(p);
    return true;
  } catch {
    return false;
  }
}

function runProcess(cmd, args, cwd) {
  console.log(`> ${cmd} ${args.join(' ')}`);
  const shell =
    process.platform === 'win32' && (cmd === 'npm' || cmd === 'npx');
  const result = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${cmd} ${args.join(' ')}`);
  }
}

function assertSafePathSegment(name) {
  if (
    !name ||
    name === '.' ||
    name === '..' ||
    name.includes('/') ||
    name.includes('\\') ||
    name.includes('\0')
  ) {
    throw new Error(`Invalid feature name: ${name}`);
  }
}

function normalizeGitUrl(url) {
  return url
    .trim()
    .replace(/\.git$/, '')
    .replace(/\/$/, '')
    .replace(/^git@([^:]+):/, 'https://$1/')
    .replace(/^https?:\/\//, '')
    .toLowerCase();
}

function verifyRemoteUrl(repoPath, expectedUrl) {
  const result = spawnSync('git', ['remote', 'get-url', 'origin'], {
    cwd: repoPath,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error('Could not read origin remote URL from local clone.');
  }

  const actual = normalizeGitUrl(result.stdout.trim());
  const expected = normalizeGitUrl(expectedUrl);
  if (actual !== expected) {
    throw new Error(
      `Local clone origin (${result.stdout.trim()}) does not match FI repo URL (${expectedUrl}).`,
    );
  }
}

function branchPrefix(project) {
  return `feature/add-${project}`;
}

function isPrBranchForProject(headRefName, project) {
  const prefix = branchPrefix(project);
  if (!headRefName.startsWith(prefix)) return false;
  const suffix = headRefName.slice(prefix.length);
  return suffix === '' || /^-\d+$/.test(suffix);
}

function findOpenPrsForProject(repoPath, project) {
  const result = spawnSync(
    'gh',
    ['pr', 'list', '--state', 'open', '--json', 'number,headRefName,url,title'],
    { cwd: repoPath, encoding: 'utf8' },
  );

  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || '').trim();
    throw new Error(
      `Failed to list open PRs: ${detail || 'gh pr list failed'}`,
    );
  }

  let prs = [];
  try {
    prs = JSON.parse(result.stdout || '[]');
  } catch {
    throw new Error('Failed to parse open PR list from gh.');
  }

  return prs
    .filter((pr) => isPrBranchForProject(pr.headRefName, project))
    .map((pr) => ({
      branch: pr.headRefName,
      number: pr.number,
      url: pr.url,
      title: pr.title,
    }));
}

async function pickOpenPr(rl, prs, project) {
  if (prs.length === 1) {
    return prs[0];
  }

  console.log(`\nMultiple open PRs found for ${project}:\n`);
  prs.forEach((pr, index) => {
    console.log(`  ${index + 1}. PR #${pr.number} — ${pr.headRefName}`);
    console.log(`     ${pr.title}`);
    console.log(`     ${pr.url}\n`);
  });
  console.log('  0. Create new PR instead\n');

  const answer = await ask(rl, 'Which PR to update?', '1');
  if (answer === '0') {
    return null;
  }

  const choice = Number(answer);
  if (!Number.isInteger(choice) || choice < 1 || choice > prs.length) {
    throw new Error(`Invalid selection: ${answer}`);
  }

  return prs[choice - 1];
}

function repoName(url) {
  return url
    .replace(/\/$/, '')
    .replace(/\.git$/, '')
    .split('/')
    .pop();
}

function resolveUserPath(userPath) {
  return path.isAbsolute(userPath) ? userPath : path.resolve(ROOT, userPath);
}

async function isGitRepo(dir) {
  return exists(path.join(dir, '.git'));
}

async function resolveLocalRepo(targetUrl, userPath) {
  if (userPath.includes('\0')) {
    throw new Error('Invalid local clone path.');
  }
  const name = repoName(targetUrl);
  const resolved = resolveUserPath(userPath);

  if (await isGitRepo(resolved)) {
    console.log(`Using existing clone: ${resolved}`);
    return resolved;
  }

  const nested = path.join(resolved, name);
  if (resolved !== nested && (await isGitRepo(nested))) {
    console.log(`Using existing clone: ${nested}`);
    return nested;
  }

  const clonePath =
    resolved.endsWith(name) || path.basename(resolved) === name
      ? resolved
      : nested;

  if (await exists(clonePath)) {
    const entries = await fsp.readdir(clonePath);
    if (entries.length > 0 && !(await isGitRepo(clonePath))) {
      throw new Error(
        `Folder exists but is not a git repo: ${clonePath}\n` +
        `Use the default path or an empty folder for the FI repo clone.`,
      );
    }
  }

  await fsp.mkdir(path.dirname(clonePath), { recursive: true });
  console.log(`Cloning into: ${clonePath}`);
  runProcess('git', ['clone', targetUrl, clonePath], ROOT);
  return clonePath;
}

function getDefaultBranch(repoPath) {
  const originHead = spawnSync(
    'git',
    ['symbolic-ref', 'refs/remotes/origin/HEAD'],
    {
      cwd: repoPath,
      encoding: 'utf8',
    },
  );
  if (originHead.status === 0) {
    const match = originHead.stdout
      .trim()
      .match(/^refs\/remotes\/origin\/(.+)$/);
    if (match) return match[1];
  }

  const remoteShow = spawnSync('git', ['remote', 'show', 'origin'], {
    cwd: repoPath,
    encoding: 'utf8',
  });
  if (remoteShow.status === 0) {
    const headMatch = remoteShow.stdout.match(/^\s*HEAD branch:\s*(\S+)/m);
    if (headMatch) return headMatch[1];
  }

  for (const branch of ['main', 'master', 'develop']) {
    const check = spawnSync('git', ['rev-parse', '--verify', branch], {
      cwd: repoPath,
      stdio: 'ignore',
    });
    if (check.status === 0) return branch;
  }
  throw new Error('Could not determine default branch in target repo.');
}

function assertWithinRoot(relPath) {
  const root = path.resolve(ROOT);
  const full = path.resolve(ROOT, relPath);
  if (full !== root && !full.startsWith(root + path.sep)) {
    throw new Error('Invalid path: attempted directory traversal');
  }
}

async function findSource(project, type) {
  assertSafePathSegment(project);

  if (type === 'aspect') {
    const file = project.endsWith('.js') ? project : `${project}.js`;
    for (const base of PATHS.aspect) {
      const rel = path.join(base, file);
      assertWithinRoot(rel);
      if (await exists(path.join(ROOT, rel)))
        return { rel, isFile: true, type };
    }
    return null;
  }

  for (const base of PATHS[type]) {
    const rel = path.join(base, project);
    assertWithinRoot(rel);
    if (await exists(path.join(ROOT, rel))) return { rel, isFile: false, type };
  }
  return null;
}

async function detectSource(project, rl) {
  const matches = [];
  for (const type of Object.keys(PATHS)) {
    const source = await findSource(project, type);
    if (source) matches.push(source);
  }
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];
  return pickSource(rl, matches, project);
}

async function pickSource(rl, matches, project) {
  console.log(`\nMultiple matches found for "${project}":\n`);
  matches.forEach((source, index) => {
    console.log(`  ${index + 1}. ${source.type} — ${source.rel}`);
  });

  const answer = await ask(rl, 'Which one to submit?', '1');
  const choice = Number(answer);
  if (!Number.isInteger(choice) || choice < 1 || choice > matches.length) {
    throw new Error(`Invalid selection: ${answer}`);
  }

  return matches[choice - 1];
}

async function copyDir(src, dest) {
  await fsp.mkdir(dest, { recursive: true });
  for (const entry of await fsp.readdir(src, { withFileTypes: true })) {
    if (EXCLUDE.has(entry.name)) continue;
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) await copyDir(from, to);
    else await fsp.copyFile(from, to);
  }
}

async function buildPrDescription() {
  return 'Submitted from CDX extensibility template.';
}

function isTracked(repoPath, rel) {
  const tracked = spawnSync('git', ['ls-files', '--error-unmatch', rel], {
    cwd: repoPath,
    stdio: 'ignore',
  });
  return tracked.status === 0;
}

function hasStagedChanges(repoPath) {
  const result = spawnSync('git', ['diff', '--cached', '--quiet'], {
    cwd: repoPath,
    stdio: 'ignore',
  });
  return result.status === 1;
}

function stageSyncedFiles(repoPath, source, includeLockfile = false) {
  runProcess('git', ['add', source.rel], repoPath);
  if (includeLockfile && isTracked(repoPath, 'package-lock.json')) {
    runProcess('git', ['add', 'package-lock.json'], repoPath);
  }
}

function revertSyncedFiles(repoPath, source) {
  const rel = source.rel;

  if (isTracked(repoPath, rel)) {
    runProcess('git', ['checkout', 'HEAD', '--', rel], repoPath);
  }

  runProcess('git', ['clean', '-fd', '--', rel], repoPath);
}

function revertValidationChanges(repoPath, source) {
  revertSyncedFiles(repoPath, source);

  if (isTracked(repoPath, 'package-lock.json')) {
    runProcess(
      'git',
      ['checkout', 'HEAD', '--', 'package-lock.json'],
      repoPath,
    );
  }
}

function assertWithinRepo(repoPath, targetPath) {
  const repo = path.resolve(repoPath);
  const target = path.resolve(targetPath);
  if (target !== repo && !target.startsWith(repo + path.sep)) {
    throw new Error('Invalid path: attempted directory traversal');
  }
}

async function validateFiRepoBuild(repoPath, source) {
  console.log('\nValidating FI repo before creating PR...\n');

  const projectDir = path.join(repoPath, source.rel);
  assertWithinRepo(repoPath, projectDir);

  if (source.type === 'mobile-feature' || source.type === 'mobile-widget') {
    // Folder install only — do not run `npm install` at FI root (private registry / JFrog).
    runProcess('npm', ['install'], projectDir);
    return;
  }

  console.log(
    `Skipping validation for ${source.type} (no FI-repo install/build step).`,
  );
}

async function main() {
  const cli = parseArgs(process.argv);
  const rl = readline.createInterface({ input: stdin, output: stdout });

  try {
    console.log('\nSubmit to FI extensions repo\n');

    const target =
      cli.fiUrl || (await ask(rl, 'FI repo Git URL'));
    if (!target) throw new Error('FI repo URL is required.');

    const defaultClone = path.join('..', repoName(target));
    const localInput =
      cli.localPath ||
      (await ask(
        rl,
        'Local clone path (FI repo folder, or parent folder)',
        defaultClone,
      ));

    const project =
      cli.project || (await ask(rl, 'Feature / widget / aspect name'));
    if (!project) throw new Error('Feature name is required.');
    assertSafePathSegment(project);

    const source = await detectSource(project, rl);
    if (!source) {
      throw new Error(
        `Could not find "${project}" under widgets, features, or aspects.`,
      );
    }
    const { type } = source;
    console.log(`Detected type: ${type}`);

    const localPath = await resolveLocalRepo(target, localInput);
    verifyRemoteUrl(localPath, target);

    runProcess('git', ['fetch', 'origin'], localPath);
    const baseBranch = getDefaultBranch(localPath);

    const openPrs = findOpenPrsForProject(localPath, project);
    const openPr = cli.newPr
      ? null
      : openPrs.length
        ? await pickOpenPr(rl, openPrs, project)
        : null;
    const isUpdate = Boolean(openPr);
    const branch = isUpdate
      ? openPr.branch
      : `${branchPrefix(project)}-${Date.now()}`;

    if (isUpdate) {
      console.log(`\nUpdating open PR #${openPr.number}: ${openPr.url}`);
      runProcess('git', ['checkout', branch], localPath);
      runProcess('git', ['pull', '--ff-only', 'origin', branch], localPath);
    } else {
      console.log(`\nNo open PR found — creating new branch: ${branch}`);
      runProcess('git', ['checkout', baseBranch], localPath);
      runProcess('git', ['pull', '--ff-only', 'origin', baseBranch], localPath);
      runProcess('git', ['checkout', '-B', branch], localPath);
    }

    const srcAbs = path.join(ROOT, source.rel);
    const destAbs = path.join(localPath, source.rel);
    assertWithinRepo(localPath, destAbs);

    let syncStarted = false;
    let synced = false;
    let validated = false;
    let committed = false;
    let pushed = false;

    const restoreOnInterrupt = () => {
      if (!syncStarted || committed) return;
      if (synced) {
        revertValidationChanges(localPath, source);
      } else {
        revertSyncedFiles(localPath, source);
      }
    };
    const onInterrupt = () => {
      console.error('\nInterrupted. Restoring FI clone...\n');
      restoreOnInterrupt();
      process.exit(1);
    };
    process.once('SIGINT', onInterrupt);
    process.once('SIGTERM', onInterrupt);

    try {
      syncStarted = true;
      if (source.isFile) {
        await fsp.mkdir(path.dirname(destAbs), { recursive: true });
        await fsp.copyFile(srcAbs, destAbs);
      } else {
        await fsp.rm(destAbs, { recursive: true, force: true });
        await copyDir(srcAbs, destAbs);
      }
      synced = true;

      const lockfilePath = path.join(localPath, 'package-lock.json');
      const lockfileBefore =
        (await exists(lockfilePath)) && (await fsp.readFile(lockfilePath));

      await validateFiRepoBuild(localPath, source);
      validated = true;

      let lockfileUpdatedByValidation = false;
      if (lockfileBefore) {
        const lockfileAfter = await fsp.readFile(lockfilePath);
        lockfileUpdatedByValidation = !lockfileBefore.equals(lockfileAfter);
      } else if (await exists(lockfilePath)) {
        lockfileUpdatedByValidation = true;
      }

      stageSyncedFiles(localPath, source, lockfileUpdatedByValidation);
      const commitMessage = isUpdate
        ? `Update ${project} (${type})`
        : `Add ${project} (${type})`;
      if (hasStagedChanges(localPath)) {
        runProcess('git', ['commit', '-m', commitMessage], localPath);
        committed = true;
        runProcess('git', ['push', '-u', 'origin', branch], localPath);
        pushed = true;
      } else {
        console.log(
          '\nNo file changes to commit — skipping commit and push.\n',
        );
      }

      const prDescription = await buildPrDescription();

      if (isUpdate) {
        runProcess(
          'gh',
          ['pr', 'edit', String(openPr.number), '--body', prDescription],
          localPath,
        );
        if (pushed) {
          console.log(`\nPushed update to PR #${openPr.number}: ${openPr.url}`);
        } else {
          console.log(
            `\nUpdated PR #${openPr.number} description: ${openPr.url}`,
          );
        }
      } else {
        runProcess(
          'gh',
          [
            'pr',
            'create',
            '--head',
            branch,
            '--base',
            baseBranch,
            '--title',
            `Add ${project}`,
            '--body',
            prDescription,
          ],
          localPath,
        );
      }

      console.log('\nDone.');
      process.removeListener('SIGINT', onInterrupt);
      process.removeListener('SIGTERM', onInterrupt);
    } catch (err) {
      process.removeListener('SIGINT', onInterrupt);
      process.removeListener('SIGTERM', onInterrupt);
      if (syncStarted && !synced) {
        console.error(
          '\nFile sync failed. Restoring destination from git — no PR was created or updated.\n',
        );
        revertSyncedFiles(localPath, source);
      } else if (synced && !committed && !validated) {
        console.error(
          '\nBuild validation failed. Reverting synced files — no PR was created or updated.\n',
        );
        revertValidationChanges(localPath, source);
      } else if (synced && !committed && validated) {
        console.error(
          '\nCommit failed after successful validation. Synced files were left in place — no PR was created or updated.\n',
        );
      } else if (committed && !pushed) {
        console.error(
          '\nChanges were committed locally but push failed. No automatic revert was performed.\n',
        );
      } else if (pushed) {
        console.error(
          '\nChanges were pushed but a later step failed. No automatic revert was performed.\n',
        );
      }
      throw err;
    }
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
