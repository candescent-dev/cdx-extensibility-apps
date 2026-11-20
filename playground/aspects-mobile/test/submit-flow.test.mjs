import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import {
  answersFromMetadata,
  buildCsp,
  buildMetadata,
  checkLinkFields,
  checkTemplateConfig,
  checkUiAllowlists,
  fillUiAllowlists,
  readUiAllowlist,
  isPlaceholderUrl,
  loaderEntry,
  prBody,
  scriptKeyFor,
  submitProblem,
  validateField,
  validateName,
  withAnswers,
} from '../src/metadata-builder.mjs';
import {
  parseMetadataInput,
  normalizeSubmission,
} from '../src/conformance.mjs';
import {
  listTemplates,
  parseArgs as parseCreateArgs,
  scaffoldAspect,
  select,
} from '../../../tools/scripts/create-aspect.mjs';
import { hostedLoaderHash, prepareMobileAspect } from '../prepare-submit.mjs';
import { readAspectFolder } from '../serve.mjs';
import { runCheck } from '../check.mjs';

const samples = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../samples/mobile/aspects',
);
const template = (id) => ({
  dir: join(samples, id),
  ...JSON.parse(readFileSync(join(samples, id, 'template.json'), 'utf8')),
});
const prop = (m, name) => m.properties.find((p) => p.propertyName === name);

test('metadata uses the console property shape and labels', () => {
  const m = buildMetadata({
    template: template('chatbot'),
    name: 'my-bank-chat',
    description: 'Chat',
  });
  const url = prop(m, 'ASPECT_SCRIPT_mybankchat_URL');
  assert.deepEqual(Object.keys(url), [
    'propertyName',
    'propertyType',
    'propertyLabel',
    'propertyValue',
    'propertyValueLocale',
    'isRichText',
    'isLocalized',
    'isLocked',
  ]);
  assert.equal(url.propertyLabel, 'Loader Script URL');
  assert.equal(
    prop(m, 'ASPECT_PROPERTY_MOBILE_PLACEMENTID').propertyLabel,
    'Placement Id',
  );
  assert.equal(
    prop(m, 'ASPECT_SCRIPT_mybankchat_DATA_accentcolor').propertyLabel,
    'accentcolor',
  );
  assert.equal(m.widgetType, 'ASPECT');
  assert.equal(m.isEnabledMobile, true);
  assert.equal(m.isEnabledWeb, false);
  assert.ok(isPlaceholderUrl(url.propertyValue));
});

test('UI, runtime config and session origins go into frame-src and connect-src', () => {
  const csp = buildCsp(template('chatbot'), {
    uiUrl: 'https://ui.my-bank-partner.com/chat',
    configUrl: 'https://cfg.my-bank-partner.com/v1/runtime',
    redirectUrl: 'https://api.my-bank-partner.com/aspect/session',
    apiUrl: 'https://chat.my-bank.com/v1/messages',
  });
  assert.match(csp, /frame-src 'self' https:\/\/ui\.my-bank-partner\.com/);
  const connect = csp.match(/connect-src ([^;]*)/)[1].split(' ');
  assert.deepEqual(connect.sort(), [
    "'self'",
    'https://api.my-bank-partner.com',
    'https://cfg.my-bank-partner.com',
  ]);
  // The chat backend is called by the partner UI page, not by the loader.
  assert.doesNotMatch(csp, /chat\.my-bank\.com/);
});

test('Data Attributes are plain values, one per setting (never JSON)', () => {
  const m = buildMetadata({
    template: template('chatbot'),
    name: 'my-bank-chat',
    answers: { apiUrl: 'https://chat.my-bank.com/api' },
  });
  const data = m.properties.filter((p) => p.propertyName.includes('_DATA_'));
  assert.deepEqual(
    data.map((p) => p.propertyName.split('_DATA_')[1]),
    ['title', 'greeting', 'accentcolor', 'uiurl', 'apiurl'],
  );
  assert.ok(data.every((p) => !/^\s*[{[]/.test(p.propertyValue)));
});

test('a legacy widget JSON attribute is still read back as answers', () => {
  const t = template('chatbot');
  const legacy = {
    properties: [
      {
        propertyName: 'ASPECT_SCRIPT_x_URL',
        propertyValue: 'https://cdn/x.v1.js',
      },
      {
        propertyName: 'ASPECT_SCRIPT_x_DATA_widget',
        propertyValue: '{"title":"Old title","helpUrl":"https://b.com/h"}',
      },
    ],
  };
  const a = answersFromMetadata(t, legacy);
  assert.equal(a.title, 'Old title');
  assert.equal(a.helpUrl, 'https://b.com/h');
});

test('answers round-trip through metadata', () => {
  const t = template('modal');
  const m = buildMetadata({
    template: t,
    name: 'promo-sheet',
    answers: { ctaUrl: 'https://www.my-bank.com/offer', size: 'large' },
  });
  const a = answersFromMetadata(t, m);
  assert.equal(a.ctaUrl, 'https://www.my-bank.com/offer');
  assert.equal(a.size, 'large');
  assert.equal(a.page, '/app/home');
});

test('field and name validation', () => {
  const t = template('chatbot');
  const field = (k) => t.fields.find((f) => f.key === k);
  assert.match(validateField(field('helpUrl'), 'http://x.com'), /https/);
  assert.equal(validateField(field('helpUrl'), ''), null);
  assert.match(validateField(field('accentColor'), 'blue'), /hex/);
  assert.match(validateField(field('size'), 'huge'), /one of/);
  assert.match(validateName('My_Chat'), /lowercase/);
  assert.equal(validateName('my-bank-chat'), null);
  assert.equal(scriptKeyFor('my-bank-chat'), 'mybankchat');
});

test('template checks warn about demo mode and placeholder links', () => {
  const chat = template('chatbot');
  assert.ok(
    checkTemplateConfig(
      chat,
      buildMetadata({ template: chat, name: 'c1' }),
    ).some((f) => f.level === 'warn' && /echoes/.test(f.message)),
  );
  const modal = template('modal');
  assert.ok(
    checkTemplateConfig(
      modal,
      buildMetadata({ template: modal, name: 'm1' }),
    ).some((f) => /example-fi\.com/.test(f.message)),
  );
});

test('the PR body is exactly the metadata block the backend parses', () => {
  const m = buildMetadata({
    template: template('modal'),
    name: 'promo-sheet',
  });
  const body = prBody(m);
  assert.ok(body.startsWith('Metadata:\n{'));
  assert.ok(body.endsWith('}'));
  assert.deepEqual(parseMetadataInput(body), m);
});

test('create-aspect scaffolds a folder the preview and submit can read', () => {
  const root = mkdtempSync(join(tmpdir(), 'aspects-'));
  try {
    const t = listTemplates(samples).find((x) => x.type === 'chatbot');
    const { dir, files, metadata } = scaffoldAspect({
      template: t,
      name: 'my-bank-chat',
      description: 'Chat',
      answers: { apiUrl: 'https://chat.my-bank.com/api' },
      targetRoot: root,
    });
    assert.deepEqual(files.sort(), [
      'aspect-extension.js',
      'metadata.json',
      'static-loader.v1.js',
      'support-chat-ui.html',
      'template.json',
    ]);
    assert.match(
      readFileSync(join(dir, 'aspect-extension.js'), 'utf8'),
      /staticLoaderKey = 'mybankchat'/,
    );
    assert.match(
      readFileSync(join(dir, 'static-loader.v1.js'), 'utf8'),
      /LOG = '\[my-bank-chat\]'/,
    );
    // Only the Script Name is renamed, never other strings equal to the template id.
    assert.match(
      readFileSync(join(dir, 'static-loader.v1.js'), 'utf8'),
      /ASPECT_TYPE = 'chatbot'/,
    );
    assert.equal(loaderEntry(metadata).key, 'mybankchat');
    const sub = normalizeSubmission(metadata);
    // The chat backend is called by the partner UI page, so it is not in the aspect CSP; the UI
    // origin is in frame-src, and the preview default now points at this aspect's own UI copy.
    assert.doesNotMatch(sub.csp, /chat\.my-bank\.com/);
    assert.match(sub.csp, /frame-src 'self' http:\/\/127\.0\.0\.1:4310/);
    assert.match(
      JSON.stringify(metadata),
      /\/aspects\/my-bank-chat\/support-chat-ui\.html/,
    );
    assert.throws(
      () =>
        scaffoldAspect({ template: t, name: 'my-bank-chat', targetRoot: root }),
      /already exists/,
    );
    assert.throws(
      () =>
        scaffoldAspect({
          template: t,
          name: 'x2',
          answers: { helpUrl: 'http://x' },
          targetRoot: root,
        }),
      /https/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('create-aspect lets the UI page call the chat backend it was given', async () => {
  const root = mkdtempSync(join(tmpdir(), 'aspects-'));
  try {
    const t = listTemplates(samples).find((x) => x.type === 'chatbot');
    const { dir } = scaffoldAspect({
      template: t,
      name: 'my-bank-chat',
      answers: { apiUrl: 'https://chat.my-bank.com/api' },
      targetRoot: root,
    });
    const ui = readFileSync(join(dir, 'support-chat-ui.html'), 'utf8');
    assert.deepEqual(readUiAllowlist(ui, 'ALLOWED_API_ORIGINS'), [
      'https://chat.my-bank.com',
    ]);
    assert.deepEqual(readUiAllowlist(ui, 'ALLOWED_HOST_ORIGINS'), []);
    const warn = (findings) =>
      findings.filter(
        (f) => f.field === 'Template · apiUrl' && f.level === 'warn',
      );
    assert.deepEqual(warn((await runCheck(dir)).findings), []);

    // A later apiUrl change that the UI page doesn't list is reported.
    const m = JSON.parse(readFileSync(join(dir, 'metadata.json'), 'utf8'));
    const answers = {
      ...answersFromMetadata(t, m),
      apiUrl: 'https://bot.other.com/chat',
    };
    const [finding] = checkUiAllowlists(t, answers, ui);
    assert.match(
      finding.message,
      /https:\/\/bot\.other\.com is not in its ALLOWED_API_ORIGINS/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('UI allowlists: same-origin default, no duplicates, no list means no check', () => {
  const t = template('chatbot');
  const src = 'var ALLOWED_API_ORIGINS = [];';
  const ui = 'https://www.my-bank.com/chat/ui.html';
  assert.deepEqual(
    checkUiAllowlists(
      t,
      { uiUrl: ui, apiUrl: 'https://www.my-bank.com/api' },
      src,
    ),
    [],
  );
  assert.equal(
    checkUiAllowlists(
      t,
      { uiUrl: ui, apiUrl: 'https://chat.other.com/api' },
      src,
    ).length,
    1,
  );
  assert.deepEqual(
    checkUiAllowlists(t, { apiUrl: 'https://x.com' }, 'no list'),
    [],
  );
  const once = fillUiAllowlists(t, { apiUrl: 'https://x.com/a' }, src);
  assert.equal(fillUiAllowlists(t, { apiUrl: 'https://x.com/b' }, once), once);
  assert.equal(fillUiAllowlists(t, { apiUrl: '' }, src), src);
});

test('the template menu moves with the arrow keys and picks with Enter', async () => {
  const { PassThrough } = await import('node:stream');
  const input = new PassThrough();
  input.setRawMode = () => {};
  let shown = '';
  const output = { columns: 60, write: (t) => (shown += t) };
  const choices = [
    { label: 'Support Chat (chatbot)', hint: 'x'.repeat(200) },
    { label: 'Promotion Sheet (modal)' },
  ];
  const picked = select('Template', choices, { input, output });
  input.write('\x1b[B'); // down
  input.write('\r');
  assert.equal(await picked, 1);
  assert.match(shown, /Template: Promotion Sheet \(modal\)\n$/);
  // Long descriptions are cut to the terminal width so the menu redraws in place.
  assert.ok(
    shown
      .split('\n')
      .every((l) => l.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '').length <= 60),
  );
});

test('a hosted loader URL that fails to download is asked again', async () => {
  const root = mkdtempSync(join(tmpdir(), 'aspects-'));
  const realFetch = globalThis.fetch;
  try {
    const t = listTemplates(samples).find((x) => x.type === 'modal');
    const { dir } = scaffoldAspect({
      template: t,
      name: 'promo-sheet',
      targetRoot: root,
    });
    const loader = readFileSync(join(dir, 'static-loader.v1.js'));
    globalThis.fetch = async (url) =>
      String(url).includes('missing')
        ? new Response('no', { status: 404 })
        : new Response(loader, {
            status: 200,
            headers: { 'access-control-allow-origin': '*' },
          });
    const urls = [
      'http://cdn.bank.test/l.js',
      'https://cdn.missing.test/l.js',
      'https://cdn.bank.test/l.js',
    ];
    const errors = [];
    const ask = async (question, def, error) => {
      if (error) errors.push(error);
      return /Hosted https URL/.test(question)
        ? urls.shift()
        : def || 'https://ui.bank.test/page.html';
    };
    const { metadata } = await prepareMobileAspect({ dir, ask });
    assert.equal(loaderEntry(metadata).url, 'https://cdn.bank.test/l.js');
    // The reason reaches the next question, so it can be shown in place.
    assert.ok(errors.some((m) => /is not an https URL/.test(m)));
    assert.ok(errors.some((m) => /returned HTTP 404/.test(m)));
    // Without prompts the same failure stops the submit.
    await assert.rejects(
      prepareMobileAspect({ dir, loaderUrl: 'https://cdn.missing.test/l.js' }),
      /returned HTTP 404/,
    );
  } finally {
    globalThis.fetch = realFetch;
    rmSync(root, { recursive: true, force: true });
  }
});

test('create lists what is left before submit and shows values as people read them', async () => {
  const { nextSteps, shownValue } =
    await import('../../../tools/scripts/create-aspect.mjs');
  const t = template('chatbot');
  const values = Object.fromEntries(
    t.fields.map((f) => [f.key, f.default ?? '']),
  );
  const { needed, recommended } = nextSteps(t, values);
  assert.match(needed[0], /Host your copy of support-chat-ui\.html/);
  assert.match(needed.at(-1), /static-loader\.v1\.js/);
  assert.ok(recommended.some((r) => /^Chat backend URL:/.test(r)));
  const done = nextSteps(t, {
    ...values,
    uiUrl: 'https://ui.my-bank.com/chat.html',
    apiUrl: 'https://chat.my-bank.com/api',
  });
  assert.equal(done.needed.length, 1);
  assert.deepEqual(done.recommended, []);
  const size = t.fields.find((f) => f.key === 'size');
  assert.equal(shownValue(size, 'large'), 'Large (full screen)');
  assert.equal(shownValue(size, ''), 'not set');
});

test('piped answers: numbered menus with a default, and the default for Enter', async () => {
  const { PassThrough } = await import('node:stream');
  const { createPrompter } = await import('../../../tools/scripts/prompt.mjs');
  const input = new PassThrough();
  let shown = '';
  const output = new PassThrough();
  output.on('data', (d) => (shown += d));
  const p = createPrompter({ input, output });
  input.end('\n9\n2\nmy-name\n');
  assert.equal(await p.ask('Title', 'Need help?'), 'Need help?');
  assert.equal(
    await p.choose('Sector', [{ label: 'Retail' }, { label: 'Business' }]),
    1,
  );
  assert.equal(await p.ask('Name'), 'my-name');
  await assert.rejects(p.ask('More'), /Input ended/);
  p.close();
  assert.match(shown, /1\. Retail \(default\)/);
  assert.match(shown, /Enter a number from 1 to 2\./);
});

test('submit preparation stops before any network or git step when values are missing', async () => {
  const root = mkdtempSync(join(tmpdir(), 'aspects-'));
  try {
    const t = listTemplates(samples).find((x) => x.type === 'modal');
    const { dir } = scaffoldAspect({
      template: t,
      name: 'promo-sheet',
      targetRoot: root,
    });
    await assert.rejects(prepareMobileAspect({ dir }), /placeholder/);

    const metadata = JSON.parse(
      readFileSync(join(dir, 'metadata.json'), 'utf8'),
    );
    writeFileSync(
      join(dir, 'metadata.json'),
      JSON.stringify({ ...metadata, name: 'other-name' }),
    );
    await assert.rejects(prepareMobileAspect({ dir }), /must match/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a hosted loader with a different file name still maps to the local loader', () => {
  const root = mkdtempSync(join(tmpdir(), 'aspects-'));
  try {
    const t = listTemplates(samples).find((x) => x.type === 'chatbot');
    const { dir, metadata } = scaffoldAspect({
      template: t,
      name: 'my-bank-chat',
      targetRoot: root,
    });
    const url = prop(metadata, 'ASPECT_SCRIPT_mybankchat_URL');
    url.propertyValue = 'https://cdn.my-bank.com/assets/chat-4f2a.js';
    writeFileSync(join(dir, 'metadata.json'), JSON.stringify(metadata));
    assert.deepEqual(readAspectFolder(dir).localLoaders, {
      mybankchat: 'static-loader.v1.js',
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('submit gives up after three invalid hosted URL answers', async () => {
  const root = mkdtempSync(join(tmpdir(), 'aspects-'));
  try {
    const t = listTemplates(samples).find((x) => x.type === 'modal');
    const { dir } = scaffoldAspect({
      template: t,
      name: 'promo-sheet',
      targetRoot: root,
    });
    const asked = [];
    const ask = async (question, def) => {
      asked.push(question);
      if (/Hosted https URL/.test(question)) return 'not a url';
      // Preview-only defaults are never offered, so answer those with a hosted URL.
      return def || 'https://ui.bank.test/page.html';
    };
    await assert.rejects(
      prepareMobileAspect({ dir, ask, log: () => {} }),
      /No valid hosted loader URL/,
    );
    assert.equal(asked.filter((q) => /Hosted https URL/.test(q)).length, 3);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('hosted loader hash is taken from the served bytes', async () => {
  const bytes = Buffer.from('console.log("loader");');
  const server = createServer((req, res) => {
    if (req.url === '/loader.v1.js') return res.end(bytes);
    if (req.url === '/moved.js') {
      res.writeHead(302, { Location: '/login' });
      return res.end();
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const ok = await hostedLoaderHash(`${base}/loader.v1.js`);
    assert.equal(
      ok.sri,
      `sha384-${createHash('sha384').update(bytes).digest('base64')}`,
    );
    assert.match(
      (await hostedLoaderHash(`${base}/moved.js`)).problem,
      /redirects/,
    );
    assert.match((await hostedLoaderHash(`${base}/missing.js`)).problem, /404/);
  } finally {
    server.close();
  }
});

test('submit refuses preview-only values: local UI page and example-fi.com links', async () => {
  const root = mkdtempSync(join(tmpdir(), 'aspects-'));
  try {
    const t = listTemplates(samples).find((x) => x.type === 'chatbot');
    const { dir } = scaffoldAspect({
      template: t,
      name: 'help-chat',
      targetRoot: root,
    });
    await assert.rejects(
      prepareMobileAspect({ dir }),
      /uiUrl: .*points at this machine/,
    );

    const asked = [];
    const ask = async (question, def) => {
      asked.push([question, def]);
      return /Hosted https URL/.test(question)
        ? 'not a url'
        : 'http://localhost:9999/ui.html';
    };
    await assert.rejects(
      prepareMobileAspect({ dir, ask, log: () => {} }),
      /uiUrl: no valid value given/,
    );
    // The local default is never offered as the suggested answer.
    assert.ok(asked.every(([, def]) => !/127\.0\.0\.1|localhost/.test(def)));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('submitProblem names the field and what to enter', () => {
  const f = { label: 'Your UI page URL' };
  assert.match(
    submitProblem(f, 'http://127.0.0.1:4310/ui.html'),
    /points at this machine/,
  );
  assert.match(submitProblem(f, 'https://www.example-fi.com/x'), /placeholder/);
  assert.equal(submitProblem(f, 'https://ui.bank.com/x'), null);
});

test('submit refuses a loader URL on this machine before downloading it', async () => {
  const root = mkdtempSync(join(tmpdir(), 'aspects-'));
  try {
    const t = listTemplates(samples).find((x) => x.type === 'chatbot');
    const { dir } = scaffoldAspect({
      template: t,
      name: 'help-chat',
      targetRoot: root,
      answers: { uiUrl: 'https://ui.bank.test/chat.html' },
    });
    await assert.rejects(
      prepareMobileAspect({
        dir,
        loaderUrl: 'http://127.0.0.1:4310/help-chat.v1.js',
      }),
      /loader URL points at this machine/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('the chatbot backend can point at the preview stand-in, but never reaches a submit', () => {
  const t = JSON.parse(
    readFileSync(join(samples, 'chatbot/template.json'), 'utf8'),
  );
  const f = t.fields.find((x) => x.key === 'apiUrl');
  for (const local of [
    'http://127.0.0.1:4310/demo/chat',
    'http://localhost:4311/demo/chat',
  ]) {
    assert.equal(validateField(f, local), null);
    assert.match(submitProblem(f, local), /points at this machine/);
  }
  assert.match(validateField(f, 'http://chat.bank.test/api'), /must use https/);
});

test('create-aspect accepts the `--` that pnpm run passes through', () => {
  const args = [
    '--template',
    'chatbot',
    '--name',
    'my-bank-chat',
    '--set',
    'apiUrl=https://chat.my-bank.com/api?a=b',
    '--yes',
  ];
  const expected = {
    set: { apiUrl: 'https://chat.my-bank.com/api?a=b' },
    template: 'chatbot',
    name: 'my-bank-chat',
    yes: true,
  };
  assert.deepEqual(parseCreateArgs(args), expected);
  assert.deepEqual(parseCreateArgs(['--', ...args]), expected);
  assert.throws(
    () => parseCreateArgs(['--', '--nope']),
    /Unknown option: --nope/,
  );
});

const CSP = 'ASPECT_PROPERTY_MOBILE_CONTENTSECURITYPOLICY';
const cspOf = (m) => prop(m, CSP).propertyValue;
// A CSP written without the link host, as in a console submission or an older aspect.
const withCsp = (m, value) => ({
  ...m,
  properties: m.properties.map((p) =>
    p.propertyName === CSP ? { ...p, propertyValue: value } : p,
  ),
});

test('link hosts are added to the CSP frame-src, so the app opens them', () => {
  const modal = template('modal');
  const m = buildMetadata({
    template: modal,
    name: 'promo',
    answers: {
      uiUrl: 'https://cdn.my-bank.com/promo/promotion-sheet-ui.html',
      ctaUrl: 'https://www.my-bank.com/offers/credit-card',
    },
  });
  const frameSrc = cspOf(m)
    .split(';')
    .map((d) => d.trim().split(/\s+/))
    .find(([d]) => d === 'frame-src');
  assert.deepEqual(frameSrc.slice(1).sort(), [
    "'self'",
    'https://cdn.my-bank.com',
    'https://www.my-bank.com',
  ]);
  assert.deepEqual(checkLinkFields(modal, m), []);

  // The placeholder is never added.
  assert.doesNotMatch(
    cspOf(buildMetadata({ template: modal, name: 'promo' })),
    /example-fi\.com/,
  );

  // The chatbot help link is added too; an empty help link adds nothing.
  const chat = template('chatbot');
  const answers = {
    uiUrl: 'https://cdn.my-bank.com/chat/support-chat-ui.html',
    apiUrl: 'https://chat.my-bank.com/api',
  };
  assert.match(
    cspOf(
      buildMetadata({
        template: chat,
        name: 'chat',
        answers: { ...answers, helpUrl: 'https://help.my-bank.com/faq' },
      }),
    ),
    /frame-src [^;]*https:\/\/help\.my-bank\.com/,
  );
  assert.doesNotMatch(
    cspOf(buildMetadata({ template: chat, name: 'chat', answers })),
    /help\.my-bank\.com/,
  );

  // Changing the link in Customize replaces the old host.
  const changed = withAnswers(modal, m, {
    ...answersFromMetadata(modal, m),
    ctaUrl: 'https://offers.my-bank.com/card',
  });
  assert.match(cspOf(changed), /https:\/\/offers\.my-bank\.com/);
  assert.doesNotMatch(cspOf(changed), /https:\/\/www\.my-bank\.com/);
});

test('a link host missing from the CSP is reported', () => {
  const modal = template('modal');
  const m = buildMetadata({
    template: modal,
    name: 'promo',
    answers: {
      uiUrl: 'https://cdn.my-bank.com/promo/promotion-sheet-ui.html',
      ctaUrl: 'https://www.my-bank.com/offers/credit-card',
    },
  });
  const stale = withCsp(m, cspOf(m).replace(' https://www.my-bank.com', ''));
  const [warning, ...rest] = checkLinkFields(modal, stale);
  assert.deepEqual(rest, []);
  assert.equal(warning.level, 'warn');
  assert.equal(warning.field, 'Template · ctaUrl');
  assert.match(
    warning.message,
    /www\.my-bank\.com isn't in the aspect's CSP frame-src or connect-src/,
  );
  // checkTemplateConfig includes the link check.
  assert.ok(
    checkTemplateConfig(modal, stale).some(
      (f) => f.message === warning.message,
    ),
  );
  // connect-src counts as well, as on the device.
  assert.deepEqual(
    checkLinkFields(
      modal,
      withCsp(
        stale,
        `${cspOf(stale)}; connect-src 'self' https://www.my-bank.com`,
      ),
    ),
    [],
  );
});

test('a pull request body gets the link check from the sample template of its type', async () => {
  const modal = template('modal');
  const m = buildMetadata({
    template: modal,
    name: 'promo',
    answers: {
      uiUrl: 'https://cdn.my-bank.com/promo/promotion-sheet-ui.html',
      ctaUrl: 'https://www.other-bank.com/offers',
    },
  });
  const body = `Metadata:\n${JSON.stringify(
    withCsp(m, cspOf(m).replace(' https://www.other-bank.com', '')),
  )}`;
  const dir = mkdtempSync(join(tmpdir(), 'pr-body-'));
  try {
    const file = join(dir, 'pr-body.txt');
    writeFileSync(file, body);
    const { findings } = await runCheck(file);
    assert.ok(
      findings.some(
        (f) =>
          f.field === 'Template · ctaUrl' &&
          /www\.other-bank\.com/.test(f.message),
      ),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// Scaffolds the modal sample and serves its loader as the hosted copy.
async function withHostedModal(run) {
  const root = mkdtempSync(join(tmpdir(), 'aspects-'));
  const realFetch = globalThis.fetch;
  try {
    const t = listTemplates(samples).find((x) => x.type === 'modal');
    const { dir } = scaffoldAspect({
      template: t,
      name: 'promo-sheet',
      targetRoot: root,
    });
    const loader = readFileSync(join(dir, 'static-loader.v1.js'));
    globalThis.fetch = async () =>
      new Response(loader, {
        status: 200,
        headers: { 'access-control-allow-origin': '*' },
      });
    const ask = (link) => async (question, def) =>
      /Hosted https URL/.test(question)
        ? 'https://cdn.bank.test/l.js'
        : /link|button/i.test(question)
          ? link
          : def || 'https://ui.bank.test/page.html';
    await run(dir, ask);
  } finally {
    globalThis.fetch = realFetch;
    rmSync(root, { recursive: true, force: true });
  }
}

test('persist: false leaves metadata.json untouched until persist() is called', async () => {
  await withHostedModal(async (dir, ask) => {
    const file = join(dir, 'metadata.json');
    const before = readFileSync(file, 'utf8');
    const result = await prepareMobileAspect({
      dir,
      ask: ask('https://offers.bank.test/card'),
      persist: false,
    });
    assert.equal(readFileSync(file, 'utf8'), before);
    // The checks ran on the prepared metadata, not the file on disk.
    assert.equal(
      loaderEntry(result.metadata).url,
      'https://cdn.bank.test/l.js',
    );
    result.persist();
    assert.equal(
      loaderEntry(JSON.parse(readFileSync(file, 'utf8'))).url,
      'https://cdn.bank.test/l.js',
    );
  });
});

test('a link replaced at submit drops its CSP origin and keeps manual additions', async () => {
  await withHostedModal(async (dir, ask) => {
    const file = join(dir, 'metadata.json');
    // A saved http:// link: its host is in the CSP, but submit asks for an https link instead.
    const m = JSON.parse(readFileSync(file, 'utf8'));
    for (const p of m.properties) {
      if (/_DATA_ctaurl$/.test(p.propertyName))
        p.propertyValue = 'http://old.bank.test/card';
      if (p.propertyName === CSP)
        p.propertyValue = p.propertyValue.replace(
          'frame-src',
          'frame-src http://old.bank.test https://manual.bank.test',
        );
    }
    writeFileSync(file, JSON.stringify(m, null, 2));
    const { metadata } = await prepareMobileAspect({
      dir,
      ask: ask('https://offers.bank.test/card'),
    });
    const frameSrc = cspOf(metadata)
      .match(/frame-src ([^;]*)/)[1]
      .split(' ');
    assert.ok(frameSrc.includes('https://offers.bank.test'));
    assert.ok(frameSrc.includes('https://manual.bank.test'));
    assert.ok(!frameSrc.includes('http://old.bank.test'));
  });
});

test('a CSP host no template value uses is reported, not removed', async () => {
  await withHostedModal(async (dir, ask) => {
    const file = join(dir, 'metadata.json');
    await prepareMobileAspect({
      dir,
      ask: ask('https://offers.bank.test/card'),
    });
    // The link is changed by hand, so submit can't tell the old host from a manual one.
    const m = JSON.parse(readFileSync(file, 'utf8'));
    for (const p of m.properties)
      if (p.propertyValue === 'https://offers.bank.test/card')
        p.propertyValue = 'https://new.bank.test/card';
    writeFileSync(file, JSON.stringify(m, null, 2));
    const logs = [];
    const { metadata } = await prepareMobileAspect({
      dir,
      loaderUrl: 'https://cdn.bank.test/l.js',
      log: (l) => logs.push(l),
    });
    assert.match(cspOf(metadata), /https:\/\/new\.bank\.test/);
    assert.ok(
      logs.some((l) => /frame-src https:\/\/offers\.bank\.test/.test(l)),
    );
  });
});

test('a malformed --loader-url is reported as such, not as the placeholder', async () => {
  await withHostedModal(async (dir, ask) => {
    await prepareMobileAspect({
      dir,
      ask: ask('https://offers.bank.test/card'),
    });
    await assert.rejects(
      prepareMobileAspect({ dir, loaderUrl: 'cdn.bank.test/l.js' }),
      (e) =>
        /not a hosted https URL/.test(e.message) &&
        !/placeholder/.test(e.message),
    );
  });
});
