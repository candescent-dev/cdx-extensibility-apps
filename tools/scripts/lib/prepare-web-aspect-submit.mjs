/*
 * Prepare a web aspect folder for submit-to-fi (Node 18+, no playground dependency).
 * Reads metadata.json + template.json, fills missing values, fetches hosted loader SRI, writes metadata back.
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import {
  answersFromMetadata,
  ensureCspOrigins,
  hostedLoaderUrlProblem,
  isLoaderField,
  loaderEntry,
  missingPartner,
  originOf,
  previewOnly,
  prBody,
  STATIC_LOADER_KEY_PROPERTY,
  submitProblem,
  validateField,
  withDataAttributes,
  withProperty,
} from './web-aspect-metadata.mjs';

const sha384 = (buf) =>
  `sha384-${createHash('sha384').update(buf).digest('base64')}`;

export async function hostedLoaderHash(url) {
  let res;
  try {
    res = await fetch(url, { redirect: 'follow' });
  } catch (e) {
    return {
      ok: false,
      problem: `${url} could not be fetched (${e.cause?.code ?? e.message}).`,
    };
  }
  const finalUrl = res.url || url;
  if (!finalUrl.startsWith('https://')) {
    return {
      ok: false,
      problem: `${url} redirected to a non-https URL (${finalUrl}).`,
    };
  }
  if (!res.ok) {
    return { ok: false, problem: `${url} returned HTTP ${res.status}.` };
  }
  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  if (
    contentType &&
    !/javascript|ecmascript|text\/plain/.test(contentType) &&
    /html|json|xml|text\/css/.test(contentType)
  ) {
    return {
      ok: false,
      problem: `${url} returned ${contentType}, not a JavaScript loader.`,
    };
  }
  const bytes = Buffer.from(await res.arrayBuffer());
  if (!bytes.length) {
    return { ok: false, problem: `${url} returned an empty file.` };
  }
  const head = bytes
    .toString('utf8', 0, Math.min(bytes.length, 256))
    .trimStart();
  if (/^<!doctype html/i.test(head) || /^<html/i.test(head)) {
    return {
      ok: false,
      problem: `${url} looks like HTML, not a JavaScript loader.`,
    };
  }
  return { ok: true, sri: sha384(bytes), bytes };
}

export function readWebAspectFolder(dir) {
  const name = basename(dir);
  const metadataPath = join(dir, 'metadata.json');
  if (!existsSync(metadataPath)) {
    return { error: `${dir}: missing metadata.json` };
  }
  let metadata;
  try {
    metadata = JSON.parse(readFileSync(metadataPath, 'utf8'));
  } catch (e) {
    return { error: `${metadataPath}: invalid JSON (${e.message})` };
  }
  const files = readdirSync(dir);
  const templatePath = join(dir, 'template.json');
  let template = null;
  if (existsSync(templatePath)) {
    try {
      template = JSON.parse(readFileSync(templatePath, 'utf8'));
    } catch (e) {
      return { error: `${templatePath}: invalid JSON (${e.message})` };
    }
    if (!Array.isArray(template?.fields)) {
      return {
        error: `${templatePath}: missing a "fields" array.`,
      };
    }
  }
  const bootstrap =
    files.find((f) => f === 'aspect-extension.js') ??
    (files.includes(`${name}.js`) ? `${name}.js` : null);
  const loaderFile =
    template?.loaderFile ??
    (files.includes('static-loader.js') ? 'static-loader.js' : null);
  return {
    dir,
    id: name,
    metadata,
    template,
    bootstrap,
    loaderFile,
    files,
  };
}

/**
 * @param {object} options
 * @param {string} options.dir — aspect folder (aspects/web/<name> or sample)
 * @param {(q: string, def?: string) => Promise<string>} [options.ask]
 * @param {string} [options.loaderUrl]
 * @param {(msg: string) => void} [options.log]
 * @param {boolean} [options.acceptHostedDiff]
 * @param {boolean} [options.persist] — write metadata.json (default true). Submit defers this
 *   until the operator confirms the FI PR so cancel does not mutate the folder.
 */
export async function prepareWebAspect({
  dir,
  ask,
  loaderUrl,
  log = () => {},
  acceptHostedDiff = false,
  persist = true,
}) {
  const folder = readWebAspectFolder(dir);
  if (folder.error) throw new Error(folder.error);

  let metadata = folder.metadata;
  const name = folder.id;
  if (metadata.name !== name) {
    throw new Error(
      `metadata.json "name" is "${metadata.name}" but the folder is "${name}". They must match.`
    );
  }
  if (!folder.bootstrap) {
    throw new Error(
      `${dir}: missing bootstrap (aspect-extension.js or ${name}.js).`
    );
  }

  let answers;
  let saved;
  if (folder.template) {
    answers = answersFromMetadata(folder.template, metadata);
    saved = { ...answers };
    for (const f of folder.template.fields) {
      if (isLoaderField(f)) continue;
      if (
        (f.key === 'uiorigin' || f.property === 'uiorigin') &&
        answers[f.key]
      ) {
        answers[f.key] = originOf(answers[f.key]) || answers[f.key];
      }
      const problem = (v) => validateField(f, v) ?? submitProblem(f, v);
      let error = problem(answers[f.key]);
      for (let tries = 0; error; tries++) {
        if (!ask) throw new Error(`${f.key}: ${error}`);
        if (tries === 3) {
          throw new Error(`${f.key}: no valid value given. ${error}`);
        }
        // The first problem is with the saved value: say so. Later ones are about the answer just
        // typed, which ask() shows in place of that answer.
        if (!tries) log(`  ${error}`);
        const suggestion = previewOnly(f.default) ? '' : f.default ?? '';
        answers[f.key] = await ask(
          f.label,
          suggestion,
          tries ? error : undefined
        );
        error = problem(answers[f.key]);
      }
      if (f.key === 'uiorigin' || f.property === 'uiorigin') {
        answers[f.key] = originOf(answers[f.key]) || answers[f.key];
      }
    }
    // Paired fields (the OIDC client id and redirect URL) need each other.
    for (let missing; (missing = missingPartner(folder.template, answers)); ) {
      const { partner, message } = missing;
      if (!ask) throw new Error(message);
      let value = await ask(partner.label, '', message);
      for (
        let e;
        (e = validateField(partner, value) ?? submitProblem(partner, value));

      )
        value = await ask(partner.label, '', e);
      answers[partner.key] = value;
    }
    for (const f of folder.template.fields) {
      if (f.target === 'property') {
        metadata = withProperty(metadata, f.property, answers[f.key]);
      }
    }
    metadata = withDataAttributes(folder.template, metadata, answers);
  }

  const entry = loaderEntry(metadata);
  if (!entry) {
    throw new Error('metadata.json has no ASPECT_SCRIPT_<key>_URL property.');
  }
  const keyProperty =
    folder.template?.fields.find((f) => f.key === 'staticloaderkey')
      ?.property ?? STATIC_LOADER_KEY_PROPERTY;
  const staticLoaderKey = (metadata.properties ?? []).find(
    (p) => p.propertyName === keyProperty
  )?.propertyValue;
  if (!staticLoaderKey) {
    throw new Error(
      `metadata.json has no ${keyProperty}. It must match the ASPECT_SCRIPT_<key>_URL key used by loadSecureExternalScript.`
    );
  }
  if (staticLoaderKey !== entry.key) {
    throw new Error(
      `${keyProperty} is "${staticLoaderKey}" but the loader property is ASPECT_SCRIPT_${entry.key}_URL. They must match.`
    );
  }

  // A URL that can't be downloaded (a typo, a 404, an HTML page) is asked again too, so one slip
  // doesn't end the submit.
  let url = loaderUrl || entry.url;
  let hosted;
  for (let tries = 0; ; tries++) {
    let problem = hostedLoaderUrlProblem(url);
    if (!problem) {
      log(`  Downloading ${url} …`);
      hosted = await hostedLoaderHash(url);
      if (hosted.ok) break;
      problem = hosted.problem;
    }
    if (!ask) {
      throw new Error(`${problem} Pass --loader-url <hosted https URL>.`);
    }
    if (tries === 3) {
      throw new Error(
        `No valid hosted loader URL given. ${problem} Pass --loader-url <hosted https URL>.`
      );
    }
    if (!tries) log(`  ${problem}`);
    url = (
      await ask(
        `Hosted https URL of ${folder.loaderFile ?? 'static-loader.js'}`,
        '',
        tries ? problem : undefined
      )
    ).trim();
  }
  metadata = withProperty(metadata, `ASPECT_SCRIPT_${entry.key}_URL`, url);
  if (folder.template) {
    for (const f of folder.template.fields) {
      if (isLoaderField(f)) answers[f.key] = url;
    }
    metadata = ensureCspOrigins(metadata, folder.template, answers, saved);
  }

  metadata = withProperty(
    metadata,
    `ASPECT_SCRIPT_${entry.key}_SRI`,
    hosted.sri
  );

  if (folder.loaderFile && folder.files.includes(folder.loaderFile)) {
    const localHash = sha384(readFileSync(join(dir, folder.loaderFile)));
    if (localHash !== hosted.sri) {
      const msg = `The hosted file differs from your local ${folder.loaderFile}; production uses the hosted copy.`;
      if (ask) {
        const answer = await ask(
          `${msg} Continue with the hosted file? (y/N)`,
          ''
        );
        if (!/^y(es)?$/i.test(answer)) {
          throw new Error(
            'Stopped: upload your current loader, then submit again.'
          );
        }
      } else if (!acceptHostedDiff) {
        throw new Error(
          `${msg} Upload the current file, or pass --accept-hosted.`
        );
      } else {
        log(`  Note: ${msg}`);
      }
    }
  }
  log(`  SRI ${hosted.sri} (${hosted.bytes.length} bytes)`);

  const leftovers = (metadata.properties ?? []).filter((p) =>
    previewOnly(p.propertyValue)
  );
  if (leftovers.length) {
    throw new Error(
      `These values only work in local preview: ${leftovers
        .map((p) => `${p.propertyName} = ${p.propertyValue}`)
        .join('; ')}. Replace them with hosted https URLs.`
    );
  }

  const persistMetadata = () => {
    writeFileSync(
      join(dir, 'metadata.json'),
      `${JSON.stringify(metadata, null, 2)}\n`
    );
  };
  if (persist) persistMetadata();

  return {
    metadata,
    bootstrapPath: join(dir, folder.bootstrap),
    body: prBody(metadata),
    persist: persistMetadata,
  };
}
