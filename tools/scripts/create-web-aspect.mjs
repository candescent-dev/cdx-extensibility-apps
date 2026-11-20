#!/usr/bin/env node
/**
 * Create your own web aspect from a sample template.
 *
 *   pnpm run create-aspect:web
 *   pnpm run create-aspect:web -- --template chatbot --name my-bank-chat --set uiurl=https://ui.my-bank.com/chat.html --yes
 *
 * (`pnpm run create-aspect` asks web or mobile first.) Writes only to aspects/web/<name>/, never to
 * the samples, so submit always knows which folder is yours:
 *   aspect-extension.js  aspect extension (goes to your FI repo as aspects/web/<name>/<name>.js)
 *   static-loader.js     static loader you host
 *   <ui page>.html       the template's UI page, which you host
 *   metadata.json        submission metadata (Developer Console fields), used by the PR
 *   template.json        the template schema, so submit can ask for anything still missing
 *
 * Asks for a template, a name and a sector, then offers a quick start (the template defaults, plus
 * anything without a default, such as the UI page URL) or one question per setting with a review
 * before anything is written. There is no web preview: try it in the OLB web playground.
 *
 * Options: --template <chatbot|modal>  --name <name>  --description <text>  --sector RETAIL|BUSINESS
 *          --set <field>=<value> (repeatable)  --customize (answer each setting, skips the setup menu)
 *          --yes (defaults, no prompts)  --force (overwrite)
 */
/* eslint-disable no-console */
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
  createFieldError,
  defaultAnswers,
  isLoaderField,
  nextSteps,
  originOf,
  pairProblem,
  scriptKeyFor,
  shownValue,
  validateName,
} from './lib/web-aspect-metadata.mjs';
import { createPrompter } from './prompt.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SAMPLES = join(ROOT, 'samples/web/aspects');
const TARGET_ROOT = join(ROOT, 'aspects/web');
const BOOTSTRAP_FILE = 'aspect-extension.js';
const LOADER_KEY = 'staticloaderkey';
// Styles only on a terminal (and not with NO_COLOR), so piped output stays plain text.
const styled = process.stdout.isTTY && !process.env.NO_COLOR;
const DIM = (t) => (styled ? `\x1b[2m${t}\x1b[0m` : t);
const BOLD = (t) => (styled ? `\x1b[1m${t}\x1b[0m` : t);
const SECTORS = [
  { value: 'RETAIL', label: 'Retail', hint: 'personal banking customers' },
  { value: 'BUSINESS', label: 'Business', hint: 'business banking customers' },
];

// Web aspects do not set Mount Strategy. The sample templates still carry it, so create drops it
// from both the generated metadata.json and the copied template.json. Page is kept: the console
// Page select stores the route.
const NOT_USED_WEB_FIXED = new Set(['ASPECT_PROPERTY_WEB_MOUNTSTRATEGY']);

export function listTemplates(samplesDir = SAMPLES) {
  return readdirSync(samplesDir, { withFileTypes: true })
    .filter(
      (d) =>
        d.isDirectory() && existsSync(join(samplesDir, d.name, 'template.json'))
    )
    .map((d) => {
      const template = JSON.parse(
        readFileSync(join(samplesDir, d.name, 'template.json'), 'utf8')
      );
      const fixed = Object.fromEntries(
        Object.entries(template.fixed ?? {}).filter(
          ([k]) => !NOT_USED_WEB_FIXED.has(k)
        )
      );
      return {
        dir: join(samplesDir, d.name),
        folder: d.name,
        ...template,
        fixed,
      };
    });
}

function matchTemplate(templates, id) {
  if (!id) return null;
  return (
    templates.find((t) => t.folder === id) ||
    templates.find((t) => t.id === id) ||
    templates.find((t) => t.type === id)
  );
}

function sri(buffer) {
  return `sha384-${createHash('sha384').update(buffer).digest('base64')}`;
}

function bootstrapPath(template) {
  const extension = join(template.dir, BOOTSTRAP_FILE);
  const named = join(template.dir, `${template.folder}.js`);
  if (existsSync(extension)) return extension;
  if (existsSync(named)) return named;
  throw new Error(`${template.dir}: no ${BOOTSTRAP_FILE}`);
}

/**
 * The template for one aspect: the static loader key defaults to its Script Name, and field help
 * names its ASPECT_SCRIPT_<key>_ properties.
 */
function forKey(template, key) {
  const from = `ASPECT_SCRIPT_${template.scriptKey}_`;
  return {
    ...template,
    scriptKey: key,
    fields: template.fields.map((f) => {
      const field = f.key === LOADER_KEY ? { ...f, default: key } : f;
      return field.help?.includes(from)
        ? {
            ...field,
            help: field.help.replaceAll(from, `ASPECT_SCRIPT_${key}_`),
          }
        : field;
    }),
  };
}

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
  // loadSecureExternalScript(staticloaderkey) looks up ASPECT_SCRIPT_<key>_URL, so the loader
  // key and the ASPECT_SCRIPT_ prefix are always the same value.
  const key = answers[LOADER_KEY] || scriptKeyFor(name);
  const values = { ...defaultAnswers(template), ...answers, [LOADER_KEY]: key };
  if (values.uiorigin) {
    values.uiorigin = originOf(values.uiorigin) || values.uiorigin;
  }
  const errors = template.fields
    .map((f) => createFieldError(f, values[f.key]))
    .filter(Boolean);
  const pairError = pairProblem(template, values);
  if (pairError) errors.push(pairError);
  if (errors.length) throw new Error(errors.join('\n'));

  const dir = join(targetRoot, name);
  if (existsSync(dir) && !force)
    throw new Error(
      `${dir} already exists. Pick another name or pass --force.`
    );
  mkdirSync(dir, { recursive: true });

  const bootstrap = readFileSync(bootstrapPath(template), 'utf8');
  const loader = readFileSync(join(template.dir, template.loaderFile), 'utf8');
  const { dir: _dir, folder: _folder, ...schema } = forKey(template, key);
  const metadata = buildMetadata({
    template: { ...template, scriptKey: key },
    name,
    description,
    sector,
    answers: values,
    sri: sri(Buffer.from(loader)),
  });
  const files = {
    [BOOTSTRAP_FILE]: bootstrap,
    [template.loaderFile]: loader,
    'metadata.json': `${JSON.stringify(metadata, null, 2)}\n`,
    'template.json': `${JSON.stringify(
      {
        ...schema,
        id: name,
        from: template.folder,
        scriptKey: key,
        loaderFile: template.loaderFile,
      },
      null,
      2
    )}\n`,
  };
  if (template.uiFile)
    files[template.uiFile] = readFileSync(
      join(template.dir, template.uiFile),
      'utf8'
    );
  for (const [file, content] of Object.entries(files))
    writeFileSync(join(dir, file), content);
  return { dir, files: Object.keys(files), metadata };
}

export function parseArgs(argv) {
  const out = { set: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    // `pnpm run create-aspect:web -- --template …` passes the `--` through (npm drops it).
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
  const question = `${f.label}${
    isLoaderField(f)
      ? ' (optional now, required at submit)'
      : f.required
      ? ''
      : ' (optional)'
  }`;
  let value = await p.ask(question, values[f.key] ?? '', error);
  for (let e; (e = createFieldError(f, value)); )
    value = await p.ask(question, values[f.key] ?? '', e);
  return value;
}

/** Asks for the partner of each paired field that is set while its partner is empty. */
async function askPartners(p, template, fields, values) {
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

export async function runCreateAspect(argv) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(
      readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0]
    );
    return;
  }
  const templates = listTemplates();
  let template = matchTemplate(templates, args.template);
  if (!template && args.template)
    throw new Error(
      `Unknown template "${args.template}". Available: ${templates
        .map((t) => t.folder)
        .join(', ')}`
    );
  console.log(`\n${BOLD('Create a web aspect')}\n`);
  const p = args.yes
    ? null
    : createPrompter({ cancelMessage: 'Cancelled. Nothing was created.' });

  try {
    if (!template)
      template = p
        ? templates[
            await p.choose(
              'Template',
              templates.map((t) => ({
                label: `${t.title} (${t.folder})`,
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
          template.folder
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
      // A template's name would make submit ask which one (aspects/web or the sample).
      if (templates.some((t) => t.folder === n || t.id === n))
        return `"${n}" is a template name. Pick your own, for example my-bank-${n}.`;
      if (!args.force && existsSync(join(TARGET_ROOT, n)))
        return `aspects/web/${n} already exists. Pick another name, or pass --force to replace it.`;
      return null;
    };
    let name = args.name ?? (p ? await p.ask(nameQuestion) : '');
    for (let error; (error = nameProblem(name)); ) {
      if (!p) throw new Error(error);
      name = await p.ask(nameQuestion, '', error);
    }
    template = forKey(template, scriptKeyFor(name));

    // Sector: a menu, Retail first.
    let sector = args.sector;
    if (sector && !SECTORS.some((x) => x.value === sector)) {
      if (!p) throw new Error('Sector must be RETAIL or BUSINESS.');
      p.log(`  Sector "${sector}" is not RETAIL or BUSINESS.`);
      sector = undefined;
    }
    if (!sector)
      sector = p ? SECTORS[await p.choose('Sector', SECTORS)].value : 'RETAIL';

    const values = defaultAnswers(template);
    for (const [k, v] of Object.entries(args.set)) {
      const f = template.fields.find((x) => x.key === k);
      const error = createFieldError(f, v);
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
            hint: 'use the defaults, and only ask what has no default',
          },
          { label: 'Answer each setting now' },
        ])) === 0);

    // Basic settings one per line; a collapsed group (advanced) is one line unless changed.
    const groups = template.groups?.length ? template.groups : [{ id: null }];
    const inGroup = (g) => (f) =>
      g.id === null || (f.group ?? groups[0].id) === g.id;
    const describe = () => {
      const rows = [
        ['Description', description],
        ['Sector', SECTORS.find((x) => x.value === sector).label],
      ];
      for (const g of groups) {
        const fields = template.fields.filter(inGroup(g));
        if (!fields.length) continue;
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

    if (quick && p) {
      // There is no web preview to fill the rest in later, so ask what the defaults can't cover.
      const missing = template.fields.filter(
        (f) => !(f.key in args.set) && createFieldError(f, values[f.key])
      );
      if (missing.length) p.log('');
      for (const f of missing) values[f.key] = await askField(p, f, values);
    }
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
      for (const g of groups) {
        const fields = template.fields.filter(
          (f) => !(f.key in args.set) && inGroup(g)(f)
        );
        if (!fields.length) continue;
        const title = (g.title ?? 'Settings').replace(/ \(optional\)$/, '');
        p.log('');
        if (g.collapsed) {
          // Optional groups (advanced) are skipped unless the developer opts in.
          p.log(DIM(`  ${fields.map((f) => f.label).join(', ')}`));
          if (!(await p.confirm(`${title}: change these now?`, false)))
            continue;
        } else p.log(BOLD(g.title ?? title));
        if (g.help) p.log(DIM(`  ${g.help}`));
        for (const f of fields) values[f.key] = await askField(p, f, values);
        await askPartners(p, template, fields, values);
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
          await askPartners(p, template, [f], values);
        }
      }
    } else if (p) {
      await askPartners(p, template, template.fields, values);
    }

    const created = scaffoldAspect({
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
    console.log(`
To change a setting, edit ${rel}/metadata.json; submit asks for anything still missing.

Next:
  1. Try it:     cd playground/web && docker compose up
                 open http://localhost:4200/home-page (Add Aspect → Manage Aspects)
  2. Host ${template.uiFile ?? 'the UI page'} and ${
      template.loaderFile ?? 'static-loader.js'
    }.
  3. Submit it:  pnpm run submit-to-fi -- --project ${name}
     (asks for the hosted loader URL, computes the SRI from it, checks everything and raises the FI repo PR)
`);
  } finally {
    p?.close();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  runCreateAspect(process.argv.slice(2)).catch((err) => {
    console.error(`\n${err.message}`);
    process.exit(1);
  });
}
