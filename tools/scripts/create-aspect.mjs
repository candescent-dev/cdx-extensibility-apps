#!/usr/bin/env node
/**
 * Create your own mobile V2 aspect from a sample template.
 *
 *   pnpm run create-aspect:mobile
 *   pnpm run create-aspect:mobile -- --template chatbot --name my-bank-chat --set apiUrl=https://chat.my-bank.com/api --yes
 *
 * (`pnpm run create-aspect` still works.) Writes only to aspects/mobile/<name>/, never to the samples, so submit
 * always knows which folder is yours:
 *   aspect-extension.js  aspect extension (goes to your FI repo as aspects/mobile/<name>/<name>.js)
 *   static-loader.v1.js  static loader you host
 *   <ui page>.html       the template's UI page, which you host
 *   metadata.json    submission metadata (Developer Console fields), used by the preview and the PR
 *   template.json    the template schema, so submit can ask for anything still missing
 *
 * Asks for a template, a name and a sector, then offers a quick start (the template defaults, changed
 * later in the preview) or one question per setting with a review before anything is written. It
 * can then open the preview with the new aspect selected.
 *
 * Options: --template <id|chatbot|modal>  --name <name>  --description <text>  --sector RETAIL|BUSINESS
 *          --set <field>=<value> (repeatable)  --customize (answer each setting, skips the setup menu)
 *          --yes (defaults, no prompts)  --force (overwrite)
 */
/* eslint-disable no-console */
import { spawn } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  buildMetadata,
  defaultAnswers,
  EXTENSION_FILE,
  fillUiAllowlists,
  isUiField,
  previewOnly,
  scriptKeyFor,
  validateField,
  validateName,
} from '../../playground/aspects-mobile/src/metadata-builder.mjs';
import { createPrompter } from './prompt.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SAMPLES = join(ROOT, 'samples/mobile/aspects');
const TARGET_ROOT = join(ROOT, 'aspects/mobile');

export function listTemplates(samplesDir = SAMPLES) {
  return readdirSync(samplesDir, { withFileTypes: true })
    .filter(
      (d) =>
        d.isDirectory() && existsSync(join(samplesDir, d.name, 'template.json'))
    )
    .map((d) => ({
      dir: join(samplesDir, d.name),
      ...JSON.parse(
        readFileSync(join(samplesDir, d.name, 'template.json'), 'utf8')
      ),
    }));
}

function sri(buffer) {
  return `sha384-${createHash('sha384').update(buffer).digest('base64')}`;
}

/**
 * Copies sample code, renaming the sample's Script Name and log tag to the new aspect's. Only the
 * staticLoaderKey assignment and the '[<id>]' tag are touched: the template id can equal other
 * strings in the code (for example ASPECT_TYPE = 'chatbot').
 */
function rename(code, template, name, key) {
  return code
    .split(`staticLoaderKey = '${template.scriptKey}'`)
    .join(`staticLoaderKey = '${key}'`)
    .split(`'[${template.id}]'`)
    .join(`'[${name}]'`);
}

/**
 * Creates the aspect folder. Pure enough to test: no prompts, no process exit.
 * Returns { dir, files, metadata }.
 */
export function scaffoldAspect({
  template,
  name,
  description,
  sector = 'RETAIL',
  answers = {},
  targetRoot = TARGET_ROOT,
  force = false,
}) {
  const nameError = validateName(name);
  if (nameError) throw new Error(`Name "${name}": ${nameError}`);
  const values = { ...defaultAnswers(template), ...answers };
  // A template's local-preview default (its own UI page) must point at the new folder's copy.
  for (const f of template.fields) {
    if (f.allowLocalHttp && values[f.key] === f.default)
      values[f.key] = String(f.default).replace(
        `/aspects/${template.id}/`,
        `/aspects/${name}/`
      );
  }
  const errors = template.fields
    .map((f) => validateField(f, values[f.key]))
    .filter(Boolean);
  if (errors.length) throw new Error(errors.join('\n'));

  const dir = join(targetRoot, name);
  if (existsSync(dir) && !force)
    throw new Error(
      `${dir} already exists. Pick another name or pass --force.`
    );
  mkdirSync(dir, { recursive: true });

  const key = scriptKeyFor(name);
  const bootstrap = rename(
    readFileSync(join(template.dir, EXTENSION_FILE), 'utf8'),
    template,
    name,
    key
  );
  const loader = rename(
    readFileSync(join(template.dir, template.loaderFile), 'utf8'),
    template,
    name,
    key
  );
  const loaderFile = 'static-loader.v1.js';
  const { dir: _dir, ...schema } = template;
  schema.fields = template.fields.map((f) =>
    f.allowLocalHttp
      ? {
          ...f,
          default: String(f.default).replace(
            `/aspects/${template.id}/`,
            `/aspects/${name}/`
          ),
        }
      : f
  );

  const metadata = buildMetadata({
    template,
    name,
    description,
    sector,
    answers: values,
    sri: sri(Buffer.from(loader)),
  });
  const files = {
    [EXTENSION_FILE]: bootstrap,
    [loaderFile]: loader,
    'metadata.json': `${JSON.stringify(metadata, null, 2)}\n`,
    'template.json': `${JSON.stringify(
      { ...schema, id: name, from: template.id, scriptKey: key, loaderFile },
      null,
      2
    )}\n`,
  };
  // The UI page is copied for you to host. The origins of values it must accept (for example the
  // chat backend) are added to its allowlists.
  if (template.uiFile)
    files[template.uiFile] = fillUiAllowlists(
      template,
      values,
      readFileSync(join(template.dir, template.uiFile), 'utf8')
    );
  for (const [file, content] of Object.entries(files))
    writeFileSync(join(dir, file), content);
  return { dir, files: Object.keys(files), metadata };
}

export { select } from './prompt.mjs';

// Styles only on a terminal (and not with NO_COLOR), so piped output stays plain text.
const styled = process.stdout.isTTY && !process.env.NO_COLOR;
const DIM = (t) => (styled ? `\x1b[2m${t}\x1b[0m` : t);
const BOLD = (t) => (styled ? `\x1b[1m${t}\x1b[0m` : t);
const SECTORS = [
  { value: 'RETAIL', label: 'Retail', hint: 'personal banking customers' },
  { value: 'BUSINESS', label: 'Business', hint: 'business banking customers' },
];

export function parseArgs(argv) {
  const out = { set: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    // `pnpm run create-aspect:mobile -- --template …` passes the `--` through (npm drops it).
    if (a === '--') continue;
    const next = () => {
      if (i + 1 >= argv.length) throw new Error(`${a} needs a value`);
      return argv[++i];
    };
    if (a === '--template') out.template = next();
    else if (a === '--name') out.name = next();
    else if (a === '--description') out.description = next();
    else if (a === '--sector') out.sector = next().toUpperCase();
    else if (a === '--set') {
      const [k, ...v] = next().split('=');
      out.set[k] = v.join('=');
    } else if (a === '--yes' || a === '-y') out.yes = true;
    else if (a === '--customize') out.customize = true;
    else if (a === '--force') out.force = true;
    else if (a === '--help' || a === '-h') out.help = true;
    else throw new Error(`Unknown option: ${a}`);
  }
  return out;
}

/** A value as people read it: the option label for choices, "not set" for empty values. */
export function shownValue(field, value) {
  if (value === '' || value == null) return 'not set';
  if (field.type === 'choice') return field.optionLabels?.[value] ?? value;
  return String(value);
}

/**
 * What the developer still has to do before submitting (values that only work in the preview, and
 * the loader they host), and what is recommended (production hints for empty values).
 */
export function nextSteps(template, values) {
  const needed = [];
  const recommended = [];
  for (const f of template.fields) {
    const v = values[f.key];
    const kind = previewOnly(v);
    if (kind === 'local')
      needed.push(
        isUiField(f) && template.uiFile
          ? `Host your copy of ${template.uiFile} and set "${f.label}" (it points at the local preview copy now).`
          : `Set "${f.label}" to your hosted https URL (it points at this machine now).`
      );
    else if (kind === 'placeholder')
      needed.push(
        `Set "${f.label}" (it is still the example-fi.com placeholder).`
      );
    else if (!v && f.productionHint)
      recommended.push(`${f.label}: ${f.productionHint}`);
  }
  needed.push(
    `Host ${'static-loader.v1.js'} at an https URL that sends Access-Control-Allow-Origin. Submit asks for it and takes the SRI from it.`
  );
  return { needed, recommended };
}

function openInBrowser(url) {
  const [cmd, args] =
    process.platform === 'darwin'
      ? ['open', [url]]
      : process.platform === 'win32'
      ? ['cmd', ['/c', 'start', '', url]]
      : ['xdg-open', [url]];
  try {
    const child = spawn(cmd, args, { stdio: 'ignore', detached: true });
    child.on('error', () => {});
    child.unref();
  } catch {
    /* no browser to open: the URL is printed */
  }
}

/** Asks one template field: a menu for choices, the default typed in for text. */
async function askField(p, f, values, error) {
  // Asked again with an error: redraw the same question in place, without repeating its help.
  if (f.help && !error) p.log(DIM(`  ${f.help}`));
  if (f.type === 'choice') {
    const current = Math.max(0, f.options.indexOf(values[f.key]));
    const picked = await p.choose(
      f.label,
      f.options.map((o) => ({ label: f.optionLabels?.[o] ?? o })),
      current
    );
    return f.options[picked];
  }
  const question = `${f.label}${f.required ? '' : ' (optional)'}`;
  let value = await p.ask(question, values[f.key] ?? '', error);
  for (let e; (e = validateField(f, value)); )
    value = await p.ask(question, values[f.key] ?? '', e);
  return value;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(
      readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0]
    );
    return;
  }
  const templates = listTemplates();
  let template = templates.find(
    (t) => t.id === args.template || t.type === args.template
  );
  if (!template && args.template)
    throw new Error(
      `Unknown template "${args.template}". Available: ${templates
        .map((t) => t.type)
        .join(', ')}`
    );
  console.log(`\n${BOLD('Create a mobile V2 aspect')}\n`);
  const p = args.yes
    ? null
    : createPrompter({ cancelMessage: 'Cancelled. Nothing was created.' });
  let created;
  let openPreview = false;
  try {
    if (!template)
      template = p
        ? templates[
            await p.choose(
              'Template',
              templates.map((t) => ({
                label: `${t.title} (${t.type})`,
                hint: t.description,
              }))
            )
          ]
        : templates[0];
    const unknown = Object.keys(args.set).filter(
      (k) => !template.fields.some((f) => f.key === k)
    );
    if (unknown.length)
      throw new Error(
        `Unknown --set field: ${unknown.join(', ')}. ${
          template.type
        } fields: ${template.fields.map((f) => f.key).join(', ')}.`
      );

    // Name: typed, checked in place (format, and not already taken).
    const nameQuestion =
      'Component name (lowercase, dashes, e.g. my-bank-chat)';
    const nameProblem = (n) => {
      if (!n)
        return p
          ? 'A component name is required.'
          : '--name is required with --yes.';
      const error = validateName(n);
      if (error) return `Name "${n}": ${error}`;
      // A template's name would hide that template in the preview, and make submit ask which one.
      if (templates.some((t) => t.id === n))
        return `"${n}" is a template name. Pick your own, for example my-bank-${n}.`;
      if (!args.force && existsSync(join(TARGET_ROOT, n)))
        return `aspects/mobile/${n} already exists. Pick another name, or pass --force to replace it.`;
      return null;
    };
    let name = args.name ?? (p ? await p.ask(nameQuestion) : '');
    for (let error; (error = nameProblem(name)); ) {
      if (!p) throw new Error(error);
      name = await p.ask(nameQuestion, '', error);
    }

    // Sector: a menu, Retail first.
    let sector = args.sector;
    if (sector && !SECTORS.some((x) => x.value === sector)) {
      if (!p) throw new Error('Sector must be RETAIL or BUSINESS.');
      p.log(`  Sector "${sector}" is not RETAIL or BUSINESS.`);
      sector = undefined;
    }
    if (!sector)
      sector = p ? SECTORS[await p.choose('Sector', SECTORS)].value : 'RETAIL';

    // Start from the template defaults (the local UI page default pointing at this aspect's copy).
    const values = {};
    for (const f of template.fields)
      values[f.key] = f.allowLocalHttp
        ? String(f.default ?? '').replace(
            `/aspects/${template.id}/`,
            `/aspects/${name}/`
          )
        : f.default ?? '';
    for (const [k, v] of Object.entries(args.set)) {
      const f = template.fields.find((x) => x.key === k);
      const error = validateField(f, v);
      if (error && !p) throw new Error(error);
      if (error) p.log(`  --set ${k}: ${error}`);
      else values[k] = v;
    }
    let description = args.description ?? `${template.title} for ${name}`;

    const quick =
      !p ||
      (!args.customize &&
        (await p.choose('How do you want to set it up?', [
          {
            label: 'Quick start',
            hint: 'use the defaults now, change them in the preview',
          },
          { label: 'Answer each setting now' },
        ])) === 0);

    // Basic settings one per line; an optional group (sign-in, advanced) is one line unless changed.
    const describe = () => {
      const groups = template.groups?.length ? template.groups : [{ id: null }];
      const rows = [
        ['Description', description],
        ['Sector', SECTORS.find((x) => x.value === sector).label],
      ];
      for (const g of groups) {
        const fields = template.fields.filter(
          (f) => g.id === null || (f.group ?? groups[0].id) === g.id
        );
        const changed = fields.filter(
          (f) => String(values[f.key] ?? '') !== String(f.default ?? '')
        );
        const title = (g.title ?? 'Settings').replace(/ \(optional\)$/, '');
        if (g.collapsed && !changed.length)
          rows.push([
            title,
            fields.every((f) => !f.default) ? 'off' : 'defaults',
          ]);
        else
          for (const f of g.collapsed ? changed : fields)
            rows.push([f.label, shownValue(f, values[f.key])]);
      }
      const width = Math.max(...rows.map(([l]) => l.length));
      return rows.map(([l, v]) => `  ${l.padEnd(width)}  ${v}`);
    };

    if (!quick) {
      if (args.description === undefined) {
        description = await p.ask('Description', description);
        for (let e; (e = description ? null : 'A description is required.'); )
          description = await p.ask(
            'Description',
            `${template.title} for ${name}`,
            e
          );
      }
      const groups = template.groups?.length ? template.groups : [{ id: null }];
      for (const g of groups) {
        const fields = template.fields.filter(
          (f) =>
            !(f.key in args.set) &&
            (g.id === null || (f.group ?? groups[0].id) === g.id)
        );
        if (!fields.length) continue;
        const title = (g.title ?? 'Settings').replace(/ \(optional\)$/, '');
        p.log('');
        if (g.collapsed) {
          // Optional groups (sign-in, advanced) are skipped unless the developer opts in.
          p.log(DIM(`  ${fields.map((f) => f.label).join(', ')}`));
          if (!(await p.confirm(`${title}: change these now?`, false)))
            continue;
        } else p.log(BOLD(title));
        if (g.help) p.log(DIM(`  ${g.help}`));
        for (const f of fields) values[f.key] = await askField(p, f, values);
        // Paired fields (the sign-in client id and redirect URL) need each other.
        for (const f of fields) {
          const partner = template.fields.find((x) => x.key === f.requires);
          while (partner && values[f.key] && !values[partner.key]) {
            values[partner.key] = await askField(
              p,
              partner,
              values,
              `${partner.label} is needed when ${f.label} is set.`
            );
          }
        }
      }

      // Review, then create or change one setting.
      for (;;) {
        p.log('');
        p.log(BOLD('Your settings'));
        describe().forEach((line) => p.log(line));
        p.log('');
        const next = await p.choose('Ready?', [
          { label: 'Create it' },
          { label: 'Change a setting' },
          { label: 'Cancel' },
        ]);
        if (next === 0) break;
        if (next === 2) throw new Error('Cancelled. Nothing was created.');
        const editable = [
          { label: 'Description', hint: description },
          {
            label: 'Sector',
            hint: SECTORS.find((x) => x.value === sector).label,
          },
          ...template.fields.map((f) => ({
            label: f.label,
            hint: shownValue(f, values[f.key]),
          })),
        ];
        const which = await p.choose('Which setting?', editable);
        if (which === 0)
          description =
            (await p.ask('Description', description)) || description;
        else if (which === 1)
          sector =
            SECTORS[
              await p.choose(
                'Sector',
                SECTORS,
                SECTORS.findIndex((x) => x.value === sector)
              )
            ].value;
        else {
          const f = template.fields[which - 2];
          values[f.key] = await askField(p, f, values);
        }
      }
    }

    created = scaffoldAspect({
      template,
      name,
      description,
      sector,
      answers: values,
      force: args.force,
    });
    p?.settle();
    const rel = relative(ROOT, created.dir);
    console.log(`\n${BOLD(`Created ${rel}/`)}`);
    created.files.forEach((f) => console.log(DIM(`  ${f}`)));
    if (quick) {
      console.log(`\n${BOLD('Settings')} ${DIM('(the template defaults)')}`);
      describe().forEach((line) => console.log(line));
    }
    const { needed, recommended } = nextSteps(template, values);
    console.log(`\n${BOLD('Before you submit')}`);
    needed.forEach((n) => console.log(`  - ${n}`));
    if (recommended.length) {
      console.log(`\n${BOLD('Recommended')}`);
      recommended.forEach((n) => console.log(`  - ${n}`));
    }
    console.log(
      `\nChange any setting in the preview (Customize, then Save), or edit ${rel}/metadata.json.`
    );
    if (p?.tty) openPreview = await p.confirm('Open the preview now?', true);
  } finally {
    p?.close();
  }

  const { name } = created.metadata;
  if (openPreview) {
    const { startPreviewServer } = await import(
      '../../playground/aspects-mobile/serve.mjs'
    );
    const preview = startPreviewServer({
      onReady: (url) => {
        const page = `${url}/?aspect=${encodeURIComponent(name)}`;
        console.log(`\nMobile Aspect Preview: ${page}\nPress Ctrl+C to stop.`);
        openInBrowser(page);
      },
    });
    process.on('SIGINT', () => {
      preview.stop();
      process.exit(0);
    });
    return;
  }
  console.log(`
Next:
  1. Preview it:   pnpm exec nx run aspects-mobile-preview:serve   (pick "${name}")
  2. Host static-loader.v1.js at a versioned https URL that sends Access-Control-Allow-Origin.
  3. Submit it:    pnpm run submit-to-fi -- --project ${name}
     (asks for the hosted URL, computes the SRI from it, checks everything and raises the FI repo PR)
`);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((err) => {
    console.error(`\n${err.message}`);
    process.exit(1);
  });
}
