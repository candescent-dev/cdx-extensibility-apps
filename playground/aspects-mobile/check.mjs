#!/usr/bin/env node
/*
 * Mobile V2 aspect conformance check (no dependencies, Node 18+).
 *
 *   node playground/aspects-mobile/check.mjs <aspect-folder | metadata.json | pr-body.txt> [options]
 *
 *   --extension <file>     aspect extension to check (an aspect folder supplies its own; --bootstrap also works)
 *   --loader <key>=<file>  static loader source to check (repeatable; an aspect folder supplies its own)
 *   --fetch                download each Script URL and verify HTTP status, CORS and SRI
 *   --json                 print findings as JSON
 *
 * Exit code: 0 = no errors, 1 = errors found, 2 = bad usage.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  parseMetadataInput,
  normalizeSubmission,
  checkSubmission,
  hasErrors,
} from './src/conformance.mjs';
import { readAspectFolder } from './serve.mjs';
import {
  checkLinkFields,
  checkTemplateConfig,
} from './src/metadata-builder.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

/** The sample template.json for an Aspect Type (chatbot, modal), or null. */
function sampleTemplateFor(type) {
  if (!/^[a-z]+$/.test(String(type ?? ''))) return null;
  const file = join(
    HERE,
    '../../samples/mobile/aspects',
    type,
    'template.json',
  );
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
}
export const rules = JSON.parse(
  readFileSync(join(HERE, 'src/mobile-rules.json'), 'utf8'),
);

/** Downloads a Script URL the way the app would and returns findings. */
export async function fetchCheck(key, url, sri) {
  const field = `Loader "${key}" · Hosted file`;
  let res;
  try {
    res = await fetch(url, {
      redirect: 'manual',
      headers: { Origin: 'https://localhost' },
    });
  } catch (e) {
    return [
      {
        level: 'error',
        field,
        message: `${url} could not be fetched: ${e.cause?.code ?? e.message}.`,
      },
    ];
  }
  if (res.status >= 300 && res.status < 400) {
    return [
      {
        level: 'error',
        field,
        message: `${url} redirects (HTTP ${res.status}) to ${
          res.headers.get('location') ?? 'another page'
        }. The app needs the file itself at a public URL.`,
      },
    ];
  }
  if (!res.ok)
    return [
      {
        level: 'error',
        field,
        message: `${url} returned HTTP ${res.status}. Upload the file, or fix the path.`,
      },
    ];
  const out = [];
  if (!res.headers.get('access-control-allow-origin')) {
    out.push({
      level: 'error',
      field,
      message: `${url} does not send Access-Control-Allow-Origin, so the app cannot verify its hash.`,
    });
  }
  const bytes = Buffer.from(await res.arrayBuffer());
  const actual = `sha384-${createHash('sha384')
    .update(bytes)
    .digest('base64')}`;
  if (!bytes.length)
    out.push({
      level: 'error',
      field,
      message: `${url} returned an empty body.`,
    });
  else if (sri && !sri.startsWith('sha384-')) {
    out.push({
      level: 'info',
      field,
      message: `Served file is ${bytes.length} bytes; its sha384 is ${actual}. The submission uses another algorithm, so it was not compared.`,
    });
  } else if (actual !== sri) {
    out.push({
      level: 'error',
      field,
      message: `The served file hashes to ${actual}, but the submission says ${
        sri || '(nothing)'
      }. The app will refuse to run it.`,
    });
  } else {
    out.push({
      level: 'info',
      field,
      message: `Served file (${bytes.length} bytes) matches the submission SRI.`,
    });
  }
  return out;
}

/** Runs every check for one input. Returns { submission, findings }. */
export async function runCheck(
  target,
  { bootstrap, loaders = {}, fetchHosted = false, metadata: override } = {},
) {
  let metadata;
  let template = null;
  const sources = { loaders: {} };
  if (statSync(target).isDirectory()) {
    const a = readAspectFolder(resolve(target));
    if (a.error) throw new Error(a.error);
    // `metadata` checks a folder against metadata not yet written to it (submit before confirming).
    metadata = override ?? a.metadata;
    template = a.template;
    sources.dir = a.dir;
    sources.bootstrap = readFileSync(join(a.dir, a.bootstrap), 'utf8');
    for (const [key, file] of Object.entries(a.localLoaders))
      sources.loaders[key] = readFileSync(join(a.dir, file), 'utf8');
  } else {
    metadata = parseMetadataInput(readFileSync(target, 'utf8'));
  }
  if (bootstrap) sources.bootstrap = readFileSync(bootstrap, 'utf8');
  for (const [key, file] of Object.entries(loaders))
    sources.loaders[key] = readFileSync(file, 'utf8');

  const submission = normalizeSubmission(metadata);
  const findings = checkSubmission(submission, rules, sources);
  if (template) {
    const uiPath = template.uiFile && join(sources.dir, template.uiFile);
    const uiSource =
      uiPath && existsSync(uiPath) ? readFileSync(uiPath, 'utf8') : undefined;
    findings.push(...checkTemplateConfig(template, metadata, uiSource));
  } else {
    // A pull request body has no template.json: check its link Data Attributes with the sample
    // template of the same Aspect Type, so a button link the app would ignore is still reported.
    const sample = sampleTemplateFor(submission.type);
    if (sample) findings.push(...checkLinkFields(sample, metadata));
  }
  if (fetchHosted) {
    for (const [key, s] of Object.entries(submission.scripts))
      findings.push(...(await fetchCheck(key, s.url, s.sri)));
  }
  return { submission, findings };
}

function parseArgs(argv) {
  const out = { loaders: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--extension' || a === '--bootstrap') out.bootstrap = argv[++i];
    else if (a === '--loader') {
      const [key, ...file] = String(argv[++i] ?? '').split('=');
      if (!key || !file.length) throw new Error('--loader needs <key>=<file>');
      out.loaders[key] = file.join('=');
    } else if (a === '--fetch') out.fetchHosted = true;
    else if (a === '--json') out.json = true;
    else if (a === '--help' || a === '-h') out.help = true;
    else if (a.startsWith('--')) throw new Error(`Unknown option: ${a}`);
    else if (!out.target) out.target = a;
    else throw new Error(`Unexpected argument: ${a}`);
  }
  return out;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
    if (args.help || !args.target) {
      console.log(
        'Usage: node playground/aspects-mobile/check.mjs <aspect-folder | metadata.json | pr-body.txt> [--extension <file>] [--loader <key>=<file>] [--fetch] [--json]',
      );
      process.exit(args.help ? 0 : 2);
    }
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
  try {
    const { submission, findings } = await runCheck(args.target, args);
    if (args.json) {
      console.log(
        JSON.stringify(
          { name: submission.name, type: submission.type, findings },
          null,
          2,
        ),
      );
    } else {
      console.log(
        `${submission.name || args.target} (${
          submission.type || 'unknown type'
        })`,
      );
      if (!findings.length) console.log('  no problems found');
      for (const level of ['error', 'warn', 'info']) {
        for (const f of findings.filter((x) => x.level === level))
          console.log(
            `  ${level.toUpperCase().padEnd(5)} ${f.field}: ${f.message}`,
          );
      }
    }
    process.exit(hasErrors(findings) ? 1 : 0);
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
}
