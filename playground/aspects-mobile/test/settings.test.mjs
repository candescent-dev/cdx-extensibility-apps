import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  answersFromMetadata,
  loaderEntry,
  validateAnswers,
  withAnswers,
} from '../src/metadata-builder.mjs';
import {
  editMode,
  parseArgs,
  readAspectFolder,
  startPreviewServer,
  swapOrigin,
  templateOf,
} from '../serve.mjs';
import { createServer } from 'node:http';
import { scaffoldAspect } from '../../../tools/scripts/create-aspect.mjs';

const samples = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../samples/mobile/aspects',
);
const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
const sample = (name) => ({
  template: {
    ...read(join(samples, name, 'template.json')),
    dir: join(samples, name),
  },
  metadata: read(join(samples, name, 'metadata.json')),
});
const prop = (metadata, name) =>
  metadata.properties.find((p) => p.propertyName === name)?.propertyValue;

test('withAnswers rewrites Data Attributes, properties and CSP but keeps the loader URL and SRI', () => {
  const { template, metadata } = sample('chatbot');
  const answers = {
    ...answersFromMetadata(template, metadata),
    title: 'Ask Acme',
    accentColor: '#2f6bc8',
    size: 'medium',
    apiUrl: 'https://chat.acme-bank.com/api',
    oidcClientId: 'acme-client',
    redirectUrl: 'https://id.acme-bank.com/aspect/session',
  };
  const out = withAnswers(template, metadata, answers);
  // Sign-in settings are aspect properties, not Data Attributes.
  assert.equal(prop(out, 'ASPECT_PROPERTY_MOBILE_OIDCCLIENTID'), 'acme-client');
  assert.equal(
    prop(out, 'ASPECT_PROPERTY_MOBILE_REDIRECTURL'),
    'https://id.acme-bank.com/aspect/session',
  );
  assert.equal(prop(out, 'ASPECT_SCRIPT_chatbot_DATA_oidcclientid'), undefined);
  // Left empty again, the optional properties are removed.
  const cleared = withAnswers(template, out, {
    ...answers,
    oidcClientId: '',
    redirectUrl: '',
  });
  assert.equal(prop(cleared, 'ASPECT_PROPERTY_MOBILE_OIDCCLIENTID'), undefined);
  assert.equal(prop(out, 'ASPECT_SCRIPT_chatbot_DATA_title'), 'Ask Acme');
  assert.equal(prop(out, 'ASPECT_SCRIPT_chatbot_DATA_accentcolor'), '#2f6bc8');
  assert.equal(prop(out, 'ASPECT_PROPERTY_MOBILE_PLACEMENTSIZE'), 'medium');
  assert.match(
    prop(out, 'ASPECT_PROPERTY_MOBILE_CONTENTSECURITYPOLICY'),
    /connect-src 'self' https:\/\/id\.acme-bank\.com/,
  );
  // The chat backend is called by the partner UI page, not by the loader, so it is not in the CSP.
  assert.doesNotMatch(
    prop(out, 'ASPECT_PROPERTY_MOBILE_CONTENTSECURITYPOLICY'),
    /chat\.acme-bank\.com/,
  );
  assert.deepEqual(loaderEntry(out), loaderEntry(metadata));
  assert.equal(
    prop(metadata, 'ASPECT_SCRIPT_chatbot_DATA_title'),
    'Need help?',
  );
});

test('validateAnswers reports each bad field', () => {
  const { template } = sample('modal');
  const errors = validateAnswers(template, {
    title: '',
    accentColor: 'blue',
    ctaUrl: 'http://example.com',
  });
  assert.ok(errors.title && errors.accentColor && errors.ctaUrl);
});

test('samples are copy-only; your own aspects can be saved', () => {
  assert.equal(editMode(readAspectFolder(join(samples, 'chatbot'))), 'copy');
  const root = mkdtempSync(join(tmpdir(), 'aspect-mode-'));
  try {
    const { dir } = scaffoldAspect({
      template: sample('chatbot').template,
      name: 'acme-chat',
      targetRoot: root,
    });
    assert.equal(editMode(readAspectFolder(dir)), 'save');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('an aspect you created knows its template; older ones are matched by type', () => {
  const root = mkdtempSync(join(tmpdir(), 'aspect-origin-'));
  try {
    const templates = ['chatbot', 'modal'].map((n) =>
      readAspectFolder(join(samples, n)),
    );
    const { dir } = scaffoldAspect({
      template: sample('modal').template,
      name: 'acme-promo',
      targetRoot: root,
    });
    const mine = readAspectFolder(dir);
    assert.equal(mine.template.from, 'modal');
    assert.deepEqual(templateOf(mine, [...templates, mine]), {
      id: 'modal',
      title: 'Promotion Sheet',
    });
    const older = {
      ...mine,
      template: { ...mine.template, from: undefined, title: 'Modal' },
    };
    assert.equal(templateOf(older, templates).id, 'modal');
    assert.equal(templateOf(templates[0], templates), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

/** Starts the preview on a free port; returns { base, post(path, body, headers), stop }. */
async function preview(options) {
  const p = startPreviewServer({ port: 0, ...options });
  await new Promise((r) => p.server.once('listening', r));
  const base = `http://127.0.0.1:${p.server.address().port}`;
  const post = (path, body, headers = {}) =>
    fetch(base + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: base, ...headers },
      body: JSON.stringify(body),
    });
  return { base, post, stop: p.stop };
}

test('settings save writes metadata.json and refuses other origins and bad values', async () => {
  const root = mkdtempSync(join(tmpdir(), 'aspect-save-'));
  const { dir } = scaffoldAspect({
    template: sample('modal').template,
    name: 'acme-promo',
    targetRoot: root,
  });
  const before = read(join(dir, 'metadata.json'));
  const { post, stop } = await preview({ aspects: [dir] });
  try {
    const answers = {
      ...answersFromMetadata(sample('modal').template, before),
      title: 'Go green',
    };

    const foreign = await post(
      '/api/aspects/acme-promo/settings',
      { answers },
      { Origin: 'https://evil.example' },
    );
    assert.equal(foreign.status, 403);
    const bad = await post('/api/aspects/acme-promo/settings', {
      answers: { ...answers, accentColor: 'red' },
    });
    assert.equal(bad.status, 422);
    assert.deepEqual(read(join(dir, 'metadata.json')), before);

    const ok = await post('/api/aspects/acme-promo/settings', { answers });
    assert.equal(ok.status, 200);
    const after = read(join(dir, 'metadata.json'));
    assert.equal(prop(after, 'ASPECT_SCRIPT_acmepromo_DATA_title'), 'Go green');
    assert.deepEqual(loaderEntry(after), loaderEntry(before));
    assert.equal(after.sector, 'RETAIL');

    // Sector is saved with the settings; anything but RETAIL or BUSINESS is ignored.
    await post('/api/aspects/acme-promo/settings', {
      answers,
      sector: 'BUSINESS',
    });
    assert.equal(read(join(dir, 'metadata.json')).sector, 'BUSINESS');
    await post('/api/aspects/acme-promo/settings', {
      answers,
      sector: 'ADMIN',
    });
    assert.equal(read(join(dir, 'metadata.json')).sector, 'BUSINESS');
  } finally {
    stop();
    rmSync(root, { recursive: true, force: true });
  }
});

test('a sample is never written; "Create my aspect" copies it with the edited values', async () => {
  const root = mkdtempSync(join(tmpdir(), 'aspect-copy-'));
  const sampleDir = join(samples, 'chatbot');
  const original = readFileSync(join(sampleDir, 'metadata.json'), 'utf8');
  const { post, stop } = await preview({
    aspects: [sampleDir],
    newAspectRoot: root,
  });
  try {
    const answers = {
      ...answersFromMetadata(sample('chatbot').template, JSON.parse(original)),
      title: 'Ask Acme',
    };
    const save = await post('/api/aspects/chatbot/settings', {
      answers,
    });
    assert.equal(save.status, 403);
    assert.equal(
      readFileSync(join(sampleDir, 'metadata.json'), 'utf8'),
      original,
    );

    const badName = await post('/api/aspects/chatbot/copy', {
      answers,
      name: 'Acme Chat',
    });
    assert.equal(badName.status, 400);
    const copy = await post('/api/aspects/chatbot/copy', {
      answers,
      name: 'acme-chat',
    });
    assert.equal(copy.status, 200);
    assert.ok(existsSync(join(root, 'acme-chat', 'static-loader.v1.js')));
    const created = read(join(root, 'acme-chat', 'metadata.json'));
    assert.equal(
      prop(created, 'ASPECT_SCRIPT_acmechat_DATA_title'),
      'Ask Acme',
    );
    const again = await post('/api/aspects/chatbot/copy', {
      answers,
      name: 'acme-chat',
    });
    assert.equal(again.status, 409);
  } finally {
    stop();
    rmSync(root, { recursive: true, force: true });
  }
});

test('the modal Page offers the Developer Console pages the apps can show', async () => {
  const { pageLabel } = await import('../src/form-values.mjs');
  const { template } = sample('modal');
  const page = template.fields.find((f) => f.key === 'page');
  assert.equal(page.type, 'choice');
  assert.deepEqual(
    page.options.map((o) => page.optionLabels[o]),
    ['Home Page', 'My Settings Page', 'My Accounts Page'],
  );
  for (const o of page.options)
    assert.equal(pageLabel(o), page.optionLabels[o]);
  // The console still offers Transaction History; neither app shows aspects there, so the template doesn't.
  assert.equal(pageLabel('/app/home/olb/history'), 'Transaction History Page');
  assert.ok(validateAnswers(template, { page: '/app/home/payments' }).page);
});

test('a modal on the Transaction History route is an error: neither app mounts it', async () => {
  const { normalizeSubmission, checkSubmission } =
    await import('../src/conformance.mjs');
  const rules = read(
    join(dirname(fileURLToPath(import.meta.url)), '../src/mobile-rules.json'),
  );
  const { template, metadata } = sample('modal');
  const answers = {
    ...answersFromMetadata(template, metadata),
    page: '/app/home/olb/history',
  };
  const findings = checkSubmission(
    normalizeSubmission(withAnswers(template, metadata, answers)),
    rules,
    {},
  );
  assert.ok(
    findings.some(
      (f) =>
        f.level === 'error' &&
        f.field === 'Page' &&
        /Neither app shows aspects on Transaction History/.test(f.message),
    ),
  );
});

test('each console page lands on the mobile screen the iOS app maps it to', async () => {
  const { screenForPage } = await import('../src/form-values.mjs');
  assert.equal(screenForPage('/app/home'), 'home');
  assert.equal(screenForPage('/app/home/olb/accounts'), 'home');
  assert.equal(screenForPage('/app/home/settings/overview/'), 'settings');
  assert.equal(screenForPage('My Settings Page'), 'settings');
  assert.equal(screenForPage('/app/home/olb/history?tab=1'), 'transactions');
  assert.equal(screenForPage('/app/home/payments'), null);
});

test('swapOrigin replaces the preview default origin only', () => {
  const from = 'http://127.0.0.1:4310';
  const to = 'http://127.0.0.1:4313';
  assert.deepEqual(
    swapOrigin(
      {
        ui: `${from}/aspects/modal/promotion-sheet-ui.html`,
        csp: `frame-src 'self' ${from}`,
        other: 'http://127.0.0.1:43100/x.html',
      },
      from,
      to,
    ),
    {
      ui: `${to}/aspects/modal/promotion-sheet-ui.html`,
      csp: `frame-src 'self' ${to}`,
      other: 'http://127.0.0.1:43100/x.html',
    },
  );
});

test('the samples follow the port the preview runs on', async () => {
  const p = await preview();
  try {
    const config = await (await fetch(`${p.base}/api/config`)).json();
    const text = JSON.stringify(config.aspects.filter((a) => a.isTemplate));
    assert.ok(text.includes(p.base), 'samples use the running address');
    if (!p.base.endsWith(':4310')) assert.ok(!text.includes('127.0.0.1:4310'));
  } finally {
    p.stop();
  }
});

test('a taken port moves on to the next free one', async () => {
  const blocker = createServer();
  const taken = await new Promise((r) =>
    blocker.listen(0, '127.0.0.1', () => r(blocker.address().port)),
  );
  const p = startPreviewServer({ port: taken });
  try {
    await new Promise((r) => p.server.once('listening', r));
    assert.notEqual(p.server.address().port, taken);
    assert.equal(p.url, `http://127.0.0.1:${p.server.address().port}`);
  } finally {
    p.stop();
    blocker.close();
  }
});

test('serve arguments: Nx forms and the proxyConfig every Nx serve target gets', () => {
  // nx.json targetDefaults give every serve target proxyConfig; run-commands passes --name=value.
  assert.deepEqual(parseArgs(['--proxyConfig=proxy.config.json']), {
    aspects: [],
  });
  assert.deepEqual(
    parseArgs(['--proxyConfig', 'proxy.config.json', '--port', '4399']),
    {
      aspects: [],
      port: 4399,
    },
  );
  assert.deepEqual(
    parseArgs([
      '--port=4398',
      '--strict-port',
      '--aspect=./a',
      '--aspect',
      './b',
    ]),
    { aspects: ['./a', './b'], port: 4398, strictPort: true },
  );
  assert.equal(parseArgs(['--strict-port=false']).strictPort, false);
  assert.throws(() => parseArgs(['--port=abc']), /--port needs a number/);
  assert.throws(() => parseArgs(['--nope']), /Unknown argument: --nope/);
});

test('a taken port with strictPort is reported through onError, not thrown', async () => {
  const blocker = createServer();
  await new Promise((r) => blocker.listen(0, '127.0.0.1', r));
  const { port } = blocker.address();
  try {
    const err = await new Promise((resolve, reject) => {
      startPreviewServer({
        aspects: [],
        port,
        strictPort: true,
        onReady: () => reject(new Error('should not start')),
        onError: resolve,
      });
    });
    assert.equal(err.code, 'EADDRINUSE');
    assert.match(err.message, new RegExp(`Port ${port} is already in use`));
  } finally {
    blocker.close();
  }
});
