/*
 * Runs submit-to-fi-repo.js as a subprocess against a temporary copy of the scripts it needs, so
 * which aspect folder it picks (and which file it would copy) is tested without an FI repo or the
 * network. The run always stops at the FI clone: --local-path is a folder that is not a git repo.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '../..');
const NAME = 'promo-sheet';

/** A minimal repo copy with one scaffolded modal aspect, plus a fetch stub serving its loader. */
async function withRepo(run) {
  const root = mkdtempSync(join(tmpdir(), 'submit-fi-'));
  try {
    for (const dir of [
      'tools/scripts',
      'playground/aspects-mobile',
      'samples/mobile/aspects',
    ])
      cpSync(join(REPO, dir), join(root, dir), { recursive: true });
    const { listTemplates, scaffoldAspect } = await import(
      join(root, 'tools/scripts/create-aspect.mjs')
    );
    const template = listTemplates(join(root, 'samples/mobile/aspects')).find(
      (t) => t.type === 'modal',
    );
    const { dir } = scaffoldAspect({
      template,
      name: NAME,
      targetRoot: join(root, 'aspects/mobile'),
    });
    // Submit-ready values, so the run reaches the FI clone step.
    const m = JSON.parse(readFileSync(join(dir, 'metadata.json'), 'utf8'));
    for (const p of m.properties) {
      if (/_DATA_ctaurl$/.test(p.propertyName))
        p.propertyValue = 'https://offers.bank.test/card';
      if (/_DATA_uiurl$/i.test(p.propertyName) || /UI/.test(p.propertyLabel))
        if (/^https?:/.test(p.propertyValue))
          p.propertyValue = 'https://ui.bank.test/page.html';
    }
    writeFileSync(join(dir, 'metadata.json'), JSON.stringify(m, null, 2));
    const stub = join(root, 'fetch-stub.mjs');
    writeFileSync(
      stub,
      `import { readFileSync } from 'node:fs';
const bytes = readFileSync(${JSON.stringify(join(dir, 'static-loader.v1.js'))});
globalThis.fetch = async () => new Response(bytes, { status: 200, headers: { 'access-control-allow-origin': '*' } });
`,
    );
    // Not a git repo and not empty: the script stops here instead of cloning.
    const clone = join(root, 'fi', 'fi-ext');
    mkdirSync(clone, { recursive: true });
    writeFileSync(join(clone, 'keep.txt'), 'x');
    const submit = ({ yes = true, input } = {}) =>
      spawnSync(
        process.execPath,
        [
          '--import',
          stub,
          join(root, 'tools/scripts/submit-to-fi-repo.js'),
          ...(yes ? ['--yes'] : []),
          '--fi-url',
          'https://github.com/example/fi-ext',
          '--local-path',
          clone,
          '--project',
          NAME,
          '--loader-url',
          'https://cdn.bank.test/l.js',
          '--accept-hosted',
        ],
        { cwd: root, encoding: 'utf8', input },
      );
    await run({ root, dir, submit });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const output = (r) => `${r.stdout}\n${r.stderr}`;

test('a ready mobile aspect gets past prepare to the FI clone step', async () => {
  await withRepo(async ({ submit }) => {
    const r = submit();
    assert.match(output(r), /Folder exists but is not a git repo/, output(r));
  });
});

test('an aspect folder with no extension file is not picked over the sample', async () => {
  await withRepo(async ({ root, dir, submit }) => {
    // Same name as a sample: before the fix the broken own folder won and failed in prepare.
    const sample = join(root, 'samples/mobile/aspects', NAME);
    cpSync(dir, sample, { recursive: true });
    unlinkSync(join(dir, 'aspect-extension.js'));
    const ownBefore = readFileSync(join(dir, 'metadata.json'), 'utf8');
    const sampleBefore = readFileSync(join(sample, 'metadata.json'), 'utf8');
    const r = submit();
    assert.doesNotMatch(output(r), /no aspect extension/, output(r));
    assert.match(output(r), /Folder exists but is not a git repo/, output(r));
    // The sample is the one prepared (its metadata gets the hosted loader); the broken folder is not touched.
    assert.notEqual(
      readFileSync(join(sample, 'metadata.json'), 'utf8'),
      sampleBefore,
    );
    assert.equal(readFileSync(join(dir, 'metadata.json'), 'utf8'), ownBefore);
  });
});

test('an extension under another name is reported as not found, before metadata.json changes', async () => {
  await withRepo(async ({ dir, submit }) => {
    renameSync(join(dir, 'aspect-extension.js'), join(dir, 'my-ext.js'));
    const before = readFileSync(join(dir, 'metadata.json'), 'utf8');
    const r = submit();
    assert.doesNotMatch(output(r), /has no files to submit/, output(r));
    assert.match(output(r), /Could not find "promo-sheet"/, output(r));
    assert.equal(readFileSync(join(dir, 'metadata.json'), 'utf8'), before);
  });
});

test('an aspect made before the role names (<name>.js) is still submitted', async () => {
  await withRepo(async ({ dir, submit }) => {
    renameSync(join(dir, 'aspect-extension.js'), join(dir, `${NAME}.js`));
    const r = submit();
    assert.match(output(r), /Folder exists but is not a git repo/, output(r));
  });
});

test('declining the pull request leaves metadata.json as it was', async () => {
  await withRepo(async ({ dir, submit }) => {
    const before = readFileSync(join(dir, 'metadata.json'), 'utf8');
    const r = submit({ yes: false, input: '2\n' });
    assert.match(output(r), /Cancelled\. Nothing was pushed\./, output(r));
    assert.equal(readFileSync(join(dir, 'metadata.json'), 'utf8'), before);
  });
});
