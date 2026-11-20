import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { normalizeSubmission } from '../src/conformance.mjs';
import {
  aspectLabel,
  formValues,
  formValuesText,
  fiRepoPath,
  unsubmittable,
} from '../src/form-values.mjs';

const samples = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../samples/mobile/aspects',
);
const load = (name) =>
  JSON.parse(readFileSync(join(samples, name, 'metadata.json'), 'utf8'));
const value = (rows, label) => rows.find((r) => r.label === label)?.value;

test('labels say the type and the folder', () => {
  const metadata = load('chatbot');
  assert.equal(
    aspectLabel('chatbot', normalizeSubmission(metadata)),
    'Chatbot · chatbot',
  );
});

test('chatbot form values use console wording', () => {
  const metadata = load('chatbot');
  const rows = formValues(normalizeSubmission(metadata), metadata);
  assert.equal(value(rows, 'Aspect Type'), 'Chatbot');
  assert.equal(value(rows, 'Placement'), 'Bottom Right FAB');
  assert.equal(value(rows, 'Display Authority'), 'Partner Delegated');
  assert.equal(value(rows, 'Loader Script · Script Name'), 'chatbot');
  assert.equal(
    value(rows, 'CSP Directives'),
    "script-src → 'self' 'nonce-aspect'",
  );
  const data = rows
    .filter((r) => r.label === 'Data Attribute')
    .map((r) => r.value);
  assert.deepEqual(data, [
    'title = Need help?',
    'greeting = Hi! How can we help?',
    'accentcolor = #1a6cda',
    'helpurl = https://www.example-fi.com/help',
    'uiurl = http://127.0.0.1:4310/aspects/chatbot/support-chat-ui.html',
  ]);
  assert.equal(value(rows, 'Page'), undefined);
});

test('modal shows the page, and a hosted hash replaces the submission SRI', () => {
  const metadata = load('modal');
  const rows = formValues(normalizeSubmission(metadata), metadata, {
    hostedSri: { modal: 'sha384-hosted' },
  });
  assert.equal(value(rows, 'Page'), 'Home Page');
  const sri = rows.find((r) => r.label === 'SRI Hash');
  assert.equal(sri.value, 'sha384-hosted');
  assert.match(sri.note, /computed from the hosted file/);
});

test('aspect extension path in the FI repo', () => {
  assert.equal(fiRepoPath('modal'), 'aspects/mobile/modal/modal.js');
});

test('preview-only and placeholder values are blocked from copying', () => {
  const metadata = load('chatbot');
  const rows = formValues(normalizeSubmission(metadata), metadata);
  const blocked = rows.filter((r) => r.blocked);
  // The sample's defaults: the local UI page (Data Attribute and CSP) and the placeholder loader URL.
  assert.ok(
    blocked.some(
      (r) => r.label === 'Script URL' && r.blocked === 'placeholder',
    ),
  );
  assert.ok(
    blocked.some(
      (r) =>
        /^uiurl = http:\/\/127\.0\.0\.1/i.test(r.value) &&
        r.blocked === 'local',
    ),
  );
  assert.ok(
    blocked.some(
      (r) => r.value.startsWith('frame-src') && r.blocked === 'local',
    ),
  );
  assert.ok(blocked.every((r) => r.note));
  const text = formValuesText(rows);
  assert.doesNotMatch(text, /127\.0\.0\.1|localhost|example-fi\.com/);
  assert.match(text, /<replace with your hosted https URL>/);
});

test('unsubmittable spots local hosts and the placeholder only', () => {
  for (const v of [
    'http://localhost:4310/a.html',
    'frame-src → https://x.com http://127.0.0.1:4310',
    'u = http://[::1]/x',
    'https://app.localhost/x',
  ])
    assert.equal(unsubmittable(v), 'local', v);
  assert.equal(
    unsubmittable('https://cdn.example-fi.com/a.v1.js'),
    'placeholder',
  );
  for (const v of [
    'https://cdn.bank.com/ui.html',
    'title = Need help?',
    'https://notlocalhost.com/x',
    "'self'",
  ])
    assert.equal(unsubmittable(v), null, v);
});

test('private-network URLs are blocked; plain text that mentions localhost is not', () => {
  for (const v of [
    'uiurl = http://10.0.2.2:4310/ui.html',
    'https://192.168.1.5/x',
    'http://0.0.0.0:8080/x',
    'https://printer.local/x',
    'connect-src → https://172.20.0.4',
  ])
    assert.equal(unsubmittable(v), 'local', v);
  for (const v of [
    'greeting = Questions? Visit example-fi.com',
    'description = tested on localhost',
    'https://10.bank.com/x',
    'https://notexample-fi.com/x',
  ])
    assert.equal(unsubmittable(v), null, v);
});
