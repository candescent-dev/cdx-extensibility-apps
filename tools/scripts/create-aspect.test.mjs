import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { listTemplates, scaffoldAspect } from './create-web-aspect.mjs';

const KEY_PROPERTY = 'ASPECT_PROPERTY_WEB_STATICLOADERKEY';
const template = (folder) => listTemplates().find((t) => t.folder === folder);
const propOf = (metadata) => (name) =>
  metadata.properties.find((p) => p.propertyName === name)?.propertyValue;
const withTempRoot = (fn) => {
  const root = mkdtempSync(join(tmpdir(), 'web-aspect-'));
  try {
    return fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

test('lists chatbot and modal templates', () => {
  assert.deepEqual(
    listTemplates()
      .map((t) => t.folder)
      .sort(),
    ['chatbot', 'modal']
  );
});

test('scaffolds a web chatbot aspect folder', () =>
  withTempRoot((root) => {
    const chatbot = template('chatbot');
    const { dir, files, metadata } = scaffoldAspect({
      template: chatbot,
      name: 'my-bank-chat',
      description: 'Chat',
      answers: { uiurl: 'https://ui.my-bank.com/chat.html' },
      targetRoot: root,
    });
    assert.deepEqual(files.sort(), [
      'aspect-extension.js',
      'metadata.json',
      'static-loader.js',
      'support-chat-ui.html',
      'template.json',
    ]);
    const prop = propOf(metadata);
    assert.equal(metadata.name, 'my-bank-chat');
    assert.equal(metadata.isEnabledWeb, true);
    assert.equal(metadata.isEnabledMobile, false);
    assert.equal(prop(KEY_PROPERTY), 'mybankchat');
    assert.match(prop('ASPECT_SCRIPT_mybankchat_URL'), /example-fi\.com/);
    assert.equal(
      prop('ASPECT_SCRIPT_mybankchat_DATA_uiurl'),
      'https://ui.my-bank.com/chat.html'
    );
    assert.equal(
      prop('ASPECT_SCRIPT_mybankchat_DATA_uiorigin'),
      undefined,
      'uiorigin is only for configurl, so it is not derived from uiurl'
    );
    assert.equal(prop('ASPECT_PROPERTY_WEB_PAGE'), '/app/home');
    assert.equal(prop('ASPECT_PROPERTY_WEB_MOUNTSTRATEGY'), undefined);
    const schema = JSON.parse(readFileSync(join(dir, 'template.json'), 'utf8'));
    assert.equal(schema.from, 'chatbot');
    assert.equal(schema.fixed.ASPECT_PROPERTY_WEB_PAGE, '/app/home');
    assert.equal(schema.scriptKey, 'mybankchat');
    assert.throws(
      () =>
        scaffoldAspect({
          template: chatbot,
          name: 'my-bank-chat',
          answers: { uiurl: 'https://ui.my-bank.com/chat.html' },
          targetRoot: root,
        }),
      /already exists/
    );
  }));

test('copies the sample extension, loader and UI page unchanged', () =>
  withTempRoot((root) => {
    for (const folder of ['chatbot', 'modal']) {
      const t = template(folder);
      const { dir } = scaffoldAspect({
        template: t,
        name: `copy-${folder}`,
        answers: { uiurl: 'https://ui.my-bank.com/page.html' },
        targetRoot: root,
      });
      for (const file of ['aspect-extension.js', t.loaderFile, t.uiFile]) {
        assert.equal(
          readFileSync(join(dir, file), 'utf8'),
          readFileSync(join(t.dir, file), 'utf8'),
          `${folder}/${file} must be copied as-is`
        );
      }
    }
  }));

test('a given static loader URL becomes the loader URL and a script-src origin', () =>
  withTempRoot((root) => {
    const { metadata } = scaffoldAspect({
      template: template('chatbot'),
      name: 'my-bank-chat',
      answers: {
        uiurl: 'https://ui.my-bank.com/chat.html',
        loaderurl: 'https://cdn.my-bank.com/aspects/chat.v1.js',
      },
      targetRoot: root,
    });
    const prop = propOf(metadata);
    assert.equal(
      prop('ASPECT_SCRIPT_mybankchat_URL'),
      'https://cdn.my-bank.com/aspects/chat.v1.js'
    );
    assert.match(
      prop('ASPECT_PROPERTY_WEB_CONTENTSECURITYPOLICY'),
      /script-src[^;]*https:\/\/cdn\.my-bank\.com/
    );
    assert.equal(prop('undefined'), undefined);
  }));

test('rejects missing https uiurl and bad names', () =>
  withTempRoot((root) => {
    const modal = template('modal');
    assert.throws(
      () =>
        scaffoldAspect({ template: modal, name: 'My_Chat', targetRoot: root }),
      /lowercase/
    );
    assert.throws(
      () =>
        scaffoldAspect({
          template: modal,
          name: 'promo-sheet',
          answers: { uiurl: 'http://x.com' },
          targetRoot: root,
        }),
      /https/
    );
  }));

test('hosted loader URL gate rejects http, placeholders, and invalid URLs', async () => {
  const { hostedLoaderUrlProblem, isPlaceholderUrl } = await import(
    './lib/web-aspect-metadata.mjs'
  );
  assert.equal(isPlaceholderUrl('not-a-url'), false);
  assert.match(hostedLoaderUrlProblem('not-a-url'), /not a valid URL/);
  assert.match(
    hostedLoaderUrlProblem('http://cdn.example.com/loader.js'),
    /https/
  );
  assert.match(
    hostedLoaderUrlProblem('https://cdn.example-fi.com/aspects/x.v1.js'),
    /placeholder/
  );
  assert.equal(
    hostedLoaderUrlProblem('https://cdn.my-bank.com/aspects/x.v1.js'),
    null
  );
});

test('readWebAspectFolder reports invalid template.json instead of throwing', async () => {
  const { readWebAspectFolder } = await import(
    './lib/prepare-web-aspect-submit.mjs'
  );
  withTempRoot((root) => {
    writeFileSync(
      join(root, 'metadata.json'),
      JSON.stringify({ name: 'broken' })
    );
    writeFileSync(join(root, 'template.json'), '{not json');
    assert.match(readWebAspectFolder(root).error, /invalid JSON/);

    writeFileSync(join(root, 'template.json'), JSON.stringify({ id: 'x' }));
    assert.match(readWebAspectFolder(root).error, /fields/);
  });
});

test('the static loader key defaults to the aspect Script Name', () =>
  withTempRoot((root) => {
    const { dir, metadata } = scaffoldAspect({
      template: template('modal'),
      name: 'promo-banner',
      answers: { uiurl: 'https://ui.my-bank.com/banner.html' },
      targetRoot: root,
    });
    const prop = propOf(metadata);
    assert.equal(prop(KEY_PROPERTY), 'promobanner');
    assert.ok(prop('ASPECT_SCRIPT_promobanner_URL') !== undefined);
    assert.equal(prop('ASPECT_SCRIPT_promobanner_DATA_bannerheight'), '320px');
    assert.equal(prop('ASPECT_PROPERTY_WEB_FREQUENCY'), 'oncePerSession');
    assert.equal(prop('ASPECT_PROPERTY_WEB_PAGE'), '/app/home');
    const schema = JSON.parse(readFileSync(join(dir, 'template.json'), 'utf8'));
    assert.equal(
      schema.fields.find((f) => f.key === 'staticloaderkey').default,
      'promobanner'
    );
    const help = schema.fields.find((f) => f.key === 'loaderurl').help;
    assert.match(help, /ASPECT_SCRIPT_promobanner_URL/);
    assert.doesNotMatch(help, /ASPECT_SCRIPT_modal_/);
  }));

test('an edited static loader key is used for every ASPECT_SCRIPT_ property', () =>
  withTempRoot((root) => {
    const { metadata } = scaffoldAspect({
      template: template('chatbot'),
      name: 'my-bank-chat',
      answers: {
        staticloaderkey: 'bankChat',
        uiurl: 'https://ui.my-bank.com/chat.html',
      },
      targetRoot: root,
    });
    const prop = propOf(metadata);
    assert.equal(prop(KEY_PROPERTY), 'bankChat');
    assert.ok(prop('ASPECT_SCRIPT_bankChat_URL') !== undefined);
    assert.equal(
      prop('ASPECT_SCRIPT_bankChat_DATA_uiurl'),
      'https://ui.my-bank.com/chat.html'
    );
  }));

test('paired OIDC fields must be set together at create', () =>
  withTempRoot((root) => {
    assert.throws(
      () =>
        scaffoldAspect({
          template: template('chatbot'),
          name: 'my-bank-chat',
          answers: {
            uiurl: 'https://ui.my-bank.com/chat.html',
            oidcclientid: 'my-client',
          },
          targetRoot: root,
        }),
      /is needed when/
    );
  }));

test('nextSteps asks to host the loader until a loader URL is set', async () => {
  const { nextSteps } = await import('./lib/web-aspect-metadata.mjs');
  const chatbot = template('chatbot');
  const without = nextSteps(chatbot, {
    uiurl: 'https://ui.my-bank.com/c.html',
  });
  assert.ok(without.needed.some((n) => /Submit asks for it/.test(n)));
  assert.ok(without.needed.some((n) => /support-chat-ui\.html/.test(n)));
  const withUrl = nextSteps(chatbot, {
    uiurl: 'https://ui.my-bank.com/c.html',
    loaderurl: 'https://cdn.my-bank.com/l.v1.js',
  });
  assert.ok(
    withUrl.needed.some((n) =>
      /Upload static-loader\.js to https:\/\/cdn\.my-bank\.com/.test(n)
    )
  );
});

test('submit asks for the missing OIDC partner and retries a loader that fails to download', async () => {
  const { prepareWebAspect } = await import(
    './lib/prepare-web-aspect-submit.mjs'
  );
  const root = mkdtempSync(join(tmpdir(), 'web-aspect-'));
  const realFetch = globalThis.fetch;
  try {
    const { dir } = scaffoldAspect({
      template: template('chatbot'),
      name: 'sub-chat',
      answers: { uiurl: 'https://ui.my-bank.com/chat.html' },
      targetRoot: root,
    });
    const loader = readFileSync(join(dir, 'static-loader.js'));
    globalThis.fetch = async (url) =>
      String(url).includes('missing')
        ? new Response('nope', { status: 404 })
        : new Response(loader, {
            status: 200,
            headers: { 'content-type': 'application/javascript' },
          });

    const metadataPath = join(dir, 'metadata.json');
    const md = JSON.parse(readFileSync(metadataPath, 'utf8'));
    md.properties.push({
      propertyName: 'ASPECT_PROPERTY_WEB_OIDCCLIENTID',
      propertyValue: 'my-client',
    });
    writeFileSync(metadataPath, JSON.stringify(md));

    await assert.rejects(
      prepareWebAspect({
        dir,
        loaderUrl: 'https://cdn.my-bank.com/l.v1.js',
        persist: false,
      }),
      /is needed when/
    );

    const asked = [];
    const answers = [
      'https://partner.my-bank.com/exchange',
      'https://cdn.my-bank.com/l.v1.js',
    ];
    const result = await prepareWebAspect({
      dir,
      loaderUrl: 'https://cdn.my-bank.com/missing.v1.js',
      persist: false,
      ask: async (question, _def, error) => {
        asked.push({ question, error });
        return answers.shift();
      },
    });
    assert.match(asked[0].error, /is needed when/);
    assert.match(asked[1].question, /Hosted https URL/);
    const prop = propOf(result.metadata);
    assert.equal(
      prop('ASPECT_PROPERTY_WEB_REDIRECTURL'),
      'https://partner.my-bank.com/exchange'
    );
    assert.equal(
      prop('ASPECT_SCRIPT_subchat_URL'),
      'https://cdn.my-bank.com/l.v1.js'
    );
    assert.match(prop('ASPECT_SCRIPT_subchat_SRI'), /^sha384-/);
    assert.ok(result.body.startsWith('Metadata:\n{'));
  } finally {
    globalThis.fetch = realFetch;
    rmSync(root, { recursive: true, force: true });
  }
});

test('submit rejects a static loader key that does not match the loader property', async () => {
  const { prepareWebAspect } = await import(
    './lib/prepare-web-aspect-submit.mjs'
  );
  const root = mkdtempSync(join(tmpdir(), 'web-aspect-'));
  try {
    const { dir } = scaffoldAspect({
      template: template('modal'),
      name: 'promo-banner',
      answers: { uiurl: 'https://ui.my-bank.com/banner.html' },
      targetRoot: root,
    });
    const metadataPath = join(dir, 'metadata.json');
    const md = JSON.parse(readFileSync(metadataPath, 'utf8'));
    md.properties.find((p) => p.propertyName === KEY_PROPERTY).propertyValue =
      'other';
    writeFileSync(metadataPath, JSON.stringify(md));
    await assert.rejects(
      prepareWebAspect({
        dir,
        loaderUrl: 'https://cdn.my-bank.com/l.v1.js',
        persist: false,
      }),
      /must match/
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('create-aspect reads --platform and rejects unknown platforms', async () => {
  const { splitPlatform } = await import('./create-aspect-platform.mjs');
  assert.deepEqual(splitPlatform(['--platform', 'Web', '--name', 'x']), {
    platform: 'web',
    rest: ['--name', 'x'],
  });
  assert.deepEqual(splitPlatform(['--', '--yes']), {
    platform: undefined,
    rest: ['--yes'],
  });
  assert.throws(() => splitPlatform(['--platform', 'tv']), /Unknown platform/);
});

test('ensureCspOrigins drops an origin only the previous values needed, keeping manual ones', async () => {
  const { ensureCspOrigins } = await import('./lib/web-aspect-metadata.mjs');
  const template = JSON.parse(
    readFileSync(
      new URL(
        '../../samples/web/aspects/chatbot/template.json',
        import.meta.url
      ),
      'utf8'
    )
  );
  const csp = 'ASPECT_PROPERTY_WEB_CONTENTSECURITYPOLICY';
  const metadata = {
    properties: [
      {
        propertyName: csp,
        propertyValue:
          "script-src 'self'; frame-src 'self' https://old.bank.test https://manual.bank.test",
      },
    ],
  };
  const out = ensureCspOrigins(
    metadata,
    template,
    { uiurl: 'https://new.bank.test/ui.html' },
    { uiurl: 'https://old.bank.test/ui.html' }
  );
  const value = out.properties.find(
    (p) => p.propertyName === csp
  ).propertyValue;
  assert.match(value, /https:\/\/new\.bank\.test/);
  assert.match(value, /https:\/\/manual\.bank\.test/);
  assert.doesNotMatch(value, /https:\/\/old\.bank\.test/);
});

test('submit drops the CSP origin of a UI URL it re-asks and keeps manual additions', async () => {
  const { prepareWebAspect } = await import(
    './lib/prepare-web-aspect-submit.mjs'
  );
  const root = mkdtempSync(join(tmpdir(), 'web-aspect-'));
  const realFetch = globalThis.fetch;
  try {
    const { dir } = scaffoldAspect({
      template: template('chatbot'),
      name: 'csp-chat',
      answers: { uiurl: 'https://ui.my-bank.com/chat.html' },
      targetRoot: root,
    });
    const loader = readFileSync(join(dir, 'static-loader.js'));
    globalThis.fetch = async () =>
      new Response(loader, {
        status: 200,
        headers: { 'content-type': 'application/javascript' },
      });
    // A saved http:// UI URL: its origin is in the CSP, but submit asks for an https one.
    const metadataPath = join(dir, 'metadata.json');
    const md = JSON.parse(readFileSync(metadataPath, 'utf8'));
    for (const p of md.properties) {
      if (p.propertyValue === 'https://ui.my-bank.com/chat.html')
        p.propertyValue = 'http://old.my-bank.com/chat.html';
      else if (typeof p.propertyValue === 'string')
        p.propertyValue = p.propertyValue.replaceAll(
          'https://ui.my-bank.com',
          'http://old.my-bank.com https://manual.my-bank.com'
        );
    }
    writeFileSync(metadataPath, JSON.stringify(md));

    const result = await prepareWebAspect({
      dir,
      loaderUrl: 'https://cdn.my-bank.com/l.v1.js',
      persist: false,
      ask: async () => 'https://new.my-bank.com/chat.html',
    });
    const csp = propOf(result.metadata)(
      'ASPECT_PROPERTY_WEB_CONTENTSECURITYPOLICY'
    );
    assert.match(csp, /https:\/\/new\.my-bank\.com/);
    assert.match(csp, /https:\/\/manual\.my-bank\.com/);
    assert.doesNotMatch(csp, /http:\/\/old\.my-bank\.com/);
  } finally {
    globalThis.fetch = realFetch;
    rmSync(root, { recursive: true, force: true });
  }
});
