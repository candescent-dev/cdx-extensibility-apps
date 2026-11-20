import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readAspectFolder } from '../serve.mjs';
import { runCheck } from '../check.mjs';

const samples = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../samples/mobile/aspects',
);

test('aspect folders resolve aspect extension and local loaders by file name', () => {
  const a = readAspectFolder(join(samples, 'chatbot'));
  assert.equal(a.bootstrap, 'aspect-extension.js');
  assert.deepEqual(a.localLoaders, {
    chatbot: 'static-loader.js',
  });
});

test('a folder without metadata.json is reported', () => {
  assert.match(readAspectFolder(samples).error, /no metadata\.json/);
});

for (const name of ['chatbot', 'modal']) {
  test(`check passes for the ${name} folder without network`, async () => {
    const { findings } = await runCheck(join(samples, name));
    assert.deepEqual(
      findings.filter((f) => f.level === 'error'),
      [],
    );
  });
}
