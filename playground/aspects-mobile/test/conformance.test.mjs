import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  parseMetadataInput,
  normalizeSubmission,
  checkSubmission,
  checkCsp,
  checkSri,
  checkScriptUrl,
  checkMessage,
  checkNavigate,
  bootstrapKeys,
  hasErrors,
} from '../src/conformance.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const rules = JSON.parse(
  readFileSync(join(here, '../src/mobile-rules.json'), 'utf8'),
);
const samples = join(here, '../../../samples/mobile/aspects');
const read = (p) => readFileSync(join(samples, p), 'utf8');
const sample = (name) => JSON.parse(read(`${name}/metadata.json`));

function withProps(metadata, overrides) {
  const copy = structuredClone(metadata);
  for (const [name, value] of Object.entries(overrides)) {
    const existing = copy.properties.find((p) => p.propertyName === name);
    if (value === undefined)
      copy.properties = copy.properties.filter((p) => p.propertyName !== name);
    else if (existing) existing.propertyValue = value;
    else copy.properties.push({ propertyName: name, propertyValue: value });
  }
  return copy;
}

const errors = (findings) =>
  findings.filter((f) => f.level === 'error').map((f) => f.message);
const matches = (findings, re) => findings.some((f) => re.test(f.message));

for (const name of ['chatbot', 'modal']) {
  test(`${name} sample passes with no errors`, () => {
    const sub = normalizeSubmission(sample(name));
    const key = Object.keys(sub.scripts)[0];
    const findings = checkSubmission(sub, rules, {
      bootstrap: read(`${name}/aspect-extension.js`),
      loaders: {
        [key]: read(
          `${name}/${JSON.parse(read(`${name}/template.json`)).loaderFile}`,
        ),
      },
    });
    assert.deepEqual(errors(findings), []);
  });
}

test('parses the metadata block from a pull request body', () => {
  const body =
    'Metadata:\n{"name":"x","properties":[{"propertyName":"ASPECT_TYPE","propertyValue":"chatbot"}]}\n\n<!-- bot summary {not json} -->';
  assert.equal(parseMetadataInput(body).name, 'x');
});

test('normalizes scripts, data and html attributes by key', () => {
  const sub = normalizeSubmission(
    withProps(sample('chatbot'), {
      ASPECT_SCRIPT_chatbot_HTML_title: 'hello',
    }),
  );
  const s = sub.scripts.chatbot;
  assert.match(s.url, /chatbot\/static-loader\.v1\.js$/);
  assert.ok(s.sri.startsWith('sha384-'));
  assert.equal(s.data.title, 'Need help?');
  assert.equal(s.data.helpurl, 'https://www.example-fi.com/help');
  assert.equal(s.html.title, 'hello');
});

test('the empty-response hash is rejected', () => {
  assert.ok(
    matches(
      checkSri(
        'sha384-OLBgp1GsljhM2TJ+sbHjaiH9txEUvgdDTAzHv2P24donTt6/529l+9Ua0vFImLlb',
        rules,
      ),
      /empty response/,
    ),
  );
});

test('hex or truncated hashes are rejected', () => {
  assert.equal(checkSri('sha384-abc123', rules)[0].level, 'error');
  assert.equal(checkSri('a'.repeat(96), rules)[0].level, 'error');
});

test('storage.cloud.google.com links are rejected', () => {
  const f = checkScriptUrl(
    'https://storage.cloud.google.com/bucket/chatbot/static-loader.v1.js',
    rules,
  );
  assert.ok(hasErrors(f));
  assert.ok(matches(f, /storage\.googleapis\.com/));
});

test('unversioned loader file names are a warning', () => {
  const f = checkScriptUrl(
    'https://cdn.example-fi.com/aspects/loader.js',
    rules,
  );
  assert.equal(f[0].level, 'warn');
});

test('CSP: comma, missing nonce, unquoted keyword and frame-ancestors are errors', () => {
  assert.ok(
    matches(
      checkCsp("script-src 'self', https://cdn.example.com", rules),
      /comma/,
    ),
  );
  assert.ok(matches(checkCsp("script-src 'self'", rules), /nonce-aspect/));
  assert.ok(
    matches(checkCsp("script-src self 'nonce-aspect'", rules), /single quotes/),
  );
  assert.ok(
    matches(
      checkCsp(
        "script-src 'self' 'nonce-aspect'; frame-ancestors 'none'",
        rules,
      ),
      /frame-ancestors is not allowed on mobile/,
    ),
  );
  assert.ok(
    matches(
      checkCsp("script-src 'self' 'nonce-aspect' 'unsafe-eval'", rules),
      /unsafe-eval/,
    ),
  );
});

test('modal options the mobile app rejects are errors', () => {
  const base = sample('modal');
  const f = checkSubmission(
    normalizeSubmission(
      withProps(base, {
        ASPECT_PROPERTY_MOBILE_PLACEMENTID: 'fullscreen',
        ASPECT_PROPERTY_MOBILE_SANDBOXDIRECTIVES:
          'allow-scripts allow-same-origin allow-popups',
        ASPECT_PROPERTY_MOBILE_PERMISSIONPOLICY: 'camera=(self), microphone=()',
      }),
    ),
    rules,
  );
  assert.ok(matches(f, /Placement "fullscreen"/));
  assert.ok(matches(f, /remove allow-popups/));
  assert.ok(matches(f, /grants no device permissions.*Remove camera=\(self\)/));
  // A denial such as microphone=() is fine.
  assert.ok(!matches(f, /Remove microphone/));
});

test('manifest 2.0.0: center_overlay and host_immediate modals are accepted, host_immediate chatbots are not', () => {
  const errors = (sub) =>
    checkSubmission(normalizeSubmission(sub), rules).filter(
      (x) => x.level === 'error',
    );
  const modal = errors(
    withProps(sample('modal'), {
      ASPECT_PROPERTY_MOBILE_PLACEMENTID: 'center_overlay',
      ASPECT_PROPERTY_MOBILE_DISPLAYAUTHORITY: 'host_immediate',
      ASPECT_PROPERTY_MOBILE_FREQUENCY: 'once_per_user',
    }),
  );
  assert.ok(!matches(modal, /center_overlay|host_immediate|once_per_user/));
  const chatbot = errors(
    withProps(sample('chatbot'), {
      ASPECT_PROPERTY_MOBILE_DISPLAYAUTHORITY: 'host_immediate',
    }),
  );
  assert.ok(matches(chatbot, /Display authority "host_immediate"/));
  assert.ok(
    matches(
      checkCsp("script-src 'nonce-aspect'; media-src https://x.com", rules),
      /media-src is not allowed on mobile/,
    ),
  );
});

test('a modal pointed at a chatbot loader is caught', () => {
  const sub = normalizeSubmission(sample('modal'));
  const f = checkSubmission(sub, rules, {
    loaders: {
      modal: read('chatbot/static-loader.js'),
    },
  });
  assert.ok(matches(f, /ever sends it/));
  assert.ok(matches(f, /Is it the chatbot loader/));
});

test('the app actions are looked for in the aspect extension and the loader together', () => {
  const sub = normalizeSubmission(sample('modal'));
  const f = checkSubmission(sub, rules, {
    bootstrap: read('modal/aspect-extension.js'),
    loaders: { modal: read('modal/static-loader.js') },
  });
  assert.ok(!matches(f, /ever sends it|Is it the/));
});

test('JSON config under HTML Attributes is flagged', () => {
  const sub = normalizeSubmission(
    withProps(sample('chatbot'), {
      ASPECT_SCRIPT_chatbot_HTML_widget:
        '{"title":"Need help?","helpUrl":"0016/help"}',
    }),
  );
  assert.ok(
    matches(
      checkSubmission(sub, rules),
      /loader settings normally go in Data Attributes/,
    ),
  );
});

test('JSON in a Data Attribute is accepted', () => {
  const sub = normalizeSubmission(
    withProps(sample('chatbot'), {
      ASPECT_SCRIPT_chatbot_DATA_widget: '{"title":"Need help?"}',
    }),
  );
  const f = checkSubmission(sub, rules);
  assert.ok(!f.some((x) => /widget/.test(x.message)));
});

test('invalid JSON in a Data Attribute is a warning', () => {
  const sub = normalizeSubmission(
    withProps(sample('chatbot'), {
      ASPECT_SCRIPT_chatbot_DATA_widget: '{"title":"Need help?"',
      ASPECT_SCRIPT_chatbot_DATA_list: '[1, 2,]',
    }),
  );
  const f = checkSubmission(sub, rules).filter((x) =>
    /not valid JSON/.test(x.message),
  );
  assert.equal(f.length, 1);
  assert.equal(f[0].level, 'warn');
});

test('non-https URL Data Attributes are flagged', () => {
  const sub = normalizeSubmission(
    withProps(sample('chatbot'), {
      ASPECT_SCRIPT_chatbot_DATA_helpurl: '0016/help',
    }),
  );
  assert.ok(
    matches(
      checkSubmission(sub, rules),
      /helpurl = "0016\/help" is not an https URL/,
    ),
  );
});

test('aspect extension and Script Name must match', () => {
  const sub = normalizeSubmission(sample('chatbot'));
  const bootstrap = read('chatbot/aspect-extension.js').replace(
    "'chatbot'",
    "'aspectMobileChatbot'",
  );
  assert.deepEqual(bootstrapKeys(bootstrap), ['aspectMobileChatbot']);
  assert.ok(
    matches(
      checkSubmission(sub, rules, { bootstrap }),
      /name the aspect extension passes to loadSecureExternalScript must match/,
    ),
  );
});

test('camelCase Script Name is a warning', () => {
  const metadata = sample('chatbot');
  for (const p of metadata.properties)
    p.propertyName = p.propertyName.replace('chatbot', 'aspectMobileChatbot');
  const f = checkSubmission(normalizeSubmission(metadata), rules);
  assert.ok(
    f.some((x) => x.level === 'warn' && /including case/.test(x.message)),
  );
});

test('message payloads are validated against the manifest schema', () => {
  assert.equal(
    checkMessage(
      'chatbot',
      'chatbotOpen',
      { reason: 'user_clicked_fab' },
      rules,
    ),
    null,
  );
  assert.match(
    checkMessage('chatbot', 'chatbotOpen', { reason: 'clicked' }, rules),
    /must be one of/,
  );
  assert.match(
    checkMessage(
      'chatbot',
      'chatbotOpen',
      { reason: 'user_clicked_fab', extra: 1 },
      rules,
    ),
    /extra key/,
  );
  assert.match(
    checkMessage('modal', 'chatbotOpen', { reason: 'x' }, rules),
    /not a modal message/,
  );
  assert.equal(
    checkMessage(
      'modal',
      'modalDismiss',
      { status: 'success', actionData: { a: 1 } },
      rules,
    ),
    null,
  );
});

test('navigate follows the app policy: routes, feature:, and https hosts from the CSP', () => {
  const csp =
    "script-src 'nonce-aspect'; frame-src https://ui.partner.com; connect-src https://*.api.partner.com 'self' https:";
  const outcome = (url) => checkNavigate(url, csp).outcome;
  assert.equal(outcome('https://ui.partner.com/help'), 'browser');
  assert.equal(outcome('https://eu.api.partner.com/x'), 'browser');
  // *.x.com covers subdomains only; a scheme-only https: source makes nothing navigable.
  assert.equal(outcome('https://api.partner.com/x'), 'bankHostOnly');
  assert.equal(outcome('https://other.com/x'), 'bankHostOnly');
  assert.equal(outcome('http://ui.partner.com/x'), 'blocked');
  assert.equal(outcome('//evil.com/x'), 'blocked');
  assert.equal(outcome('not a url'), 'blocked');
  assert.equal(outcome('/app/home/settings/overview'), 'route');
  assert.equal(outcome('/app/home/olb/history'), 'blocked');
  assert.equal(outcome('feature:Transfers'), 'feature');
  assert.equal(outcome('feature:'), 'blocked');
});

test('the apps fill missing lifecycle values, accept an aspect with no static loader and the loader aliases', () => {
  const metadata = sample('chatbot');
  metadata.properties = metadata.properties.filter(
    (p) => !/MOUNTSTRATEGY|FREQUENCY|^ASPECT_SCRIPT_/.test(p.propertyName),
  );
  const f = checkSubmission(normalizeSubmission(metadata), rules, {
    bootstrap: "window.dbk.loadScript('chatbot')",
  });
  assert.ok(
    matches(f, /Mount strategy is not set, so the app uses its default/),
  );
  assert.ok(
    f
      .filter((x) => /not set|No loader script/.test(x.message))
      .every((x) => x.level === 'warn'),
  );
  assert.ok(!matches(f, /never calls dbk.loadSecureExternalScript/));
});

test('comma-separated sandbox tokens are one bad token, as in the apps', () => {
  const f = checkSubmission(
    normalizeSubmission(
      withProps(sample('chatbot'), {
        ASPECT_PROPERTY_MOBILE_SANDBOXDIRECTIVES:
          'allow-scripts,allow-same-origin',
      }),
    ),
    rules,
  );
  assert.ok(matches(f, /Separate tokens with spaces/));
});

test('blank strings and arrays are rejected like the apps do', () => {
  assert.match(
    checkMessage('modal', 'modalOpen', { reason: '  ' }, rules),
    /blank/,
  );
  assert.match(
    checkMessage(
      'modal',
      'modalDismiss',
      { status: 'success', actionData: [] },
      rules,
    ),
    /not an array/,
  );
});

test('a aspect extension that searches frames for dbk, or a loader that talks to the app, is noted', () => {
  const sub = normalizeSubmission(sample('chatbot'));
  const frameLookup =
    "(function () { var staticLoaderKey = 'chatbot'; var dbk = window.dbk || window.parent.dbk || window.top.dbk; dbk.loadSecureExternalScript(staticLoaderKey); })();";
  assert.ok(
    matches(
      checkSubmission(sub, rules, { bootstrap: frameLookup }),
      /use window\.dbk/,
    ),
  );
  const loaderWithDbk =
    "(function () { window.dbk.chatbotOpen({ reason: 'user_clicked_fab' }); })();";
  assert.ok(
    matches(
      checkSubmission(sub, rules, { loaders: { chatbot: loaderWithDbk } }),
      /The loader uses dbk/,
    ),
  );
  const loaderWithEnvelope =
    "(function () { window.parent.postMessage({ type: 'ASPECT_MESSAGE', action: 'chatbotOpen', payload: { reason: 'user_clicked_fab' } }, '*'); })();";
  assert.ok(
    matches(
      checkSubmission(sub, rules, { loaders: { chatbot: loaderWithEnvelope } }),
      /skips the aspect extension's checks/,
    ),
  );
  const current = checkSubmission(sub, rules, {
    bootstrap: read('chatbot/aspect-extension.js'),
    loaders: { chatbot: read('chatbot/static-loader.js') },
  });
  assert.ok(
    !matches(current, /use window\.dbk|The loader uses|ever sends chatbotOpen/),
  );
});

test('a aspect extension helper named loadScript is not read as a Script Name', () => {
  const code =
    "function loadScript(src) {} loadScript('https://cdn.bank.com/polyfill.js'); dbk.loadSecureExternalScript('mykey'); window.dbk.loadScript('other')";
  assert.deepEqual(bootstrapKeys(code), ['mykey', 'other']);
});
