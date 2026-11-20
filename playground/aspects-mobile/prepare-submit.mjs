/*
 * Gets an aspect folder ready for a pull request in the FI repo (Node 18+, no dependencies).
 * Used by tools/scripts/submit-to-fi-repo.js; can be reused by the Forge CLI.
 *
 *   1. asks for any template value that is missing, invalid or preview-only (localhost, 127.0.0.1,
 *      example-fi.com), unless non-interactive
 *   2. asks for the hosted loader URL while it is still the placeholder
 *   3. downloads the hosted loader and sets the SRI from the served bytes
 *   4. runs every check (with the hosted fetch) on the prepared metadata; errors stop the submit.
 *      metadata.json is written back unless `persist: false`, which leaves the write to the caller
 *      (submit-to-fi-repo writes it only once the user confirms the FI pull request)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { readAspectFolder } from './serve.mjs';
import { runCheck } from './check.mjs';
import {
  answersFromMetadata,
  buildCsp,
  isPlaceholderUrl,
  loaderEntry,
  prBody,
  previewOnly,
  submitProblem,
  validateField,
  withDataAttributes,
  withProperty,
} from './src/metadata-builder.mjs';

const sha384 = (buf) =>
  `sha384-${createHash('sha384').update(buf).digest('base64')}`;

/** Downloads the hosted loader. Returns { ok, sri?, bytes?, problem? }. */
export async function hostedLoaderHash(url) {
  let res;
  try {
    res = await fetch(url, { redirect: 'manual' });
  } catch (e) {
    return {
      ok: false,
      problem: `${url} could not be fetched (${e.cause?.code ?? e.message}).`,
    };
  }
  if (res.status >= 300 && res.status < 400)
    return {
      ok: false,
      problem: `${url} redirects (HTTP ${res.status}); host the file at a public URL.`,
    };
  if (!res.ok)
    return { ok: false, problem: `${url} returned HTTP ${res.status}.` };
  const bytes = Buffer.from(await res.arrayBuffer());
  if (!bytes.length)
    return { ok: false, problem: `${url} returned an empty file.` };
  return { ok: true, sri: sha384(bytes), bytes };
}

const parseCspDirectives = (csp) =>
  Object.fromEntries(
    csp
      .split(';')
      .map((d) => d.trim().split(/\s+/))
      .filter((d) => d[0])
      .map(([d, ...s]) => [d, s]),
  );

/**
 * Makes sure every origin the template needs (for example the chat backend) is in the CSP, keeping
 * manual additions. `previous` are the template values the CSP was built from: an origin only those
 * values needed (a link or UI URL that has since changed) is removed, as Customize does.
 */
export function ensureCspOrigins(metadata, template, values, previous) {
  const csp =
    metadata.properties.find(
      (p) => p.propertyName === 'ASPECT_PROPERTY_MOBILE_CONTENTSECURITYPOLICY',
    )?.propertyValue ?? '';
  const current = parseCspDirectives(csp);
  const wanted = parseCspDirectives(buildCsp(template, values));
  if (previous) {
    const before = parseCspDirectives(buildCsp(template, previous));
    for (const [d, sources] of Object.entries(before)) {
      if (!current[d]) continue;
      const stale = sources.filter((s) => !wanted[d]?.includes(s));
      current[d] = current[d].filter((s) => !stale.includes(s));
    }
  }
  for (const [d, sources] of Object.entries(wanted)) {
    current[d] = current[d] ?? [];
    for (const s of sources) if (!current[d].includes(s)) current[d].push(s);
  }
  // Drop sources left over from the preview defaults (for example http://127.0.0.1:4310).
  for (const d of Object.keys(current))
    current[d] = current[d].filter((s) => previewOnly(s) !== 'local');
  const value = Object.entries(current)
    .map(([d, s]) => `${d} ${s.join(' ')}`)
    .join('; ');
  return withProperty(
    metadata,
    'ASPECT_PROPERTY_MOBILE_CONTENTSECURITYPOLICY',
    value,
  );
}

/**
 * Host sources in a directive the template fills (frame-src, connect-src) that no current value
 * needs: a manual addition, or a host left over from a URL changed by hand. Reported, never removed.
 */
export function unusedCspOrigins(metadata, template, values) {
  const csp =
    metadata.properties.find(
      (p) => p.propertyName === 'ASPECT_PROPERTY_MOBILE_CONTENTSECURITYPOLICY',
    )?.propertyValue ?? '';
  const current = parseCspDirectives(csp);
  const wanted = parseCspDirectives(buildCsp(template, values));
  const filled = new Set(template.fields.map((f) => f.csp).filter(Boolean));
  const out = [];
  for (const d of filled)
    for (const s of current[d] ?? [])
      if (/^https?:\/\//i.test(s) && !wanted[d]?.includes(s))
        out.push(`${d} ${s}`);
  return out;
}

/**
 * options = {
 *   dir,                     aspect folder
 *   ask(question, default, error), async prompt; omit for non-interactive. `error` is set when
 *                            asking again: why the last answer was rejected (show it to the user)
 *   loaderUrl,               hosted loader URL (overrides metadata)
 *   log(message),
 *   acceptHostedDiff,        continue when the hosted file differs from the local loader (non-interactive)
 *   persist,                 write metadata.json back (default true). false: the caller calls the
 *                            returned persist() when it is sure, so a cancelled submit changes nothing
 * }
 * Returns { metadata, bootstrapPath, findings, body, persist }. Throws when the aspect is not ready.
 */
export async function prepareMobileAspect({
  dir,
  ask,
  loaderUrl,
  log = () => {},
  acceptHostedDiff = false,
  persist = true,
}) {
  const a = readAspectFolder(dir);
  if (a.error) throw new Error(a.error);
  let metadata = a.metadata;
  const name = a.id;
  if (metadata.name !== name) {
    throw new Error(
      `metadata.json "name" is "${metadata.name}" but the folder is "${name}". They must match: the aspect extension goes to aspects/mobile/${name}/${name}.js.`,
    );
  }

  // 1. Template values.
  if (a.template) {
    const answers = answersFromMetadata(a.template, metadata);
    const saved = { ...answers };
    for (const f of a.template.fields) {
      const problem = (v) => validateField(f, v) ?? submitProblem(f, v);
      let error = problem(answers[f.key]);
      for (let tries = 0; error; tries++) {
        if (!ask) throw new Error(`${f.key}: ${error}`);
        if (tries === 3)
          throw new Error(`${f.key}: no valid value given. ${error}`);
        // The first problem is with the saved value: say so. Later ones are about the answer just
        // typed, which ask() shows in place of that answer.
        if (!tries) log(`  ${error}`);
        // Never offer a preview-only default as the answer.
        const suggestion = previewOnly(f.default) ? '' : (f.default ?? '');
        answers[f.key] = await ask(
          f.label,
          suggestion,
          tries ? error : undefined,
        );
        error = problem(answers[f.key]);
      }
    }
    for (const f of a.template.fields) {
      if (f.target === 'property')
        metadata = withProperty(metadata, f.property, answers[f.key]);
    }
    // Always rewrite Data Attributes as one plain value per template field. An older `widget` JSON
    // attribute is read back as answers and replaced by those fields.
    const hadLegacy = metadata.properties.some((p) =>
      /_DATA_widget$/i.test(p.propertyName),
    );
    metadata = withDataAttributes(a.template, metadata, answers);
    if (hadLegacy)
      log(
        '  Replaced the "widget" JSON Data Attribute with one Data Attribute per template field.',
      );
    metadata = ensureCspOrigins(metadata, a.template, answers, saved);
    for (const o of unusedCspOrigins(metadata, a.template, answers))
      log(
        `  Note: the CSP allows ${o}, which no template value uses. Remove it if it is no longer needed.`,
      );
  }

  // 2. Hosted loader URL.
  const entry = loaderEntry(metadata);
  if (!entry) throw new Error('metadata.json has no ASPECT_SCRIPT_<name>_URL.');
  let url = loaderUrl || entry.url;
  // A loader on this machine is as unusable on a device as the placeholder. A URL that can't be
  // downloaded (a typo, a 404, a redirect) is asked again too, so one slip doesn't end the submit.
  const urlProblem = (u) =>
    isPlaceholderUrl(u)
      ? u === entry.url && !loaderUrl
        ? ''
        : `"${u}" is not a hosted https URL.`
      : previewOnly(u) === 'local'
        ? `The loader URL points at this machine or a private network (${u}); a device can't reach it.`
        : !/^https:\/\//i.test(u)
          ? `"${u}" is not an https URL. Devices load the loader over https only.`
          : null;
  let hosted;
  for (let tries = 0; ; tries++) {
    let problem = urlProblem(url);
    if (problem === null) {
      log(`  Downloading ${url} …`);
      hosted = await hostedLoaderHash(url);
      if (hosted.ok) break;
      problem = hosted.problem;
    }
    if (!ask)
      throw new Error(
        // problem is '' only for the saved placeholder; a malformed --loader-url has its own message.
        !problem
          ? 'The loader URL is still the placeholder. Pass --loader-url <hosted https URL>.'
          : hosted
            ? problem
            : `${problem} Pass --loader-url <hosted https URL>.`,
      );
    if (tries === 3)
      throw new Error(
        `No valid hosted loader URL given. ${problem} Pass --loader-url <hosted https URL>.`,
      );
    if (problem && !tries) log(`  ${problem}`);
    hosted = undefined;
    url = (
      await ask(
        `Hosted https URL of ${
          Object.values(a.localLoaders)[0] ?? 'your loader'
        }`,
        '',
        tries && problem ? problem : undefined,
      )
    ).trim();
  }
  metadata = withProperty(metadata, `ASPECT_SCRIPT_${entry.key}_URL`, url);

  // 3. SRI from the served bytes.
  metadata = withProperty(
    metadata,
    `ASPECT_SCRIPT_${entry.key}_SRI`,
    hosted.sri,
  );
  // The hosted file name may differ from the local one; fall back to the template's loader file.
  const localFile =
    a.localLoaders[entry.key] ??
    (a.template?.loaderFile && a.files.includes(a.template.loaderFile)
      ? a.template.loaderFile
      : undefined);
  if (
    localFile &&
    sha384(readFileSync(join(a.dir, localFile))) !== hosted.sri
  ) {
    // Usually a stale upload. The app will run the hosted bytes, not the local file.
    const msg = `The hosted file differs from your local ${localFile}; the app will run the hosted copy.`;
    if (ask) {
      const answer = await ask(
        `${msg} Continue with the hosted file? (y/N)`,
        '',
      );
      if (!/^y(es)?$/i.test(answer))
        throw new Error(
          'Stopped: upload your current loader, then submit again.',
        );
    } else if (!acceptHostedDiff) {
      throw new Error(
        `${msg} Upload the current file, or pass --accept-hosted to submit the hosted copy as it is.`,
      );
    } else log(`  Note: ${msg}`);
  }
  log(`  SRI ${hosted.sri} (${hosted.bytes.length} bytes)`);

  // Last guard for anything outside the template fields (hand-edited metadata, HTML Attributes).
  const leftovers = metadata.properties.filter((p) =>
    previewOnly(p.propertyValue),
  );
  if (leftovers.length)
    throw new Error(
      `These values only work in the local preview: ${leftovers
        .map((p) => `${p.propertyName} = ${p.propertyValue}`)
        .join(
          '; ',
        )}. Replace them with your hosted https URLs and run submit again.`,
    );

  // 4. Check everything, including the hosted fetch, then save (or leave saving to the caller).
  const persistMetadata = () =>
    writeFileSync(
      join(a.dir, 'metadata.json'),
      `${JSON.stringify(metadata, null, 2)}\n`,
    );
  // Saved before the check so the answers survive a failed check; persist: false never writes.
  if (persist) persistMetadata();
  const { findings } = await runCheck(a.dir, { fetchHosted: true, metadata });
  const errors = findings.filter((f) => f.level === 'error');
  for (const f of findings.filter((x) => x.level !== 'info'))
    log(`  ${f.level.toUpperCase().padEnd(5)} ${f.field}: ${f.message}`);
  if (errors.length)
    throw new Error(
      `${errors.length} error(s) to fix before submitting (each one stops the aspect on a device or only works in the local preview). Fix them and run submit again.`,
    );

  return {
    metadata,
    bootstrapPath: join(a.dir, a.bootstrap),
    findings,
    body: prBody(metadata),
    persist: persistMetadata,
  };
}
