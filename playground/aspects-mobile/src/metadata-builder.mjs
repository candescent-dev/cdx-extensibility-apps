/*
 * Builds and edits mobile V2 aspect submission metadata from a template schema (template.json).
 *
 * The output has the same shape the Developer Console writes into the FI repo pull request body
 * ("Metadata:\n{...}"), which the backend parses. Pure functions: shared by create-aspect,
 * submit-to-fi-repo, the preview and the tests.
 */

import { checkNavigate } from './conformance.mjs';

// URLs that only work in this preview: addresses on this machine or a private network (loopback,
// 0.0.0.0, 10/8, 172.16/12, 192.168/16, 169.254/16, the Android emulator's 10.0.2.2, *.localhost,
// *.local) and the example-fi.com placeholder. Only URLs count (a scheme before the host), so text that
// merely mentions localhost or example-fi.com is left alone. Hosts are read with the URL parser, not
// matched with a pattern.
const URL_IN_TEXT = /\b(?:https?|wss?):\/\/[^\s'"<>()]+/gi;

function isLocalHost(host) {
  const h = host.toLowerCase().replace(/\.$/, '');
  if (['localhost', '0.0.0.0', '[::1]'].includes(h)) return true;
  if (h.endsWith('.localhost') || h.endsWith('.local')) return true;
  const ip = /^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/.exec(h);
  if (!ip) return false;
  const [a, b] = [Number(ip[1]), Number(ip[2])];
  return (
    a === 127 ||
    a === 10 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254)
  );
}

/** Why a value can't be submitted ('local' or 'placeholder'), or null when it can. */
export function previewOnly(value) {
  for (const [url] of String(value ?? '').matchAll(URL_IN_TEXT)) {
    let host;
    try {
      host = new URL(url).hostname;
    } catch {
      continue;
    }
    if (isLocalHost(host)) return 'local';
    const h = host.toLowerCase().replace(/\.$/, '');
    if (h === 'example-fi.com' || h.endsWith('.example-fi.com'))
      return 'placeholder';
  }
  return null;
}

/** Submit-time check on one template value: a preview-only value is fine to preview, never to submit. */
export function submitProblem(field, value) {
  const kind = previewOnly(value);
  if (kind === 'local')
    return `${field.label} points at this machine or a private network (${value}); a device can't reach it. Enter your hosted https URL.`;
  if (kind === 'placeholder')
    return `${field.label} is still the example-fi.com placeholder (${value}). Enter your real https URL.`;
  return null;
}

/** Hosted-URL placeholder used until the developer hosts the loader. */
export const PLACEHOLDER_HOST = 'cdn.example-fi.com';

// Property labels as the Developer Console writes them.
const LABELS = {
  ASPECT_TYPE: 'Aspect Type',
  ASPECT_PROPERTY_MOBILE_CONTENTSECURITYPOLICY: 'CSP',
  ASPECT_PROPERTY_MOBILE_SANDBOXDIRECTIVES: 'Sandbox Directives',
  ASPECT_PROPERTY_MOBILE_PLACEMENTID: 'Placement Id',
  ASPECT_PROPERTY_MOBILE_PLACEMENTSIZE: 'Placement Size',
  ASPECT_PROPERTY_MOBILE_DISPLAYAUTHORITY: 'Display Authority',
  ASPECT_PROPERTY_MOBILE_PAGE: 'Page',
  ASPECT_PROPERTY_MOBILE_MOUNTSTRATEGY: 'Mount Strategy',
  ASPECT_PROPERTY_MOBILE_FREQUENCY: 'Frequency',
  ASPECT_PROPERTY_MOBILE_TRIGGER: 'Trigger',
  // Aspect properties the sample aspect extensions read (dbk.getAspectConfig().properties).
  ASPECT_PROPERTY_MOBILE_OIDCCLIENTID: 'oidcClientId',
  ASPECT_PROPERTY_MOBILE_REDIRECTURL: 'redirectUrl',
  ASPECT_PROPERTY_MOBILE_TOKENTIMEOUTMS: 'tokenTimeoutMs',
  ASPECT_PROPERTY_MOBILE_REDIRECTTIMEOUTMS: 'redirectTimeoutMs',
  ASPECT_PROPERTY_MOBILE_REFRESHINTERVALMS: 'refreshIntervalMs',
  ASPECT_PROPERTY_MOBILE_CONFIGTIMEOUTMS: 'configTimeoutMs',
};

function labelFor(name) {
  if (LABELS[name]) return LABELS[name];
  if (/_URL$/.test(name)) return 'Loader Script URL';
  if (/_SRI$/.test(name)) return 'Loader Script SRI';
  const attr = /_(?:DATA|HTML)_(.+)$/.exec(name);
  return attr ? attr[1] : name;
}

/** One property in the console's shape. */
export function consoleProperty(name, value) {
  return {
    propertyName: name,
    propertyType: 'TEXT',
    propertyLabel: labelFor(name),
    propertyValue: String(value ?? ''),
    propertyValueLocale: '',
    isRichText: false,
    isLocalized: false,
    isLocked: false,
  };
}

/** Component name rules: lowercase letters, digits and dashes, starting with a letter, 50 chars max. */
export function validateName(name) {
  if (!/^[a-z][a-z0-9-]{1,49}$/.test(name ?? '')) {
    return 'Use 2-50 lowercase letters, digits or dashes, starting with a letter (for example my-bank-chat).';
  }
  if (/--|-$/.test(name)) return 'Avoid double or trailing dashes.';
  return null;
}

/** Script Name derived from the component name: lowercase letters and digits only. */
/** The aspect extension's file name in an aspect folder. Committed to the FI repo as <name>.js. */
export const EXTENSION_FILE = 'aspect-extension.js';

export function scriptKeyFor(name) {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** Validates one template field value. Returns an error string or null. */
export function validateField(field, value) {
  const v = value == null ? '' : String(value);
  if (!v) return field.required ? `${field.label} is required.` : null;
  if (field.maxLength && v.length > field.maxLength)
    return `${field.label} must be ${field.maxLength} characters or fewer.`;
  if (field.type === 'choice' && !field.options.includes(v))
    return `${field.label} must be one of ${field.options.join(', ')}.`;
  if (field.pattern && !new RegExp(field.pattern).test(v))
    return `${field.label} has an invalid format.`;
  if (field.type === 'color' && !/^#[0-9a-f]{6}$/i.test(v))
    return `${field.label} must be a hex colour like #1a73e8.`;
  if (field.type === 'url') {
    let u;
    try {
      u = new URL(v);
    } catch {
      return `${field.label} must be a full URL starting with https://.`;
    }
    // allowLocalHttp: the template's own preview default (a page this preview serves locally).
    const local =
      field.allowLocalHttp &&
      u.protocol === 'http:' &&
      previewOnly(v) === 'local';
    if (u.protocol !== 'https:' && !local)
      return `${field.label} must use https.`;
  }
  return null;
}

/** The origin of an http(s) URL, or null (in-app routes, feature:<id>, the example-fi.com placeholder). */
function originOf(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return previewOnly(url) === 'placeholder' ? null : u.origin;
  } catch {
    return null;
  }
}

/** The UI page URL field: framed by the loader, so in frame-src (link fields are there too, marked `navigates`). */
export const isUiField = (f) => f.csp === 'frame-src' && !f.navigates;

/** Fields whose values go into Data Attributes (`widget` is the legacy name for the same thing). */
const isDataField = (f) => f.target === 'data' || f.target === 'widget';

/** Data Attribute name for a field: lowercase, so key normalisation on the way to the app cannot break it. */
export const dataKeyFor = (f) => (f.dataKey ?? f.key).toLowerCase();

/**
 * Template CSP plus the origins of fields that need it: the UI page and link hosts in frame-src (the app
 * opens a link in the phone's browser only if its host is in frame-src or connect-src), the chat backend
 * and sign-in redirect in connect-src.
 */
export function buildCsp(template, values) {
  const directives = Object.fromEntries(
    Object.entries(template.csp).map(([d, s]) => [d, [...s]]),
  );
  for (const f of template.fields) {
    if (!f.csp) continue;
    const origin = originOf(values[f.key]);
    if (!origin) continue;
    directives[f.csp] = directives[f.csp] ?? [];
    if (!directives[f.csp].includes(origin)) directives[f.csp].push(origin);
  }
  return Object.entries(directives)
    .map(([d, s]) => `${d} ${s.join(' ')}`)
    .join('; ');
}

/** Default answers from the template. */
export function defaultAnswers(template) {
  return Object.fromEntries(
    template.fields.map((f) => [f.key, f.default ?? '']),
  );
}

/**
 * Builds submission metadata.
 * input = { template, name, description, sector, answers, loaderUrl?, sri? }
 */
export function buildMetadata({
  template,
  name,
  description,
  sector = 'RETAIL',
  answers = {},
  loaderUrl,
  sri = '',
}) {
  const key = scriptKeyFor(name);
  const values = { ...defaultAnswers(template), ...answers };
  const props = {};
  // Optional properties left empty are left out.
  for (const f of template.fields) {
    if (!isDataField(f) && values[f.key] !== '' && values[f.key] != null)
      props[f.property] = values[f.key];
  }
  const url =
    loaderUrl ||
    `https://${PLACEHOLDER_HOST}/aspects/${name}/static-loader.v1.js`;
  const properties = [
    consoleProperty('ASPECT_TYPE', template.type),
    consoleProperty(`ASPECT_SCRIPT_${key}_URL`, url),
    consoleProperty(`ASPECT_SCRIPT_${key}_SRI`, sri),
    ...dataProperties(template, key, values),
    consoleProperty(
      'ASPECT_PROPERTY_MOBILE_CONTENTSECURITYPOLICY',
      buildCsp(template, values),
    ),
    ...Object.entries(template.fixed).map(([n, v]) => consoleProperty(n, v)),
    ...Object.entries(props).map(([n, v]) => consoleProperty(n, v)),
  ];
  return {
    name,
    widgetType: 'ASPECT',
    widgetDescription: description || name,
    isEnabledWeb: false,
    isEnabledMobile: true,
    sector,
    properties,
  };
}

/** One plain-text Data Attribute per non-empty data field: ASPECT_SCRIPT_<key>_DATA_<dataKey>. */
export function dataProperties(template, key, values) {
  return template.fields
    .filter(
      (f) => isDataField(f) && values[f.key] !== '' && values[f.key] != null,
    )
    .map((f) =>
      consoleProperty(
        `ASPECT_SCRIPT_${key}_DATA_${dataKeyFor(f)}`,
        values[f.key],
      ),
    );
}

/**
 * Reads the current answers back out of metadata (so submit can re-prompt only what is missing).
 * Flat Data Attributes win; a legacy `widget` JSON attribute is read as a fallback.
 */
export function answersFromMetadata(template, metadata) {
  const props = Object.fromEntries(
    (metadata.properties ?? []).map((p) => [p.propertyName, p.propertyValue]),
  );
  const data = {};
  for (const [name, value] of Object.entries(props)) {
    const m = /^ASPECT_SCRIPT_.+?_DATA_(.+)$/.exec(name);
    if (m) data[m[1].toLowerCase()] = value;
  }
  let legacy = {};
  try {
    legacy = data.widget ? JSON.parse(data.widget) : {};
  } catch {
    legacy = {};
  }
  const answers = {};
  for (const f of template.fields) {
    answers[f.key] = isDataField(f)
      ? (data[dataKeyFor(f)] ?? legacy[f.key] ?? '')
      : (props[f.property] ?? '');
  }
  return answers;
}

/**
 * Returns metadata with its Data Attributes rewritten from `answers`: one plain attribute per field,
 * and the legacy `widget` JSON attribute removed. Other properties are kept as they are.
 */
export function withDataAttributes(template, metadata, answers) {
  const entry = loaderEntry(metadata);
  if (!entry) return metadata;
  const copy = structuredClone(metadata);
  const prefix = `ASPECT_SCRIPT_${entry.key}_DATA_`;
  copy.properties = copy.properties.filter(
    (p) => !p.propertyName.startsWith(prefix),
  );
  const at = copy.properties.findIndex(
    (p) => p.propertyName === `ASPECT_SCRIPT_${entry.key}_SRI`,
  );
  copy.properties.splice(
    at + 1,
    0,
    ...dataProperties(template, entry.key, answers),
  );
  return copy;
}

/** The single loader script entry (key, url, sri) of a template-built submission. */
export function loaderEntry(metadata) {
  const props = metadata.properties ?? [];
  const urlProp = props.find((p) =>
    /^ASPECT_SCRIPT_(.+)_URL$/.test(p.propertyName),
  );
  if (!urlProp) return null;
  const key = /^ASPECT_SCRIPT_(.+)_URL$/.exec(urlProp.propertyName)[1];
  const sriProp = props.find(
    (p) => p.propertyName === `ASPECT_SCRIPT_${key}_SRI`,
  );
  return { key, url: urlProp.propertyValue, sri: sriProp?.propertyValue ?? '' };
}

export function isPlaceholderUrl(url) {
  try {
    new URL(url);
  } catch {
    return true;
  }
  return previewOnly(url) === 'placeholder';
}

/** Returns a copy of metadata without the named property. */
export function withoutProperty(metadata, name) {
  const copy = structuredClone(metadata);
  copy.properties = copy.properties.filter((p) => p.propertyName !== name);
  return copy;
}

/** Returns a copy of metadata with one property set (added in console shape if missing). */
export function withProperty(metadata, name, value) {
  const copy = structuredClone(metadata);
  const existing = copy.properties.find((p) => p.propertyName === name);
  if (existing) existing.propertyValue = String(value);
  else copy.properties.push(consoleProperty(name, value));
  return copy;
}

/** Validates every template field. Returns { fieldKey: error } for the fields that fail. */
export function validateAnswers(template, answers) {
  const errors = {};
  for (const f of template.fields) {
    const err = validateField(f, answers[f.key]);
    if (err) errors[f.key] = err;
  }
  return errors;
}

/**
 * Returns metadata with every template field set from `answers`: Data Attributes, the console
 * properties the template maps (size, frequency, page...) and the CSP (fields such as apiUrl add
 * their origin). The loader URL and SRI are kept, so the hosted loader stays valid.
 */
export function withAnswers(template, metadata, answers) {
  const values = { ...defaultAnswers(template), ...answers };
  let copy = withDataAttributes(template, metadata, values);
  for (const f of template.fields) {
    if (isDataField(f)) continue;
    copy =
      values[f.key] === '' || values[f.key] == null
        ? withoutProperty(copy, f.property)
        : withProperty(copy, f.property, values[f.key]);
  }
  return withProperty(
    copy,
    'ASPECT_PROPERTY_MOBILE_CONTENTSECURITYPOLICY',
    buildCsp(template, values),
  );
}

/** Template-level checks on the widget config: required fields, formats, production hints. */
export function checkTemplateConfig(template, metadata, uiSource) {
  const answers = answersFromMetadata(template, metadata);
  const out = [];
  if (uiSource) out.push(...checkUiAllowlists(template, answers, uiSource));
  for (const f of template.fields) {
    const err = validateField(f, answers[f.key]);
    const partner = template.fields.find((x) => x.key === f.requires);
    if (err)
      out.push({ level: 'error', field: `Template · ${f.key}`, message: err });
    else if (answers[f.key] && partner && !answers[partner.key])
      out.push({
        level: 'error',
        field: `Template · ${f.key}`,
        message: `${f.key} is set but ${partner.key} is empty; the identity handoff needs both, so it stays off.`,
      });
    else if (
      f.productionHint &&
      (!answers[f.key] || /example-fi\.com/.test(answers[f.key]))
    ) {
      out.push({
        level: 'warn',
        field: `Template · ${f.key}`,
        message: f.productionHint,
      });
    }
  }
  out.push(...checkLinkFields(template, metadata, answers));
  return out;
}

/**
 * Link fields (`"navigates": true`, such as a modal's button link) go to the app as navigate {url}.
 * buildCsp adds their hosts to frame-src, so this only fires for a CSP written another way (a console
 * submission, an aspect created before link hosts were added, a hand edit): an https host that isn't
 * in frame-src or connect-src opens only if it is exactly the bank's online banking host.
 */
export function checkLinkFields(
  template,
  metadata,
  answers = answersFromMetadata(template, metadata),
) {
  const csp =
    (metadata.properties ?? []).find(
      (p) => p.propertyName === 'ASPECT_PROPERTY_MOBILE_CONTENTSECURITYPOLICY',
    )?.propertyValue ?? '';
  const out = [];
  for (const f of template.fields) {
    const value = String(answers[f.key] ?? '').trim();
    if (!f.navigates || !value || /example-fi\.com/.test(value)) continue;
    if (validateField(f, value)) continue;
    const { outcome, message } = checkNavigate(value, csp);
    if (outcome === 'bankHostOnly') {
      const host = new URL(value).hostname;
      out.push({
        level: 'warn',
        field: `Template · ${f.key}`,
        message: `${f.label} (${value}): ${host} isn't in the aspect's CSP frame-src or connect-src, so the app opens it only if it is exactly your bank's online banking host; otherwise a tap does nothing. Add https://${host} to the CSP frame-src (aspects created with these tools add it for you).`,
      });
    } else if (outcome === 'blocked') {
      out.push({
        level: 'warn',
        field: `Template · ${f.key}`,
        message: `${f.label} (${value}): ${message}.`,
      });
    }
  }
  return out;
}

/** The origin of an http(s) URL, or null. */
function webOrigin(url) {
  try {
    const u = new URL(String(url));
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.origin : null;
  } catch {
    return null;
  }
}

/** A UI page's `var <name> = [...]` list (match with .index), found without building a pattern from `name`. */
function findAllowlist(source, name) {
  for (const m of source.matchAll(
    /var\s+([A-Z_][A-Z0-9_]*)\s*=\s*\[([^\]]*)\]/g,
  ))
    if (m[1] === name) return m;
  return null;
}

/** The origins in a UI page's `var <name> = [...]` list, or null when the page has no such list. */
export function readUiAllowlist(source, name) {
  const m = findAllowlist(source, name);
  return m ? [...m[2].matchAll(/['"]([^'"]+)['"]/g)].map((x) => x[1]) : null;
}

/**
 * Adds the origin of each field value marked `uiAllowlist` to that list in the UI page, so the page
 * accepts the URL the loader passes it (for example apiUrl into ALLOWED_API_ORIGINS).
 */
export function fillUiAllowlists(template, answers, source) {
  let out = source;
  for (const f of template.fields) {
    const origin = f.uiAllowlist && webOrigin(answers[f.key]);
    const list = origin && readUiAllowlist(out, f.uiAllowlist);
    if (!list || list.includes(origin)) continue;
    const m = findAllowlist(out, f.uiAllowlist);
    const list2 = [...list, origin].map((o) => `'${o}'`).join(', ');
    out =
      out.slice(0, m.index) +
      m[0].slice(0, m[0].indexOf('[')) +
      `[${list2}]` +
      out.slice(m.index + m[0].length);
  }
  return out;
}

/** Warns when a value the UI page checks against one of its lists isn't on that list. */
export function checkUiAllowlists(template, answers, source) {
  const ui = template.fields.find(isUiField);
  const uiOrigin = ui && webOrigin(answers[ui.key]);
  const out = [];
  for (const f of template.fields) {
    const origin = f.uiAllowlist && webOrigin(answers[f.key]);
    const list = origin && readUiAllowlist(source, f.uiAllowlist);
    if (!list) continue;
    if (list.length ? list.includes(origin) : origin === uiOrigin) continue;
    out.push({
      level: 'warn',
      field: `Template · ${f.key}`,
      message: `${template.uiFile} ignores ${f.key} because ${origin} is not in its ${f.uiAllowlist} list. Add '${origin}' to ${f.uiAllowlist} in your copy of ${template.uiFile}.`,
    });
  }
  return out;
}

/** The pull request body the backend parses. Nothing may follow the JSON. */
export function prBody(metadata) {
  return `Metadata:\n${JSON.stringify(metadata)}`;
}
