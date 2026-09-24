import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  getResolvedVersionFromLock,
  getRootDirectDependencyNames,
} from './check-shared-dependencies.mjs';

const fixture = readFileSync(
  new URL('./fixtures/pnpm-lock-root-importer.yaml', import.meta.url),
  'utf8',
);

test('parses root importer dependency names from pnpm-lock.yaml', () => {
  const names = getRootDirectDependencyNames(fixture);

  assert.ok(names.includes('axios'), 'expected axios in root importer');
  assert.ok(names.includes('react'), 'expected react in root importer');
  assert.ok(names.includes('react-dom'), 'expected react-dom in root importer');
  assert.equal(names.length, 3);
});

test('resolves versions from root importer block', () => {
  assert.equal(getResolvedVersionFromLock(fixture, 'axios'), '1.19.0');
  assert.equal(getResolvedVersionFromLock(fixture, 'react'), '18.2.0');
});

test('parses dependency names from the repo pnpm-lock.yaml', () => {
  const lock = readFileSync(
    new URL('../../pnpm-lock.yaml', import.meta.url),
    'utf8',
  );
  const names = getRootDirectDependencyNames(lock);

  assert.ok(names.includes('axios'), 'expected axios in repo lockfile');
  assert.ok(names.includes('react'), 'expected react in repo lockfile');
});
