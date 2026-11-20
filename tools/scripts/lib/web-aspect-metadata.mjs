/*
 * Builds web aspect submission metadata from a template schema (template.json).
 * Shared by create-web-aspect.mjs and submit. Shape matches the Developer Console PR body.
 */

const LOCAL_HOST = new RegExp(
  '\\b(?:https?|wss?)://(?:[^\\s/@]*@)?(?:localhost|0\\.0\\.0\\.0|127(?:\\.\\d{1,3}){3}|10(?:\\.\\d{1,3}){3}|' +
    '172\\.(?:1[6-9]|2\\d|3[01])(?:\\.\\d{1,3}){2}|192\\.168(?:\\.\\d{1,3}){2}|169\\.254(?:\\.\\d{1,3}){2}|' +
    '\\[::1\\]|[\\w.-]+\\.localhost|[\\w-]+(?:\\.[\\w-]+)*\\.local)(?=$|[\\s:/?#;])',
  'i'
);

export const PLACEHOLDER_HOST = 'cdn.example-fi.com';
export const STATIC_LOADER_KEY_PROPERTY = 'ASPECT_PROPERTY_WEB_STATICLOADERKEY';
const CSP_PROPERTY = 'ASPECT_PROPERTY_WEB_CONTENTSECURITYPOLICY';

const LABELS = {
  ASPECT_TYPE: 'Aspect Type',
  ASPECT_PROPERTY_WEB_CONTENTSECURITYPOLICY: 'CSP',
  ASPECT_PROPERTY_WEB_SANDBOXDIRECTIVES: 'Sandbox Directives',
  ASPECT_PROPERTY_WEB_PERMISSIONPOLICY: 'Permission Policy',
  ASPECT_PROPERTY_WEB_PLACEMENTID: 'Placement Id',
  ASPECT_PROPERTY_WEB_PLACEMENTSIZE: 'Placement Size',
  ASPECT_PROPERTY_WEB_DISPLAYAUTHORITY: 'Display Authority',
  ASPECT_PROPERTY_WEB_PAGE: 'Page',
  ASPECT_PROPERTY_WEB_FREQUENCY: 'Frequency',
  ASPECT_PROPERTY_WEB_TRIGGER: 'Trigger',
};

const PLACEHOLDER = new RegExp(PLACEHOLDER_HOST.replace(/\./g, '\\.'), 'i');

export function previewOnly(value) {
  const text = String(value ?? '');
  if (LOCAL_HOST.test(text)) return 'local';
  if (PLACEHOLDER.test(text)) return 'placeholder';
  return null;
}

/** Submit-time check: preview-only values are fine locally, not for FI submit. */
export function submitProblem(field, value) {
  const kind = previewOnly(value);
  if (kind === 'local') {
    return `${field.label} points at this machine or a private network (${value}); use your hosted https URL.`;
  }
  if (kind === 'placeholder') {
    return `${field.label} is still the ${PLACEHOLDER_HOST} placeholder (${value}). Enter your real https URL.`;
  }
  return null;
}

export function isPlaceholderUrl(url) {
  try {
    new URL(url);
  } catch {
    return false;
  }
  return previewOnly(url) === 'placeholder';
}

/** Why a loader URL cannot be submitted. Null when it looks like a public https URL. */
export function hostedLoaderUrlProblem(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return `"${url}" is not a valid URL. Pass a hosted https loader URL.`;
  }
  if (parsed.protocol !== 'https:') {
    return `"${url}" is not an https URL. Host the loader over https.`;
  }
  if (previewOnly(url) === 'placeholder') {
    return `The loader URL is still the ${PLACEHOLDER_HOST} placeholder.`;
  }
  if (previewOnly(url) === 'local') {
    return `The loader URL points at this machine or a private network (${url}).`;
  }
  return null;
}

export function prBody(metadata) {
  return `Metadata:\n${JSON.stringify(metadata)}`;
}

export function loaderEntry(metadata) {
  const props = metadata.properties ?? [];
  const urlProp = props.find((p) =>
    /^ASPECT_SCRIPT_(.+)_URL$/.test(p.propertyName)
  );
  if (!urlProp) return null;
  const key = /^ASPECT_SCRIPT_(.+)_URL$/.exec(urlProp.propertyName)[1];
  const sriProp = props.find(
    (p) => p.propertyName === `ASPECT_SCRIPT_${key}_SRI`
  );
  return { key, url: urlProp.propertyValue, sri: sriProp?.propertyValue ?? '' };
}

export function withProperty(metadata, name, value) {
  const copy = structuredClone(metadata);
  const existing = copy.properties.find((p) => p.propertyName === name);
  if (existing) existing.propertyValue = String(value);
  else copy.properties.push(consoleProperty(name, value));
  return copy;
}

export function answersFromMetadata(template, metadata) {
  const props = Object.fromEntries(
    (metadata.properties ?? []).map((p) => [p.propertyName, p.propertyValue])
  );
  const data = {};
  for (const [name, value] of Object.entries(props)) {
    const m = /^ASPECT_SCRIPT_.+?_DATA_(.+)$/.exec(name);
    if (m) {
      data[m[1]] = value;
      data[m[1].toLowerCase()] = value;
    }
  }
  const answers = {};
  for (const f of template.fields) {
    if (isLoaderField(f)) {
      answers[f.key] = loaderEntry(metadata)?.url ?? '';
      continue;
    }
    const dataKey = dataKeyFor(f);
    answers[f.key] = isDataField(f)
      ? data[dataKey] ?? data[dataKey.toLowerCase()] ?? ''
      : props[f.property] ?? '';
  }
  return answers;
}

export function withDataAttributes(template, metadata, answers) {
  const entry = loaderEntry(metadata);
  if (!entry) return metadata;
  const copy = structuredClone(metadata);
  const prefix = `ASPECT_SCRIPT_${entry.key}_DATA_`;
  copy.properties = copy.properties.filter(
    (p) => !p.propertyName.startsWith(prefix)
  );
  const at = copy.properties.findIndex(
    (p) => p.propertyName === `ASPECT_SCRIPT_${entry.key}_SRI`
  );
  copy.properties.splice(
    at + 1,
    0,
    ...dataProperties(template, entry.key, answers)
  );
  return copy;
}

const parseCspDirectives = (csp) =>
  Object.fromEntries(
    csp
      .split(';')
      .map((d) => d.trim().split(/\s+/))
      .filter((d) => d[0])
      .map(([d, ...s]) => [d, s])
  );

/**
 * Adds every origin the template values need to the CSP, keeping manual additions. `previous` are
 * the values the CSP was built from: an origin only those values needed (a URL that has since
 * changed) is removed.
 */
export function ensureCspOrigins(metadata, template, values, previous) {
  const csp =
    metadata.properties.find((p) => p.propertyName === CSP_PROPERTY)
      ?.propertyValue ?? '';
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
    for (const s of sources) {
      if (!current[d].includes(s)) current[d].push(s);
    }
  }
  for (const d of Object.keys(current)) {
    current[d] = current[d].filter((s) => !previewOnly(s));
  }
  const value = Object.entries(current)
    .map(([d, s]) => `${d} ${s.join(' ')}`)
    .join('; ');
  return withProperty(metadata, CSP_PROPERTY, value);
}

function labelFor(name) {
  if (LABELS[name]) return LABELS[name];
  if (/_URL$/.test(name)) return 'Loader Script URL';
  if (/_SRI$/.test(name)) return 'Loader Script SRI';
  const attr = /_(?:DATA|HTML)_(.+)$/.exec(name);
  return attr ? attr[1] : name;
}

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

export function validateName(name) {
  if (!/^[a-z][a-z0-9-]{1,49}$/.test(name ?? '')) {
    return 'Use 2-50 lowercase letters, digits or dashes, starting with a letter (for example my-bank-chat).';
  }
  if (/--|-$/.test(name)) return 'Avoid double or trailing dashes.';
  return null;
}

export function scriptKeyFor(name) {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function validateField(field, value) {
  const v = value == null ? '' : String(value);
  if (!v) return field.required ? `${field.label} is required.` : null;
  if (field.maxLength && v.length > field.maxLength)
    return `${field.label} must be ${field.maxLength} characters or fewer.`;
  if (field.type === 'choice' && !field.options.includes(v))
    return `${field.label} must be one of ${field.options.join(', ')}.`;
  if (field.pattern) {
    try {
      if (!new RegExp(field.pattern).test(v))
        return `${field.label} has an invalid format.`;
    } catch {
      return `${field.label} template pattern is invalid.`;
    }
  }
  if (field.type === 'url') {
    let u;
    try {
      u = new URL(v);
    } catch {
      return `${field.label} must be a full URL starting with https://.`;
    }
    const local =
      field.allowLocalHttp &&
      u.protocol === 'http:' &&
      previewOnly(v) === 'local';
    if (u.protocol !== 'https:' && !local)
      return `${field.label} must use https.`;
    if (field.key === 'uiorigin' || field.property === 'uiorigin') {
      if (u.origin !== v.replace(/\/$/, '')) {
        return `${field.label} must be a bare origin (scheme + host), not a page URL.`;
      }
    }
  }
  return null;
}

export function originOf(url) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

const isDataField = (f) => f.target === 'data' || f.target === 'widget';
/** The static loader URL field. Its value is ASPECT_SCRIPT_<key>_URL, not a property of its own. */
export const isLoaderField = (f) => f.target === 'script';

/**
 * Create-time check. The loader is hosted after create, so an empty loader URL is allowed
 * here (metadata keeps the placeholder); submit requires the hosted URL.
 */
export function createFieldError(field, value) {
  if (isLoaderField(field) && (value == null || value === '')) return null;
  return validateField(field, value);
}

/**
 * Paired fields (`requires`, such as the OIDC client id and redirect URL) must be set together.
 * Returns the first field that is set while its partner is empty, or null.
 */
export function missingPartner(template, values) {
  for (const field of template.fields) {
    const partner = template.fields.find((x) => x.key === field.requires);
    if (partner && values[field.key] && !values[partner.key])
      return {
        field,
        partner,
        message: `${partner.label} is needed when ${field.label} is set.`,
      };
  }
  return null;
}

export function pairProblem(template, values) {
  return missingPartner(template, values)?.message ?? null;
}

/** A value as people read it: the option label for choices, "not set" for empty values. */
export function shownValue(field, value) {
  if (value === '' || value == null) return 'not set';
  if (field.type === 'choice') return field.optionLabels?.[value] ?? value;
  return String(value);
}

/**
 * What the developer still has to do before submitting (the pages and loader they host), and
 * what is recommended (production hints for empty values).
 */
export function nextSteps(template, values) {
  const needed = [];
  const recommended = [];
  let loaderUrl = '';
  for (const f of template.fields) {
    const v = values[f.key];
    if (isLoaderField(f)) {
      loaderUrl = v || '';
      continue;
    }
    const kind = previewOnly(v);
    if (kind === 'local')
      needed.push(
        `Set "${f.label}" to your hosted https URL (it points at this machine now).`
      );
    else if (kind === 'placeholder')
      needed.push(
        `Set "${f.label}" (it is still the ${PLACEHOLDER_HOST} placeholder).`
      );
    else if (!v && f.required)
      needed.push(`Set "${f.label}" (it is required).`);
    else if (!v && f.productionHint)
      recommended.push(`${f.label}: ${f.productionHint}`);
  }
  if (template.uiFile)
    needed.push(
      `Host your copy of ${template.uiFile} at the UI page URL, and fill in its ALLOWED_PARENT_ORIGINS.`
    );
  const loaderFile = template.loaderFile ?? 'static-loader.js';
  needed.push(
    loaderUrl
      ? `Upload ${loaderFile} to ${loaderUrl} (served with Access-Control-Allow-Origin). Submit takes the SRI from it.`
      : `Host ${loaderFile} at an https URL that sends Access-Control-Allow-Origin. Submit asks for it and takes the SRI from it.`
  );
  return { needed, recommended };
}
export const dataKeyFor = (f) => f.dataKey ?? f.key;

export function buildCsp(template, values) {
  const directives = Object.fromEntries(
    Object.entries(template.csp ?? {}).map(([d, s]) => [d, [...s]])
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

export function defaultAnswers(template) {
  return Object.fromEntries(
    template.fields.map((f) => [f.key, f.default ?? ''])
  );
}

export function dataProperties(template, key, values) {
  return template.fields
    .filter(
      (f) => isDataField(f) && values[f.key] !== '' && values[f.key] != null
    )
    .map((f) =>
      consoleProperty(
        `ASPECT_SCRIPT_${key}_DATA_${dataKeyFor(f)}`,
        values[f.key]
      )
    );
}

export function buildMetadata({
  template,
  name,
  description,
  sector = 'RETAIL',
  answers = {},
  loaderUrl,
  sri = '',
}) {
  const key = template.scriptKey || scriptKeyFor(name);
  const values = { ...defaultAnswers(template), ...answers };
  const props = {};
  for (const f of template.fields) {
    if (isDataField(f) || isLoaderField(f)) continue;
    if (values[f.key] !== '' && values[f.key] != null)
      props[f.property] = values[f.key];
  }
  const loaderField = template.fields.find(isLoaderField);
  const url =
    loaderUrl ||
    (loaderField && values[loaderField.key]) ||
    `https://${PLACEHOLDER_HOST}/aspects/${name}.v1.js`;
  const properties = [
    consoleProperty('ASPECT_TYPE', template.type),
    consoleProperty(`ASPECT_SCRIPT_${key}_URL`, url),
    consoleProperty(`ASPECT_SCRIPT_${key}_SRI`, sri),
    ...dataProperties(template, key, values),
    consoleProperty(CSP_PROPERTY, buildCsp(template, values)),
    ...Object.entries(template.fixed ?? {}).map(([n, v]) =>
      consoleProperty(n, v)
    ),
    ...Object.entries(props).map(([n, v]) => consoleProperty(n, v)),
  ];
  return {
    name,
    widgetType: 'ASPECT',
    widgetDescription: description || name,
    isEnabledWeb: true,
    isEnabledMobile: false,
    sector,
    properties,
  };
}
