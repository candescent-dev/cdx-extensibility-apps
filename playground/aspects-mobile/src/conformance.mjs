/*
 * Mobile V2 aspect conformance checks.
 *
 * Pure functions (no DOM, no network) shared by the preview UI, its tests and the Forge CLI.
 * Input is the submission metadata exactly as it appears in the FI repo pull request
 * ("Metadata:" JSON with ASPECT_* properties). Output is a list of findings:
 *   { level: 'error' | 'warn' | 'info', field, message }
 * 'error' means the mobile app would drop the aspect, or it can never load or show.
 * The rules follow aspect manifest schemaVersion 2.0.0 and how the iOS and Android apps apply it.
 */
import { screenForPage } from './form-values.mjs';

const PROPERTY = {
  type: 'ASPECT_TYPE',
  csp: 'ASPECT_PROPERTY_MOBILE_CONTENTSECURITYPOLICY',
  sandbox: 'ASPECT_PROPERTY_MOBILE_SANDBOXDIRECTIVES',
  placement: 'ASPECT_PROPERTY_MOBILE_PLACEMENTID',
  size: 'ASPECT_PROPERTY_MOBILE_PLACEMENTSIZE',
  displayAuthority: 'ASPECT_PROPERTY_MOBILE_DISPLAYAUTHORITY',
  mountStrategy: 'ASPECT_PROPERTY_MOBILE_MOUNTSTRATEGY',
  trigger: 'ASPECT_PROPERTY_MOBILE_TRIGGER',
  frequency: 'ASPECT_PROPERTY_MOBILE_FREQUENCY',
  page: 'ASPECT_PROPERTY_MOBILE_PAGE',
};

const SCRIPT_PREFIX = 'ASPECT_SCRIPT_';

/** Accepts the PR body ("Metadata:\n{...}"), a JSON string, or an object. */
export function parseMetadataInput(input) {
  if (input && typeof input === 'object') return input;
  const text = String(input ?? '').trim();
  const start = text.indexOf('{');
  if (start === -1) throw new Error('No JSON object found in the metadata.');
  // The PR body may continue after the JSON (bot summaries); take the first balanced object.
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (ch === '\\') i++;
      else if (ch === '"') inString = false;
    } else if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0)
      return JSON.parse(text.slice(start, i + 1));
  }
  throw new Error('Metadata JSON is not complete.');
}

/** Normalises submission metadata into the shape the runtime and checks use. */
export function normalizeSubmission(metadata) {
  const props = {};
  for (const p of metadata.properties ?? []) {
    if (p && typeof p.propertyName === 'string')
      props[p.propertyName] = p.propertyValue ?? '';
  }

  const scripts = {};
  for (const name of Object.keys(props)) {
    const m = /^ASPECT_SCRIPT_(.+)_URL$/.exec(name);
    if (m) scripts[m[1]] = { url: props[name], sri: '', data: {}, html: {} };
  }
  // Longest key first so a key that prefixes another key cannot steal its properties.
  const keys = Object.keys(scripts).sort((a, b) => b.length - a.length);
  const unmatched = [];
  for (const [name, value] of Object.entries(props)) {
    if (!name.startsWith(SCRIPT_PREFIX) || /_URL$/.test(name)) continue;
    const key = keys.find((k) => name.startsWith(`${SCRIPT_PREFIX}${k}_`));
    if (!key) {
      unmatched.push(name);
      continue;
    }
    const rest = name.slice(`${SCRIPT_PREFIX}${key}_`.length);
    if (rest === 'SRI') scripts[key].sri = value;
    else if (rest.startsWith('DATA_')) scripts[key].data[rest.slice(5)] = value;
    else if (rest.startsWith('HTML_')) scripts[key].html[rest.slice(5)] = value;
    else unmatched.push(name);
  }

  // One entry per feature, as the apps split it: "camera=(), geolocation=(self)" on , or ;.
  const permissions = Object.entries(props)
    .filter(([name, value]) => /PERMISSION/i.test(name) && String(value).trim())
    .flatMap(([name, value]) =>
      String(value)
        .split(/[,;]/)
        .map((e) => e.trim())
        .filter(Boolean)
        .map((entry) => ({ name, entry })),
    );

  // Aspect properties: any other ASPECT_PROPERTY_MOBILE_<NAME>, handed to the aspect extension as
  // dbk.getAspectConfig().properties[<name>] (lowercase; the aspect extension matches any case).
  const known = new Set(Object.values(PROPERTY));
  const aspectProperties = {};
  for (const [name, value] of Object.entries(props)) {
    const m = /^ASPECT_PROPERTY_MOBILE_(.+)$/.exec(name);
    if (m && !known.has(name) && !/PERMISSION/i.test(name))
      aspectProperties[m[1].toLowerCase()] = String(value);
  }

  return {
    name: metadata.name ?? '',
    isEnabledMobile: metadata.isEnabledMobile === true,
    isEnabledWeb: metadata.isEnabledWeb === true,
    type: String(props[PROPERTY.type] ?? '').toLowerCase(),
    csp: props[PROPERTY.csp] ?? '',
    sandbox: splitTokens(props[PROPERTY.sandbox]),
    permissions,
    placement: props[PROPERTY.placement] ?? '',
    size: props[PROPERTY.size] ?? '',
    displayAuthority: props[PROPERTY.displayAuthority] ?? '',
    mountStrategy: props[PROPERTY.mountStrategy] ?? '',
    trigger: props[PROPERTY.trigger] ?? '',
    frequency: props[PROPERTY.frequency] ?? '',
    page: props[PROPERTY.page] ?? '',
    scripts,
    aspectProperties,
    unmatchedScriptProperties: unmatched,
  };
}

// Spaces only, as the apps split sandbox tokens: "allow-scripts,allow-same-origin" is one bad token.
function splitTokens(value) {
  return String(value ?? '')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/** Parses a CSP string into [{ name, sources }]. */
export function parseCsp(csp) {
  return String(csp ?? '')
    .split(';')
    .map((d) => d.trim())
    .filter(Boolean)
    .map((d) => {
      const [name, ...sources] = d.split(/\s+/);
      return { name: name.toLowerCase(), sources };
    });
}

// Keywords the apps expect in single quotes; nonce/hash sources too.
const CSP_KEYWORDS =
  /^(self|none|unsafe-inline|unsafe-eval|unsafe-hashes|strict-dynamic|report-sample|wasm-unsafe-eval|nonce-[\w+/=-]+|sha(256|384|512)-[\w+/=]+)$/i;

export function checkCsp(csp, rules) {
  const out = [];
  const field = 'CSP Directives';
  const nonce = rules.csp.requiredScriptSrc;
  if (!String(csp ?? '').trim()) {
    out.push(
      finding(
        'error',
        field,
        `CSP is empty. The app then uses script-src 'self' with no nonce, so your scripts can't load. Add at least script-src 'self' ${nonce}.`,
      ),
    );
    return out;
  }
  if (csp.includes(',')) {
    // A <meta> CSP is one policy: a comma only spoils the source it touches, which is then ignored.
    const spoilsNonce = /'nonce-aspect',|,\s*'nonce-aspect'/.test(csp);
    out.push(
      finding(
        spoilsNonce ? 'error' : 'warn',
        field,
        `CSP sources must be separated by spaces, not commas. A source with a comma attached (for example 'self',) is invalid and ignored${
          spoilsNonce
            ? `; here that is ${nonce}, so your scripts are blocked`
            : ''
        }.`,
      ),
    );
  }
  const directives = parseCsp(csp);
  for (const d of directives) {
    if (rules.csp.unconfirmedDirectives.includes(d.name)) {
      out.push(
        finding(
          'warn',
          field,
          `${d.name} is offered by the console but is not in the manifest's allowed list. Confirm with the mobile team before relying on it.`,
        ),
      );
    } else if (!rules.csp.allowedDirectives.includes(d.name)) {
      out.push(
        finding(
          'error',
          field,
          `${d.name} is not allowed on mobile, so the app drops the aspect (allowed: ${rules.csp.allowedDirectives.join(
            ', ',
          )}).`,
        ),
      );
    }
    for (const src of d.sources) {
      if (CSP_KEYWORDS.test(src)) {
        const isNonce = `'${src}'` === nonce;
        out.push(
          finding(
            isNonce ? 'error' : 'warn',
            field,
            `${d.name}: ${src} needs single quotes ('${src}'). Without them it is read as a host name${
              isNonce
                ? ', and the app cannot insert its nonce, so your scripts are blocked'
                : ''
            }.`,
          ),
        );
      }
    }
  }
  // Scripts follow default-src when there is no script-src.
  const script =
    directives.find((d) => d.name === 'script-src') ??
    directives.find((d) => d.name === 'default-src');
  const where = script?.name ?? 'script-src';
  if (!script?.sources.includes(nonce)) {
    const httpsHost = script?.sources.some((x) => /^https:\/\/\S+/i.test(x));
    out.push(
      httpsHost
        ? finding(
            'warn',
            field,
            `${where} has no ${nonce}. Scripts then load only if ${where} lists the exact https host of the aspect extension and of every loader. Add ${nonce} to be safe.`,
          )
        : finding(
            'error',
            field,
            `${where} has no ${nonce} and no https host, so the aspect extension and loader are blocked. Add ${nonce} to script-src.`,
          ),
    );
  }
  for (const bad of rules.csp.forbiddenScriptSrc) {
    if (script?.sources.includes(bad))
      out.push(
        finding(
          'warn',
          field,
          `${where} allows ${bad}, which lets code run text as script. The app doesn't block it, but remove it unless you need it.`,
        ),
      );
  }
  return out;
}

export function checkSri(sri, rules) {
  const field = 'SRI Hash';
  const value = String(sri ?? '').trim();
  if (!value) return [finding('error', field, 'SRI hash is missing.')];
  if (rules.script.knownBadSri[value])
    return [finding('error', field, rules.script.knownBadSri[value])];
  const m = /^(sha256|sha384|sha512)-([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!m) {
    return [
      finding(
        'error',
        field,
        'SRI must look like sha384-<base64>. Hex output (from shasum) or a missing prefix will never match.',
      ),
    ];
  }
  if (m[2].length !== rules.script.sriAlgorithms[m[1]]) {
    return [
      finding(
        'error',
        field,
        `A ${m[1]} hash is ${
          rules.script.sriAlgorithms[m[1]]
        } base64 characters; this one is ${
          m[2].length
        }. It was probably truncated.`,
      ),
    ];
  }
  return [];
}

export function checkScriptUrl(url, rules) {
  const field = 'Script URL';
  let u;
  try {
    u = new URL(url);
  } catch {
    return [
      finding(
        'error',
        field,
        `Script URL is not a valid absolute URL: "${url}".`,
      ),
    ];
  }
  const out = [];
  if (u.protocol !== 'https:')
    out.push(finding('error', field, 'Script URL must use https.'));
  const reason = rules.script.forbiddenHosts[u.hostname];
  if (reason) out.push(finding('error', field, reason));
  const file = u.pathname.split('/').pop() ?? '';
  if (!/[.-]v?\d+(\.\d+)*\.js$/i.test(file)) {
    out.push(
      finding(
        'warn',
        field,
        `"${file}" has no version in its name. Publish immutable files (for example loader.v1.js) and add a new version for every change; the hash pins the exact bytes.`,
      ),
    );
  }
  return out;
}

function checkEnum(out, field, value, spec, label) {
  if (!value) {
    // The apps fill a missing value with the manifest default instead of dropping the aspect.
    out.push(
      finding(
        'warn',
        field,
        `${label} is not set, so the app uses its default.`,
      ),
    );
    return;
  }
  if (
    spec.rejected.includes(value) ||
    (spec.strict && !spec.known.includes(value))
  ) {
    out.push(
      finding(
        'error',
        field,
        `${label} "${value}" is not supported on mobile (manifest: ${spec.known.join(
          ', ',
        )}); the app drops the aspect.`,
      ),
    );
  } else if (!spec.known.includes(value)) {
    out.push(
      finding(
        'warn',
        field,
        `${label} "${value}" has not been confirmed for mobile (known: ${spec.known.join(
          ', ',
        )}).`,
      ),
    );
  }
}

/**
 * Checks a normalized submission. Optional `sources` = { bootstrap: string, loaders: { [key]: string } }
 * adds static checks of the code.
 */
export function checkSubmission(sub, rules, sources = {}) {
  const out = [];
  if (!sub.isEnabledMobile)
    out.push(
      finding(
        'error',
        'Platform',
        'Mobile is not enabled for this submission (isEnabledMobile is false).',
      ),
    );
  if (sub.isEnabledWeb)
    out.push(
      finding(
        'info',
        'Platform',
        'Web is also enabled. Web reads its own ASPECT_PROPERTY_WEB_* values; this preview checks mobile only.',
      ),
    );

  const typeRules = rules.types[sub.type];
  if (!typeRules) {
    out.push(
      finding(
        'error',
        'Aspect Type',
        `Aspect type "${sub.type}" is not available on mobile (chatbot or modal).`,
      ),
    );
    return out;
  }

  out.push(...checkCsp(sub.csp, rules));

  const extra = sub.sandbox.filter((t) => !rules.sandbox.allowed.includes(t));
  if (extra.length)
    out.push(
      finding(
        'error',
        'Sandbox Directives',
        `Only ${rules.sandbox.allowed.join(
          ' ',
        )} are allowed on mobile, so the app drops the aspect; remove ${extra.join(
          ', ',
        )}.${
          extra.some((t) => t.includes(','))
            ? ' Separate tokens with spaces, not commas.'
            : ''
        }`,
      ),
    );
  for (const t of rules.sandbox.allowed) {
    if (!sub.sandbox.includes(t))
      out.push(
        finding(
          'info',
          'Sandbox Directives',
          `${t} is not listed; the app always adds it on mobile.`,
        ),
      );
  }

  for (const { entry } of sub.permissions) {
    const m = /^([\w-]+)\s*=\s*(.*)$/.exec(entry);
    if (!m) {
      out.push(
        finding(
          'warn',
          'Permission Policy',
          `"${entry}" is not a feature=(allowlist) entry; the app denies what it can't read.`,
        ),
      );
      continue;
    }
    // "camera=()" is a denial and passes; any allowlist grants the feature, which mobile never allows.
    const allowlist = m[2].replace(/[()]/g, '').trim();
    if (allowlist)
      out.push(
        finding(
          'error',
          'Permission Policy',
          `Mobile grants no device permissions, so the app drops the aspect. Remove ${entry}; an empty ${m[1]}=() is fine.`,
        ),
      );
  }

  checkEnum(out, 'Placement', sub.placement, typeRules.placements, 'Placement');
  if (sub.size && !typeRules.sizes.includes(sub.size))
    out.push(
      finding(
        'warn',
        'Placement Size',
        `Placement size "${sub.size}" is not one of ${typeRules.sizes.join(
          ', ',
        )}.`,
      ),
    );
  checkEnum(
    out,
    'Display Authority',
    sub.displayAuthority,
    typeRules.displayAuthority,
    'Display authority',
  );
  checkEnum(
    out,
    'Mount Strategy',
    sub.mountStrategy,
    typeRules.mountStrategy,
    'Mount strategy',
  );
  checkEnum(out, 'Trigger', sub.trigger, typeRules.trigger, 'Trigger');
  checkEnum(out, 'Frequency', sub.frequency, typeRules.frequency, 'Frequency');
  const capsForAuthority =
    typeRules.frequency.byDisplayAuthority?.[sub.displayAuthority];
  if (
    sub.frequency &&
    capsForAuthority &&
    typeRules.frequency.known.includes(sub.frequency) &&
    !capsForAuthority.includes(sub.frequency)
  )
    out.push(
      finding(
        'warn',
        'Frequency',
        `Frequency "${sub.frequency}" is not in the manifest for ${
          sub.displayAuthority
        } (allowed: ${capsForAuthority.join(', ')}); the app only logs this, so check the behaviour on a device.`,
      ),
    );

  // The apps keep a modal with no usable page but never show it (it logs a warning).
  if (typeRules.pageRequired && !sub.page)
    out.push(
      finding(
        'error',
        'Page',
        'The modal has no page, so the app never shows it. Set Page to Home, My Accounts or My Settings.',
      ),
    );
  else if (typeRules.pageRequired) {
    const screen = screenForPage(sub.page);
    if (screen === 'transactions')
      out.push(
        finding(
          'error',
          'Page',
          `Neither app shows aspects on Transaction History ("${sub.page}"), so this modal never appears. Pick Home, My Accounts or My Settings.`,
        ),
      );
    else if (!screen)
      out.push(
        finding(
          'error',
          'Page',
          `"${sub.page}" doesn't match a mobile screen, so the app never shows this modal. Pick Home, My Accounts or My Settings.`,
        ),
      );
  }

  const keys = Object.keys(sub.scripts);
  if (!keys.length)
    out.push(
      finding(
        'warn',
        'Loader Script',
        'No loader script (ASPECT_SCRIPT_<name>_URL). The app accepts this, but only the aspect extension runs.',
      ),
    );
  for (const key of keys) {
    const s = sub.scripts[key];
    const prefix = (f) => `Loader "${key}" · ${f}`;
    for (const f of checkScriptUrl(s.url, rules))
      out.push({ ...f, field: prefix(f.field) });
    for (const f of checkSri(s.sri, rules))
      out.push({ ...f, field: prefix(f.field) });
    if (key !== key.toLowerCase()) {
      out.push(
        finding(
          'warn',
          prefix('Script Name'),
          'The app matches Script Name exactly, including case, so the aspect extension must use the same spelling. Lowercase avoids mistakes.',
        ),
      );
    }
    for (const [name, value] of Object.entries(s.html)) {
      if (/^\s*[{[]/.test(value)) {
        out.push(
          finding(
            'warn',
            prefix('HTML Attributes'),
            `"${name}" looks like JSON config. HTML Attributes become attributes on the <script> tag; loader settings normally go in Data Attributes.`,
          ),
        );
      }
    }
    for (const [name, value] of Object.entries(s.data)) {
      const text = String(value ?? '').trim();
      if (looksLikeJson(text) && !parsesAsJson(text)) {
        out.push(
          finding(
            'warn',
            prefix('Data Attributes'),
            `"${name}" starts like JSON but is not valid JSON, so a loader that parses it gets nothing.`,
          ),
        );
      } else if (
        /url$/i.test(name) &&
        text &&
        !/^https:\/\//i.test(text) &&
        !/^feature:/i.test(text) &&
        !text.startsWith('/')
      ) {
        out.push(
          finding(
            'warn',
            prefix('Data Attributes'),
            `${name} = "${text}" is not an https URL. Devices need https (a link may also be an in-app route such as /app/home, or feature:<id>).`,
          ),
        );
      }
    }
  }
  for (const name of sub.unmatchedScriptProperties) {
    out.push(
      finding(
        'warn',
        'Loader Script',
        `${name} does not belong to any loader with a URL.`,
      ),
    );
  }

  if (sources.bootstrap != null)
    out.push(...checkBootstrap(sources.bootstrap, keys));
  for (const [key, code] of Object.entries(sources.loaders ?? {})) {
    out.push(...checkLoaderSource(code, sub, rules, key, sources.bootstrap));
  }
  return out;
}

// The runtime's loader call and its two aliases (aspect_runtime_loader.js on both apps). The aliases
// have common names, so they only count when called on dbk.
const LOAD_CALL =
  '(?:\\bloadSecureExternalScript|\\bdbk\\s*\\.\\s*(?:loadAspectsScript|loadScript))';

/** Finds the key(s) the aspect extension asks the runtime to load. */
export function bootstrapKeys(code) {
  const found = new Set();
  const src = stripComments(code);
  for (const m of src.matchAll(
    new RegExp(`${LOAD_CALL}\\(\\s*['"]([^'"]+)['"]`, 'g'),
  ))
    found.add(m[1]);
  if (new RegExp(`${LOAD_CALL}\\(\\s*[A-Za-z_$]`).test(src)) {
    for (const m of src.matchAll(
      /(?:staticLoaderKey|scriptKey)\s*=\s*['"]([^'"]+)['"]/g,
    ))
      found.add(m[1]);
  }
  return [...found];
}

/** Notes an aspect extension that looks at other frames: the runtime defines dbk in the aspect extension's own frame. */
export function checkBridgeLookup(code, field) {
  const src = stripComments(code);
  if (/window\.(?:parent|top)\b/.test(src)) {
    return [
      finding(
        'info',
        field,
        'The aspect extension looks at other frames. The app defines window.dbk in the host shell, the frame the aspect extension runs in, before it runs the aspect extension; use window.dbk.',
      ),
    ];
  }
  return [];
}

/**
 * Notes a loader that talks to the app itself. Only the aspect extension does: it uses dbk, and the loader
 * sends it the UI's requests on the aspect extension channel.
 */
export function checkLoaderBridge(code, field) {
  const src = stripComments(code);
  const out = [];
  if (/\bdbk\s*[.[]/.test(src)) {
    out.push(
      finding(
        'info',
        field,
        "The loader uses dbk. Only the aspect extension uses dbk and talks to the app: send the UI's requests to the aspect extension on the aspect extension channel ({ type: 'ASPECT_EXTENSION', direction: 'loaderToExtension', name: 'hostAction', payload: { action, payload } }).",
      ),
    );
  }
  if (/['"]ASPECT_MESSAGE['"]/.test(src)) {
    out.push(
      finding(
        'info',
        field,
        "The loader uses the app's ASPECT_MESSAGE envelope. Posted to window.parent, it goes straight to the app and skips the aspect extension's checks. Only the aspect extension talks to the app: send it the UI's requests on the aspect extension channel, and give the UI messages a type of your own.",
      ),
    );
  }
  return out;
}

export function checkBootstrap(code, keys) {
  const field = 'Aspect extension';
  if (!new RegExp(LOAD_CALL).test(stripComments(code))) {
    return [
      finding(
        'error',
        field,
        'The aspect extension never calls dbk.loadSecureExternalScript(), so no loader runs.',
      ),
    ];
  }
  const bridge = checkBridgeLookup(code, field);
  const asked = bootstrapKeys(code);
  if (!asked.length)
    return [
      ...bridge,
      finding(
        'warn',
        field,
        'Could not find which Script Name the aspect extension loads; check it matches the form.',
      ),
    ];
  return bridge.concat(
    asked
      .filter((k) => !keys.includes(k))
      .map((k) =>
        finding(
          'error',
          field,
          `The aspect extension loads "${k}" but the submission registers ${
            keys.length ? keys.map((x) => `"${x}"`).join(', ') : 'no loader'
          }. The Script Name in the form and the name the aspect extension passes to loadSecureExternalScript must match exactly.`,
        ),
      ),
  );
}

// The aspect type a loader declares, as the templates do (ASPECT_TYPE = 'chatbot', aspectType: 'modal').
function declaredType(src) {
  const m = src.match(
    /\b(?:ASPECT_TYPE|aspectType)\s*[:=]\s*['"](chatbot|modal)['"]/,
  );
  return m ? m[1] : null;
}

/**
 * Scans a loader. The app actions it may send are looked for in the aspect extension and the loader together,
 * since the loader passes the UI's requests to the aspect extension, which sends them to the app.
 */
export function checkLoaderSource(code, sub, rules, key, bootstrap) {
  const field = `Loader "${key}" · Code`;
  const src = stripComments(code);
  const out = [...checkLoaderBridge(code, field)];
  for (const rule of rules.sourceScan) {
    if (new RegExp(rule.pattern).test(src))
      out.push(finding('warn', field, rule.message));
  }
  const both = bootstrap == null ? src : `${stripComments(bootstrap)}\n${src}`;
  const identifiers = new Set(both.match(/[A-Za-z_$][\w$]*/g));
  const calls = (name) => identifiers.has(name);
  const declared = declaredType(src);
  if (declared && declared !== sub.type)
    out.push(
      finding(
        'warn',
        field,
        `This loader says it is a ${declared} loader, but the submission is a ${sub.type}. Is it the ${declared} loader?`,
      ),
    );
  if (sub.type === 'modal') {
    if (sub.displayAuthority === 'partner_delegated' && !calls('modalOpen')) {
      out.push(
        finding(
          'error',
          field,
          'A partner-delegated modal stays hidden until modalOpen { reason } reaches the app within 15 seconds; neither the aspect extension nor this loader ever sends it.',
        ),
      );
    }
    if (calls('chatbotOpen'))
      out.push(
        finding(
          'warn',
          field,
          'This modal aspect sends chatbotOpen, which the app rejects for a modal. Is it the chatbot loader or aspect extension?',
        ),
      );
  }
  if (sub.type === 'chatbot') {
    if (!calls('chatbotOpen'))
      out.push(
        finding(
          'warn',
          field,
          'Neither the aspect extension nor this loader ever sends chatbotOpen, so the panel cannot expand.',
        ),
      );
    if (calls('modalOpen'))
      out.push(
        finding(
          'warn',
          field,
          'This chatbot aspect sends modalOpen, which the app rejects for a chatbot. Is it the modal loader or aspect extension?',
        ),
      );
  }
  return out;
}

/** Validates one aspect -> host message against the manifest payload schema. Returns an error string or null. */
export function checkMessage(type, action, payload, rules) {
  const schema = rules.types[type]?.messages?.[action];
  if (!schema)
    return `"${action}" is not a ${type} message (allowed: ${Object.keys(
      rules.types[type]?.messages ?? {},
    ).join(', ')}).`;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload))
    return 'payload must be an object';
  for (const k of schema.required)
    if (!(k in payload)) return `missing required key "${k}"`;
  for (const [k, v] of Object.entries(payload)) {
    if (!Object.prototype.hasOwnProperty.call(schema.props, k))
      return `extra key "${k}" is not allowed`;
    const rule = schema.props[k];
    if (Array.isArray(rule) && !rule.includes(v))
      return `${k} must be one of ${rule.join(' | ')}`;
    if (rule === 'string' && typeof v !== 'string')
      return `${k} must be a string`;
    // Both apps reject blank strings and arrays.
    if (typeof v === 'string' && !v.trim()) return `${k} must not be blank`;
    if (
      rule === 'object' &&
      (typeof v !== 'object' || v === null || Array.isArray(v))
    )
      return `${k} must be an object, not ${Array.isArray(v) ? 'an array' : typeof v}`;
  }
  return null;
}

/**
 * Hosts an aspect may navigate to besides the bank's own host: the https host sources of its CSP
 * frame-src and connect-src (AspectSecurityUtils.navigableHosts on both apps). Keywords, scheme-only
 * sources, non-https sources, a bare * and TLD-wide wildcards (*.com) don't count.
 */
export function navigableHosts(csp) {
  const hosts = [];
  for (const d of parseCsp(csp)) {
    if (d.name !== 'frame-src' && d.name !== 'connect-src') continue;
    for (const src of d.sources) {
      if (src.startsWith("'")) continue;
      let rest = src;
      const scheme = /^([a-z][\w+.-]*):\/\//i.exec(src);
      if (scheme) {
        if (scheme[1].toLowerCase() !== 'https') continue;
        rest = src.slice(scheme[0].length);
      } else if (src.endsWith(':')) continue;
      const host = rest.split('/')[0].split(':')[0].toLowerCase();
      if (!host || host === '*') continue;
      const bare = host.startsWith('*.') ? host.slice(2) : host;
      if (host.startsWith('*.') && !bare.includes('.')) continue;
      if (bare.includes('*')) continue;
      if (!hosts.includes(host)) hosts.push(host);
    }
  }
  return hosts;
}

/** `*.example.com` matches subdomains only, never example.com itself, as a CSP host source does. */
const hostMatches = (host, allowed) =>
  allowed.startsWith('*.') ? host.endsWith(allowed.slice(1)) : host === allowed;

/**
 * What the app does with navigate { url } (AspectNavigationPolicy, the same on iOS and Android, in
 * every build). Returns { outcome, message }: outcome 'blocked' (always refused), 'route' or
 * 'feature' (opened in the app when it maps or is enabled), 'browser' (opens in the phone's browser),
 * or 'bankHostOnly' (opens only if the host is exactly the bank's own host, which the preview can't
 * know).
 */
export function checkNavigate(url, csp) {
  const target = String(url ?? '').trim();
  if (!target) return { outcome: 'blocked', message: 'the url is empty' };
  if (target.startsWith('/') && !target.startsWith('//')) {
    const screen = screenForPage(target);
    return screen === 'home' || screen === 'settings'
      ? {
          outcome: 'route',
          message: `opens the app's ${screen === 'home' ? 'Home' : 'My Settings'} screen`,
        }
      : {
          outcome: 'blocked',
          message: `${target} isn't a mobile screen the app can open (today: Home, My Accounts, My Settings), so the app ignores it`,
        };
  }
  if (/^feature:/i.test(target)) {
    const id = target.slice('feature:'.length).trim();
    return id
      ? {
          outcome: 'feature',
          message: `opens the app feature "${id}" if the app supports it and it is enabled for the customer; otherwise nothing happens`,
        }
      : { outcome: 'blocked', message: 'feature: has no feature id' };
  }
  let u;
  try {
    u = new URL(target);
  } catch {
    return { outcome: 'blocked', message: `"${target}" is not a valid URL` };
  }
  if (u.protocol !== 'https:')
    return { outcome: 'blocked', message: `"${target}" is not https` };
  const host = u.hostname.toLowerCase();
  if (navigableHosts(csp).some((h) => hostMatches(host, h)))
    return {
      outcome: 'browser',
      message: `${host} is in this aspect's CSP frame-src or connect-src, so the app opens it in the phone's browser`,
    };
  return {
    outcome: 'bankHostOnly',
    message: `the app opens this in the phone's browser only if ${host} is exactly your bank's online banking host. To link to another host, list it in the CSP frame-src or connect-src`,
  };
}

function stripComments(code) {
  return String(code ?? '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

const looksLikeJson = (t) =>
  (t.startsWith('{') && t.endsWith('}')) ||
  (t.startsWith('[') && t.endsWith(']'));

function parsesAsJson(text) {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

function finding(level, field, message) {
  return { level, field, message };
}

export function hasErrors(findings) {
  return findings.some((f) => f.level === 'error');
}
