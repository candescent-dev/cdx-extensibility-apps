/*
 * Preview page controller: picks a submission, runs the conformance check, starts the runtime and
 * plays the native host (placement, scrim, navigate allowlist, host -> aspect context).
 */
import {
  normalizeSubmission,
  checkSubmission,
  checkMessage,
  checkNavigate,
  hasErrors,
} from './conformance.mjs';
import { startAspect, probeScript } from './runtime.mjs';
import {
  aspectLabel,
  formValues,
  formValuesText,
  fiRepoPath,
  screenForPage,
} from './form-values.mjs';
import {
  answersFromMetadata,
  checkTemplateConfig,
  isPlaceholderUrl,
  validateAnswers,
  validateName,
  withAnswers,
} from './metadata-builder.mjs';

const $ = (id) => document.getElementById(id);
const STATUS_BAR = 44;
const NAV_BAR = 86;
// DevX/QA runtime experiments live behind ?advanced=1 so the customer page stays simple.
const ADVANCED = new URLSearchParams(location.search).has('advanced');
const option = (id, fallback) => (ADVANCED ? $(id).checked : fallback);

let rules;
let config;
let current; // { id, metadata, base, bootstrapUrl, localLoaders, editable, dirty }
let run = 0;
// Hosted loader URLs typed on this page, per aspect. Remembered in this browser only.
const hostedUrls = (() => {
  try {
    return JSON.parse(localStorage.getItem('aspectPreview.hostedUrls') || '{}');
  } catch {
    return {};
  }
})();
function rememberHostedUrl(id, url) {
  hostedUrls[id] = url;
  try {
    localStorage.setItem(
      'aspectPreview.hostedUrls',
      JSON.stringify(hostedUrls),
    );
  } catch {
    /* storage unavailable: keep it for this page only */
  }
}
let state = {};

function log(level, message) {
  const line = document.createElement('div');
  line.className = level;
  line.textContent = `${new Date().toISOString().slice(11, 19)}  ${message}`;
  $('log').appendChild(line);
  $('log').scrollTop = $('log').scrollHeight;
}

function renderFindings(findings) {
  const list = $('findings');
  list.textContent = '';
  const count = (l) => findings.filter((f) => f.level === l).length;
  $('summary').textContent = findings.length
    ? `${count('error')} error(s), ${count('warn')} warning(s)`
    : 'no problems found';
  $('summary').className = `badge ${count('error') ? 'danger' : 'success'}`;
  for (const level of ['error', 'warn', 'info']) {
    for (const f of findings.filter((x) => x.level === level)) {
      const li = document.createElement('li');
      li.className = level;
      const field = document.createElement('span');
      field.className = 'field';
      field.textContent = `${level.toUpperCase()} · ${f.field}`;
      li.append(field, document.createTextNode(f.message));
      list.appendChild(li);
    }
  }
}

function copyButton(text, label = 'Copy') {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'copy';
  b.textContent = label;
  b.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(text);
      b.textContent = 'Copied';
    } catch {
      b.textContent = 'Copy failed';
    }
    setTimeout(() => (b.textContent = label), 1500);
  });
  return b;
}

/** One step: text, optional code block and optional copy button. */
function step(text, { code, copy } = {}) {
  const li = document.createElement('li');
  li.append(text);
  if (code) {
    const block = document.createElement('code');
    block.className = 'block';
    block.textContent = code;
    li.appendChild(block);
  }
  if (copy) {
    const actions = document.createElement('div');
    actions.className = 'stepactions';
    actions.appendChild(copyButton(copy.text, copy.label));
    li.appendChild(actions);
  }
  return li;
}

/**
 * Submission steps for the way the preview was launched. Only a Forge CLI launch mentions forge
 * commands; everyone else gets the Developer Console route, which needs no tools.
 */
/**
 * The "host your loader" step: where to upload it, a URL field, and what the check found. The
 * preview itself always runs your local files; this only checks the copy a device would download.
 */
function hostStep(sub, hostedCheck) {
  const li = step(
    'Upload your loader to a versioned https URL (with CORS), then check it:',
  );
  const row = document.createElement('div');
  row.className = 'host-row';
  const input = document.createElement('input');
  input.type = 'url';
  input.id = 'hostedUrl';
  input.spellcheck = false;
  input.setAttribute('aria-label', 'Hosted loader URL');
  const first = Object.values(sub.scripts)[0];
  input.value =
    hostedUrls[current.id] ??
    (first && !isPlaceholderUrl(first.url) ? first.url : '');
  input.placeholder = `https://your-host/${(first?.url ?? 'loader.v1.js')
    .split('/')
    .pop()}`;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn secondary';
  button.textContent = 'Check';
  const check = () => {
    const url = input.value.trim();
    try {
      if (new URL(url).protocol !== 'https:') throw new Error();
    } catch {
      showHostResult(result, {
        state: 'bad',
        message: 'Enter a full https:// URL.',
      });
      return;
    }
    rememberHostedUrl(current.id, url);
    load();
  };
  button.addEventListener('click', check);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') check();
  });
  row.append(input, button);
  const result = document.createElement('p');
  result.className = 'host-result';
  showHostResult(result, hostedCheck);
  li.append(row, result);
  return li;
}

function showHostResult(el, check) {
  el.className = `host-result ${check?.state ?? ''}`;
  el.textContent = check?.message ?? '';
}

function renderSteps(sub, name, target, bootstrapText, hostedCheck) {
  const ol = $('steps');
  ol.textContent = '';
  const host = hostStep(sub, hostedCheck);
  if (config.launcher === 'forge') {
    ol.append(
      host,
      step('Check it from the terminal:', {
        code: `forge aspect validate ${target} --fetch`,
      }),
      step('Submit it:', {
        code: `forge aspect submit --platform mobile --aspect ${target}`,
      }),
    );
    return;
  }
  const isSample = String(current.path).startsWith('samples/');
  const project = isSample ? '<your-aspect-name>' : name;
  if (isSample) {
    ol.append(
      step(
        'Make your own copy: press "Create my aspect" under Customize, or run:',
        { code: `pnpm run create-aspect:mobile -- --template ${sub.type}` },
      ),
    );
  }
  const uiFile = current.template?.uiFile;
  if (uiFile) {
    ol.append(
      step(
        `Host your copy of ${uiFile} on your https domain and set "Your UI page URL" under Customize.`,
      ),
    );
  }
  ol.append(
    host,
    step(
      'Raise the pull request in your FI repo (needs the GitHub CLI, gh, signed in):',
      {
        code: `pnpm run submit-to-fi -- --project ${project}${
          hostedUrls[current.id] && !isSample
            ? ` --loader-url ${hostedUrls[current.id]}`
            : ''
        }`,
      },
    ),
    step(
      'Or use the Developer Console: Manage Submissions → Aspects → Mobile → Upload code snippet. Paste the aspect extension and the form values below.',
      {
        copy: bootstrapText
          ? { text: bootstrapText, label: `Copy ${name}.js` }
          : undefined,
      },
    ),
  );
}

/** Fills the "Next steps" panel: where it came from, whether it is ready, how to submit it. */
function renderUse(sub, findings, { hostedSri, bootstrapText, hostedCheck }) {
  const name = current.metadata.name || current.id;
  $('sourcePath').textContent = current.path;
  renderSteps(sub, name, current.path, bootstrapText, hostedCheck);

  const errors = findings.filter((f) => f.level === 'error').length;
  const rows = formValues(sub, current.metadata, { hostedSri });
  const blocked = rows.filter((r) => r.blocked).length;
  const status = $('status');
  if (errors) {
    status.className = 'notready';
    status.textContent = `Fix ${errors} error(s) first (see Checks).`;
  } else if (blocked && hostedCheck.state === 'ok') {
    status.className = 'notready';
    status.textContent = `Your loader is hosted, but ${blocked} value(s) still point at this machine or a placeholder. Replace them with your https URLs.`;
  } else if (hostedCheck.state === 'ok') {
    status.className = 'ready';
    status.textContent = 'Ready to submit.';
  } else if (hostedCheck.state === 'none') {
    status.className = '';
    status.textContent =
      'No errors. Next, host your loader and check it below.';
  } else {
    status.className = 'notready';
    status.textContent = `Hosted loader: ${hostedCheck.message}`;
  }

  const body = $('formRows');
  body.textContent = '';
  for (const r of rows) {
    const tr = document.createElement('tr');
    const th = document.createElement('th');
    th.scope = 'row';
    th.textContent = r.label;
    const td = document.createElement('td');
    const code = document.createElement('code');
    code.textContent = r.value;
    const cell = document.createElement('div');
    cell.className = 'cell';
    // Preview-only values get no copy button: they must be replaced, not pasted into the console.
    if (r.blocked) {
      tr.className = 'blocked';
      cell.append(code);
    } else cell.append(code, copyButton(r.value));
    td.appendChild(cell);
    if (r.note) {
      const note = document.createElement('span');
      note.className = r.blocked ? 'note blocked-note' : 'note';
      note.textContent = r.note;
      td.appendChild(note);
    }
    tr.append(th, td);
    body.appendChild(tr);
  }
  $('copyAll').onclick = () =>
    navigator.clipboard
      .writeText(
        [
          `Aspect: ${name} (${source})`,
          `Aspect extension in FI repo: ${fiRepoPath(name)}`,
          '',
          formValuesText(rows),
        ].join('\n'),
      )
      .catch(() => log('warn', 'Clipboard not available in this browser'));
}

const SCREEN_TITLES = {
  // The sandbox's home header shows the institution name.
  home: 'Candescent',
  // A My Settings modal is previewed on the More tab, the sandbox's equivalent screen.
  settings: 'More',
  transactions: 'Transaction History',
};

/**
 * Shows the app screen the aspect's page lands on: its tab, title and sample content. A chatbot has
 * no page and appears on every screen, so it is shown on home.
 */
function showScreen(sub) {
  let screen = null;
  if (sub.page) screen = screenForPage(sub.page);
  else if (sub.type === 'chatbot') screen = 'home';
  const shown = screen ?? 'home';
  for (const el of document.querySelectorAll('.app-screen'))
    el.hidden = el.dataset.screen !== shown;
  // Sandbox tabs: Accounts hosts home and transaction history; My Settings is reached from More.
  for (const tab of $('bottomnav').children)
    tab.classList.toggle(
      'active',
      (tab.dataset.screens ?? '').split(' ').includes(shown),
    );
  $('appHeader').classList.toggle('home', shown === 'home');
  $('appcontent').textContent = SCREEN_TITLES[shown];
  const note =
    screen === 'transactions'
      ? 'Neither the iOS nor the Android app shows aspects on Transaction History, so this one would not appear.'
      : screen !== null
        ? ''
        : sub.page
          ? `The app has no screen for "${sub.page}", so it would not show this aspect.`
          : 'A modal needs a page to show on.';
  $('screenNote').textContent = note;
  $('screenNote').hidden = !note;
}

// ---------- Phone theme (header gear), like the mobile sandbox's branding picker ----------

// Neutral is the default so an FI's own accent colour sits well on it; the rest are the sandbox's
// themes (@cdx-extensions/di-sdk-mobile mocks/branding-*.json, light mode).
const THEMES = [
  // Follows the aspect's own accent colour (a Data Attribute such as accentcolor), as if the
  // bank's app were branded in it. Built in themeFor(); Neutral is used when there is no accent.
  { id: 'accent', name: 'Match accent colour' },
  {
    id: 'neutral',
    name: 'Neutral',
    primary: '#3F3F46',
    header: '#FFFFFF',
    headerText: '#212121',
    page: '#F5F5F5',
    text: '#212121',
    text2: '#656565',
  },
  {
    id: 'classic-blue',
    name: 'Classic Blue',
    primary: '#1976D2',
    page: '#FAFAFA',
    text: '#212121',
    text2: '#666666',
  },
  {
    id: 'purple-elegance',
    name: 'Purple Elegance',
    primary: '#5F249F',
    page: '#F5F5F5',
    text: '#1A1A1A',
    text2: '#757575',
  },
  {
    id: 'ocean-blue',
    name: 'Ocean Blue',
    primary: '#1565C0',
    page: '#F5F9FC',
    text: '#1A237E',
    text2: '#546E7A',
  },
  {
    id: 'forest-green',
    name: 'Forest Green',
    primary: '#2E7D32',
    page: '#F1F8E9',
    text: '#1B3A1D',
    text2: '#4E6E50',
  },
  {
    id: 'crimson-red',
    name: 'Crimson Red',
    primary: '#C62828',
    page: '#FFF8F8',
    text: '#212121',
    text2: '#616161',
  },
];
const THEME_KEY = 'aspectPreview.phoneTheme';

let themeId = 'accent';
let accentColor = null; // the current aspect's accent colour, or null when it has none

/** The aspect's accent colour: its template's colour field, else an accentcolor Data Attribute. */
function accentOf(entry) {
  if (!entry) return null;
  const field = entry.template?.fields?.find((f) => f.type === 'color');
  const value = field
    ? answersFromMetadata(entry.template, entry.metadata)[field.key]
    : entry.metadata.properties?.find((p) =>
        /_DATA_accent_?colou?r$/i.test(p.propertyName),
      )?.propertyValue;
  return /^#[0-9a-f]{6}$/i.test(value ?? '') ? value.toUpperCase() : null;
}

/** White or #212121 text (luminance 0.0152), whichever contrasts more with `hex` (WCAG). */
function textOn(hex) {
  const lum = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
  return 1.05 / (lum + 0.05) >= (lum + 0.05) / 0.0652 ? '#FFFFFF' : '#212121';
}

function themeFor(id) {
  const neutral = THEMES.find((x) => x.id === 'neutral');
  if (id !== 'accent') return THEMES.find((x) => x.id === id) ?? neutral;
  if (!accentColor) return neutral;
  return {
    ...neutral,
    primary: accentColor,
    header: accentColor,
    headerText: textOn(accentColor),
  };
}

/** Re-applies the theme after the aspect (or its accent colour in Customize) changes. */
function setAccent(color) {
  accentColor = color;
  const button = $('themeMenu').querySelector('[data-theme=accent]');
  if (button) {
    button.querySelector('.swatch').style.background =
      color ?? THEMES.find((x) => x.id === 'neutral').header;
    button.querySelector('.name').textContent = color
      ? `Match accent colour (${color})`
      : 'Match accent colour (none set)';
  }
  applyTheme(themeId);
}

function applyTheme(id) {
  themeId = THEMES.some((x) => x.id === id) ? id : 'accent';
  const t = themeFor(themeId);
  const header = t.header ?? t.primary;
  const vars = {
    '--app-primary': t.primary,
    '--app-on-primary': textOn(t.primary),
    '--app-primary-outline': `${t.primary}66`,
    '--app-header-bg': header,
    '--app-header-fg': t.headerText ?? textOn(header),
    '--app-page': t.page,
    '--app-text': t.text,
    '--app-text-2': t.text2,
  };
  for (const [k, v] of Object.entries(vars))
    $('screen').style.setProperty(k, v);
  for (const b of $('themeMenu').querySelectorAll('button'))
    b.setAttribute('aria-checked', String(b.dataset.theme === themeId));
  try {
    localStorage.setItem(THEME_KEY, themeId);
  } catch {
    /* storage unavailable: the choice lasts for this page only */
  }
}

function setThemeMenu(open) {
  $('themeMenu').hidden = !open;
  $('themeButton').setAttribute('aria-expanded', String(open));
}

function initThemeMenu() {
  const title = document.createElement('h3');
  title.textContent = 'Theme';
  $('themeMenu').append(
    title,
    ...THEMES.map((t) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'menuitemradio');
      b.dataset.theme = t.id;
      const swatch = document.createElement('span');
      swatch.className = 'swatch';
      swatch.style.background = t.header ?? t.primary;
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = t.name;
      b.append(swatch, name);
      b.addEventListener('click', () => {
        applyTheme(t.id);
        setThemeMenu(false);
      });
      return b;
    }),
  );
  $('themeButton').addEventListener('click', (e) => {
    e.stopPropagation();
    setThemeMenu($('themeMenu').hidden);
  });
  document.addEventListener('click', (e) => {
    if (!$('themeMenu').hidden && !$('themeMenu').contains(e.target))
      setThemeMenu(false);
  });
  let saved = null;
  try {
    saved = localStorage.getItem(THEME_KEY);
  } catch {
    /* storage unavailable */
  }
  applyTheme(saved);
}

function percent(map, size, fallback) {
  return (map?.[size] ?? map?.[fallback] ?? 100) / 100;
}

const MARK_MS = 2800;
// Set when you pick an aspect or press Reload; Customize edits reload without the outline.
let markPending = true;

/** Outlines the aspect the first time it shows after a load, so you can tell it from the sample app. */
function markSlot(mode) {
  const mark = $('slotMark');
  clearTimeout(markSlot.timer);
  // Measure after the slot's 0.2 s move so the outline lands where the aspect ends up.
  markSlot.timer = setTimeout(() => {
    const slot = $('slot');
    const pad = mode === 'fab' ? 6 : 0;
    Object.assign(mark.style, {
      left: `${slot.offsetLeft - pad}px`,
      top: `${slot.offsetTop - pad}px`,
      width: `${slot.offsetWidth + pad * 2}px`,
      height: `${slot.offsetHeight + pad * 2}px`,
      borderRadius:
        mode === 'fab' ? '50%' : getComputedStyle(slot).borderRadius,
    });
    mark.classList.add('show');
    markSlot.timer = setTimeout(() => mark.classList.remove('show'), MARK_MS);
  }, 250);
}

function placeSlot(mode) {
  const slot = $('slot');
  const scrim = $('scrim');
  const screen = $('screen');
  const geometry = rules.types[state.sub?.type]?.geometry ?? {};
  // As the apps lay it out (AspectSlotManager): sizes are a share of the whole screen, then fitted to
  // the space they may use. A sheet covers the tab bar up to the status bar; the chat panel sits above
  // the tab bar; a dialog is centred below the status bar.
  const W = screen.clientWidth;
  const full = screen.clientHeight;
  const belowStatus = full - STATUS_BAR;
  const H = belowStatus - NAV_BAR;
  scrim.style.display = 'none';
  slot.style.borderRadius = '';
  if (mode === 'hidden') {
    slot.style.display = 'none';
    clearTimeout(markSlot.timer);
    $('slotMark').classList.remove('show');
    return;
  }
  if (markPending) {
    markPending = false;
    markSlot(mode);
  }
  slot.style.display = 'block';
  slot.style.visibility = 'visible';
  if (mode === 'fab') {
    const d = `${geometry.collapsedDp ?? 56}px`;
    Object.assign(slot.style, {
      width: d,
      height: d,
      right: '16px',
      left: '',
      bottom: `${NAV_BAR + 16}px`,
      top: '',
      borderRadius: '50%',
    });
  } else if (mode === 'panel') {
    // Full width; the size sets the height only (AspectPresentation on both apps).
    const p = percent(geometry.panelPercent, state.sub.size, 'large');
    Object.assign(slot.style, {
      width: '100%',
      height: `${Math.round(Math.min(full * p, H))}px`,
      right: '0',
      left: '0',
      bottom: `${NAV_BAR}px`,
      top: '',
    });
  } else if (mode === 'sheet') {
    const p = percent(geometry.sheetPercent, state.sub.size, 'medium');
    Object.assign(slot.style, {
      width: '100%',
      left: '0',
      right: '0',
      height: `${Math.round(Math.min(full * p, belowStatus))}px`,
      bottom: '0',
      top: '',
      borderRadius: '16px 16px 0 0',
    });
    scrim.style.display = 'block';
  } else if (mode === 'dialog') {
    // center_overlay: the manifest maxima, 400 x 320, shrunk to fit with 16 px each side.
    const w = Math.min(400, W - 32);
    const h = Math.min(320, belowStatus - 32);
    Object.assign(slot.style, {
      width: `${w}px`,
      height: `${h}px`,
      left: `${Math.round((W - w) / 2)}px`,
      right: '',
      bottom: '',
      top: `${Math.round(STATUS_BAR + (belowStatus - h) / 2)}px`,
      borderRadius: '16px',
    });
    scrim.style.display = 'block';
  }
}

// The manifest context block as the apps build it (AspectHostContext): viewport is always "mobile",
// isAuthenticated always true (V2 aspects mount after login); theme is the app's /brandings theme.
function context() {
  return {
    locale: navigator.language || 'en',
    theme: 'preview',
    viewport: 'mobile',
    isAuthenticated: true,
  };
}

function sendToAspect(action, payload = context()) {
  if (!state.handle) {
    log(
      'warn',
      `host -> aspect  ${action} not delivered: the aspect frame is not ready yet`,
    );
    return;
  }
  state.handle.postToAspect(action, payload);
  log('info', `host -> aspect  ${action} ${JSON.stringify(payload)}`);
}

function onMessage(action, payload, thisRun) {
  if (thisRun !== run) return;
  const sub = state.sub;
  const err = checkMessage(sub.type, action, payload, rules);
  if (err) {
    log('bad', `REJECTED ${action} ${JSON.stringify(payload)} -> ${err}`);
    return;
  }
  log('ok', `accepted ${action} ${JSON.stringify(payload)}`);
  if (action === 'chatbotOpen') {
    // The apps send the opening context once (when the loader loads), not on every open.
    placeSlot('panel');
    state.chatbotExpanded = true;
  } else if (action === 'chatbotMinimize') {
    placeSlot('fab');
    state.chatbotExpanded = false;
  } else if (action === 'modalOpen') {
    const elapsed = state.handle ? Date.now() - state.handle.startedAt : 0;
    const windowMs = rules.types.modal.partnerDelegatedOpenWindowMs;
    if (sub.displayAuthority === 'partner_delegated' && elapsed > windowMs) {
      log(
        'bad',
        `modalOpen after ${(elapsed / 1000).toFixed(1)} s: outside the ${
          windowMs / 1000
        } s window, so the modal stays hidden`,
      );
      return;
    }
    state.modalOpened = true;
    placeSlot(sub.placement === 'center_overlay' ? 'dialog' : 'sheet');
    sendToAspect('modalOpen');
  } else if (action === 'modalDismiss') {
    placeSlot('hidden');
  } else if (action === 'navigate') {
    // The app's rule; only "is this exactly the bank's host" is unknown here.
    const { outcome, message } = checkNavigate(payload.url, sub.csp);
    const level = { blocked: 'bad', bankHostOnly: 'warn' }[outcome] ?? 'ok';
    log(
      level,
      `navigate ${outcome === 'blocked' ? 'BLOCKED' : payload.url}: ${message}`,
    );
  }
}

async function fetchText(url) {
  try {
    // Redirects fail here like they do on the device (and in probeScript).
    const r = await fetch(url, { cache: 'no-store', redirect: 'manual' });
    return r.ok ? await r.text() : null;
  } catch {
    return null;
  }
}

const bust = (url) => `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`;

function rekeyLowercase(sub) {
  const scripts = {};
  for (const [k, v] of Object.entries(sub.scripts))
    scripts[k.toLowerCase()] = v;
  return { ...sub, scripts };
}

/**
 * Checks the hosted copy of the loader (the URL typed in step 1, else a real Script URL in the
 * metadata) the way a device downloads it: reachable, CORS, SRI. A typed URL is compared with your
 * local file, since the submit takes its SRI from it. Fills hostedSri for the form values.
 * Returns { state: 'none' | 'ok' | 'stale' | 'bad', message }.
 */
async function checkHostedLoader(sub, hostedSri) {
  const [key, s] = Object.entries(sub.scripts)[0] ?? [];
  if (!key) return { state: 'none', message: '' };
  const typed = hostedUrls[current.id];
  const url = typed || s.url;
  if (!typed && isPlaceholderUrl(url))
    return { state: 'none', message: 'Not checked yet.' };
  const probe = await probeScript(url);
  if (!probe.ok) {
    log('bad', `hosted loader "${key}": ${probe.problem}`);
    return { state: 'bad', message: probe.problem };
  }
  hostedSri[key] = probe.integrity;
  const local =
    current.localLoaders[key] ??
    current.localLoaders[
      Object.keys(current.localLoaders).find((k) => k.toLowerCase() === key)
    ];
  const localProbe = local
    ? await probeScript(bust(new URL(local, location.href).href))
    : null;
  if (localProbe?.ok && localProbe.integrity !== probe.integrity) {
    log('warn', `hosted loader "${key}" differs from your local file`);
    return {
      state: 'stale',
      message:
        'Found, but it differs from your local file. Upload your latest file, then check again.',
    };
  }
  if (!typed && probe.integrity !== s.sri) {
    log(
      'bad',
      `hosted loader "${key}" hashes to ${probe.integrity}, not the submission SRI`,
    );
    return {
      state: 'bad',
      message: `It hashes to ${probe.integrity}, but the submission says ${s.sri}. The app would refuse to run it.`,
    };
  }
  log(
    'ok',
    `hosted loader "${key}": found (${probe.bytes} bytes), SRI ${probe.integrity}`,
  );
  return {
    state: 'ok',
    message: `Found (${probe.bytes} bytes) and matches your file. SRI ${probe.integrity}`,
  };
}

async function load() {
  const thisRun = ++run;
  state = {};
  $('log').textContent = '';
  $('slot').textContent = '';
  placeSlot('hidden');
  if (!current) return;

  let sub = normalizeSubmission(current.metadata);
  if (option('lowerKeys', false)) {
    sub = rekeyLowercase(sub);
    log(
      'warn',
      'Script Names lowercased, as if normalised on the way to the app',
    );
  }
  state.sub = sub;
  showScreen(sub);
  setAccent(accentOf(current));
  log(
    'info',
    `${sub.name || current.id}: ${sub.type} · ${sub.placement} (${
      sub.size || 'default size'
    }) · loaders from local files`,
  );

  // Static checks use the code we can read: local files, or the hosted file when CORS allows it.
  const loaderTexts = {};
  const typedUrl = hostedUrls[current.id];
  for (const [key, s] of Object.entries(sub.scripts)) {
    const local =
      current.localLoaders[key] ??
      current.localLoaders[
        Object.keys(current.localLoaders).find((k) => k.toLowerCase() === key)
      ];
    const text = local
      ? await fetchText(local)
      : await fetchText(typedUrl || s.url);
    if (text != null) loaderTexts[key] = text;
  }
  const bootstrapText = await fetchText(current.bootstrapUrl);
  const findings = checkSubmission(sub, rules, {
    bootstrap: bootstrapText ?? undefined,
    loaders: loaderTexts,
  });
  if (current.template) {
    // The local copy of the UI page, served next to the aspect extension.
    const uiFile = current.template.uiFile;
    const uiText = uiFile
      ? await fetchText(
          current.bootstrapUrl.replace(/[^/]+$/, encodeURIComponent(uiFile)),
        )
      : null;
    findings.push(
      ...checkTemplateConfig(
        current.template,
        current.metadata,
        uiText ?? undefined,
      ),
    );
  }
  renderFindings(findings);
  if (thisRun !== run) return;
  if (hasErrors(findings)) {
    log(
      'bad',
      'Check errors: the mobile app would not show this aspect. Running it anyway so you can see what else happens.',
    );
  }

  const scripts = {};
  const hostedSri = {};
  for (const [key, s] of Object.entries(sub.scripts)) {
    const local =
      current.localLoaders[key] ??
      current.localLoaders[
        Object.keys(current.localLoaders).find((k) => k.toLowerCase() === key)
      ];
    if (local) {
      const url = bust(new URL(local, location.href).href);
      const probe = await probeScript(url);
      const computed = probe.integrity;
      if (computed && computed !== s.sri) {
        log(
          'warn',
          `loader "${key}": local file hash ${computed} differs from the submission SRI. Update the SRI before submitting.`,
        );
      } else if (computed) {
        log('ok', `loader "${key}": local file matches the submission SRI`);
      }
      scripts[key] = { url, integrity: computed ?? s.sri };
    } else {
      // No local file: run the submitted Script URL, as a device would.
      const url = s.url;
      if (isPlaceholderUrl(url)) {
        log('info', `loader "${key}": no local file and no hosted URL yet.`);
        continue;
      }
      const probe = await probeScript(url);
      if (!probe.ok) {
        log('bad', `loader "${key}": ${probe.problem}`);
      } else {
        hostedSri[key] = probe.integrity;
        if (probe.integrity !== s.sri) {
          log(
            'bad',
            `loader "${key}": the hosted file hashes to ${probe.integrity}, but the submission says ${s.sri}. The app will refuse to run it.`,
          );
        } else {
          log(
            'ok',
            `loader "${key}": hosted file (${probe.bytes} bytes) matches the submission SRI`,
          );
        }
      }
      scripts[key] = { url, integrity: s.sri };
    }
  }
  const hostedCheck = await checkHostedLoader(sub, hostedSri);
  if (thisRun !== run) return;
  renderUse(sub, findings, { hostedSri, bootstrapText, hostedCheck });
  if (!Object.keys(scripts).length) return;

  $('slot').style.display = 'block';
  $('slot').style.visibility = 'hidden';
  const handle = await startAspect($('slot'), {
    submission: sub,
    // Set before the aspect extension runs, so messages it sends at once find the handle.
    onHandle: (h) => {
      if (thisRun === run) state.handle = h;
    },
    bootstrapUrl: bust(new URL(current.bootstrapUrl, location.href).href),
    scripts,
    setScriptKeyGlobal: option('setKey', true),
    evaluateTwice: option('twice', false),
    isCurrent: () => thisRun === run,
    log: (level, msg) => thisRun === run && log(level, msg),
    onMessage: (action, payload) => onMessage(action, payload, thisRun),
    onLoaderLoaded: () => {
      if (thisRun !== run) return;
      if (sub.type === 'chatbot') {
        placeSlot('fab');
        // Like the apps: reveal the launcher and deliver the opening context as chatbotOpen.
        sendToAspect('chatbotOpen');
      } else if (sub.displayAuthority === 'host_immediate') {
        // The app shows it as soon as the content is ready and tells the aspect with modalOpen.
        state.modalOpened = true;
        placeSlot(sub.placement === 'center_overlay' ? 'dialog' : 'sheet');
        sendToAspect('modalOpen');
      } else if (!state.modalOpened) {
        placeSlot('hidden');
        log(
          'info',
          `modal mounted hidden; waiting up to ${
            rules.types.modal.partnerDelegatedOpenWindowMs / 1000
          } s for modalOpen`,
        );
        setTimeout(() => {
          if (thisRun === run && !state.modalOpened)
            log(
              'bad',
              'no modalOpen within the window: on a device this modal never appears on this visit',
            );
        }, rules.types.modal.partnerDelegatedOpenWindowMs);
      }
    },
  });
  // A run that finished after a newer one started must not replace the newer run's handle.
  if (thisRun === run) state.handle = handle;
  if (!state.handle) placeSlot('hidden');
}

function selectAspect(id) {
  const a = config.aspects.find((x) => x.id === id);
  current = a && { ...a, base: a.metadata, dirty: false };
  markPending = true;
  renderOrigin();
  renderSettings();
  load();
}

/** Under the picker: is this a template, or your aspect and which template it came from. */
function renderOrigin() {
  const line = $('aspectOrigin');
  line.replaceChildren();
  if (!current) return;
  const badge = (text, tone) => {
    const b = document.createElement('span');
    b.className = `badge ${tone}`;
    b.textContent = text;
    return b;
  };
  const strong = (text) => {
    const b = document.createElement('strong');
    b.textContent = text;
    return b;
  };
  if (current.isTemplate) {
    line.append(
      badge('Template', ''),
      strong(current.template?.title || current.id),
      'is read-only. Change it under Customize and press Create my aspect.',
    );
  } else if (current.templateOf) {
    line.append(
      badge('My aspect', 'info'),
      'Made from the',
      strong(current.templateOf.title),
      `template. Files in ${current.path}/.`,
    );
  } else {
    line.append(badge('My aspect', 'info'), `Files in ${current.path}/.`);
  }
}

// ---------- Customize: edit the template settings, preview them, save them ----------

function settingsMessage(text, tone = '') {
  $('settingsMessage').className = `settings-message ${tone}`;
  $('settingsMessage').textContent = text;
}

function setDirty(dirty) {
  current.dirty = dirty;
  $('settingsState').className = 'badge';
  $('settingsState').textContent = dirty ? 'Unsaved changes' : '';
  $('resetSettings').disabled = !dirty;
}

/** One input per template field, filled from the aspect's metadata. */
function settingInput(field, value) {
  const label = document.createElement('label');
  label.className = 'control';
  label.dataset.key = field.key;
  if (field.type === 'url' || field.maxLength > 60) label.classList.add('wide');
  const name = document.createElement('span');
  name.className = 'label';
  // A choice always has a value, so only free-text fields can be optional.
  name.textContent =
    field.required || field.type === 'choice'
      ? field.label
      : `${field.label} (optional)`;
  let input;
  if (field.type === 'choice') {
    input = document.createElement('select');
    input.append(
      ...field.options.map((o) => new Option(field.optionLabels?.[o] ?? o, o)),
    );
  } else {
    input = document.createElement('input');
    input.type = field.type === 'url' ? 'url' : 'text';
    input.spellcheck = false;
    if (field.maxLength) input.maxLength = field.maxLength;
  }
  input.value = value;
  input.dataset.setting = field.key;
  input.addEventListener('input', onSettingsInput);
  label.append(name);
  if (field.type === 'color') {
    // A swatch for picking plus the hex text for exact brand values; both edit the same setting.
    const swatch = document.createElement('input');
    swatch.type = 'color';
    swatch.setAttribute('aria-label', `${field.label} picker`);
    swatch.value = /^#[0-9a-f]{6}$/i.test(value) ? value : '#000000';
    swatch.addEventListener('input', () => {
      input.value = swatch.value;
      onSettingsInput();
    });
    input.addEventListener('input', () => {
      if (/^#[0-9a-f]{6}$/i.test(input.value)) swatch.value = input.value;
    });
    const row = document.createElement('span');
    row.className = 'color-row';
    row.append(swatch, input);
    label.append(row);
  } else {
    label.append(input);
  }
  if (field.help || field.links?.length)
    label.append(helpLine(field.help, field.links));
  const error = document.createElement('span');
  error.className = 'field-error';
  label.append(error);
  return label;
}

/** A field or group explanation, with optional documentation links (opened in a new tab). */
function helpLine(text, links = []) {
  const help = document.createElement('span');
  help.className = 'field-help';
  if (text) help.append(text);
  for (const l of links) {
    const a = document.createElement('a');
    a.href = l.url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = l.label;
    help.append(help.childNodes.length ? ' ' : '', a);
  }
  return help;
}

const SECTORS = [
  ['RETAIL', 'Retail'],
  ['BUSINESS', 'Business'],
];

/** The Developer Console Sector: a submission value, not a template field. */
function sectorInput(value) {
  const label = document.createElement('label');
  label.className = 'control';
  const name = document.createElement('span');
  name.className = 'label';
  name.textContent = 'Sector';
  const input = document.createElement('select');
  input.append(...SECTORS.map(([v, text]) => new Option(text, v)));
  input.value = SECTORS.some(([v]) => v === value) ? value : 'RETAIL';
  input.dataset.sector = '';
  input.addEventListener('input', onSettingsInput);
  label.append(name, input, helpLine('Which customers the aspect is for.'));
  return label;
}

const readSector = () =>
  document.querySelector('[data-sector]')?.value ?? 'RETAIL';

/** Fields in their template groups (one grid per group); a template without groups gets one grid. */
function settingGroups(template, answers) {
  const groups = template.groups?.length ? template.groups : [{ id: null }];
  return groups
    .map((g) => {
      const fields = template.fields.filter((f) =>
        g.id === null ? true : (f.group ?? groups[0].id) === g.id,
      );
      if (!fields.length) return null;
      // Optional groups (sign-in, advanced) start folded so the first view shows only the basics.
      const section = document.createElement(
        g.collapsed ? 'details' : 'section',
      );
      section.className = 'settings-group';
      if (g.title) {
        const h = document.createElement(g.collapsed ? 'summary' : 'h3');
        h.textContent = g.title;
        section.append(h);
      }
      if (g.help || g.links?.length) section.append(helpLine(g.help, g.links));
      const grid = document.createElement('div');
      grid.className = 'settings-grid';
      grid.append(...fields.map((f) => settingInput(f, answers[f.key])));
      section.append(grid);
      return section;
    })
    .filter(Boolean);
}

function renderSettings() {
  const mode = current ? current.editable : null;
  $('settings').hidden = !mode;
  if (!mode) return;
  const answers = answersFromMetadata(current.template, current.base);
  const groups = settingGroups(current.template, answers);
  groups[0]
    ?.querySelector('.settings-grid')
    ?.prepend(sectorInput(current.base.sector));
  $('settingsFields').replaceChildren(...groups);
  $('settingsHint').textContent =
    mode === 'save'
      ? `Changes show in the phone straight away. Save writes them to ${current.path}/metadata.json; your hosted loader keeps working.`
      : 'Try your values here, then press "Create my aspect" to get your own copy in aspects/mobile/<name>/.';
  $('copyNameRow').hidden = mode !== 'copy';
  $('copyName').placeholder = `my-bank-${current.template.type}`;
  $('saveSettings').textContent =
    mode === 'save' ? 'Save to metadata.json' : 'Create my aspect';
  $('saveSettings').disabled = false;
  settingsMessage('');
  setDirty(false);
}

function readAnswers() {
  return Object.fromEntries(
    [...document.querySelectorAll('[data-setting]')].map((i) => [
      i.dataset.setting,
      i.value.trim(),
    ]),
  );
}

function showFieldErrors(errors) {
  for (const label of $('settingsFields').querySelectorAll(
    '.control[data-key]',
  )) {
    const err = errors[label.dataset.key] ?? '';
    label.classList.toggle('invalid', Boolean(err));
    label.querySelector('.field-error').textContent = err;
    // Unfold an optional group that holds an invalid value, so the error is not hidden.
    if (err) label.closest('details')?.setAttribute('open', '');
  }
}

let settingsTimer;
function onSettingsInput() {
  clearTimeout(settingsTimer);
  settingsTimer = setTimeout(applySettings, 350);
}

/** Previews the edited settings: the same metadata change Save would write, kept in memory. */
function applySettings() {
  const answers = readAnswers();
  const errors = validateAnswers(current.template, answers);
  showFieldErrors(errors);
  setDirty(true);
  settingsMessage('');
  const valid = !Object.keys(errors).length;
  $('saveSettings').disabled = !valid;
  if (!valid) return;
  current.metadata = {
    ...withAnswers(current.template, current.base, answers),
    sector: readSector(),
  };
  load();
}

async function saveSettings() {
  const mode = current.editable;
  const answers = readAnswers();
  const errors = validateAnswers(current.template, answers);
  showFieldErrors(errors);
  if (Object.keys(errors).length) return;
  const body = { answers, sector: readSector() };
  if (mode === 'copy') {
    body.name = $('copyName').value.trim();
    const nameError = validateName(body.name);
    if (nameError) {
      settingsMessage(`Name: ${nameError}`, 'bad');
      $('copyName').focus();
      return;
    }
  }
  $('saveSettings').disabled = true;
  let res;
  let out = {};
  try {
    res = await fetch(
      `/api/aspects/${encodeURIComponent(current.id)}/${
        mode === 'save' ? 'settings' : 'copy'
      }`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );
    out = await res.json().catch(() => ({}));
  } catch {
    res = null;
  }
  $('saveSettings').disabled = false;
  if (!res?.ok) {
    if (out.errors) showFieldErrors(out.errors);
    settingsMessage(
      out.error ??
        (out.errors
          ? 'Fix the highlighted settings.'
          : `Could not save (${
              res ? `HTTP ${res.status}` : 'server not reachable'
            }).`),
      'bad',
    );
    return;
  }
  current.dirty = false; // so the file-change reload that follows is not treated as a conflict
  config = await fetch('/api/config').then((r) => r.json());
  fillAspectOptions();
  $('aspect').value = out.id;
  selectAspect(out.id);
  settingsMessage(
    mode === 'save'
      ? `Saved to ${current.path}/metadata.json.`
      : `Created ${current.path}/. Host static-loader.v1.js next (see Next steps), then submit.`,
    'ok',
  );
}

/** "Support Chat (Chatbot)" for a template, "my-bank-chat (Support Chat Chatbot)" for an aspect you created. */
function pickerLabel(a) {
  const sub = normalizeSubmission(a.metadata);
  const type = aspectLabel(a.id, sub).split(' · ')[0];
  if (a.isTemplate) return `${a.template?.title || a.id} (${type})`;
  return `${a.id} (${a.templateOf ? `${a.templateOf.title} ` : ''}${type})`;
}

/** The aspect picker: the aspects you created first, then the templates to start from. */
function fillAspectOptions() {
  const group = (label, list) => {
    const g = document.createElement('optgroup');
    g.label = label;
    g.append(...list.map((a) => new Option(pickerLabel(a), a.id)));
    return g;
  };
  const mine = config.aspects.filter((a) => !a.isTemplate);
  const templates = config.aspects.filter((a) => a.isTemplate);
  $('aspect').replaceChildren(
    ...(mine.length ? [group('My aspects', mine)] : []),
    ...(templates.length ? [group('Templates', templates)] : []),
  );
}

async function init() {
  [rules, config] = await Promise.all([
    fetch('/src/mobile-rules.json').then((r) => r.json()),
    fetch('/api/config').then((r) => r.json()),
  ]);
  initThemeMenu();
  fillAspectOptions();
  $('aspect').addEventListener('change', () => selectAspect($('aspect').value));
  $('reload').addEventListener('click', () => {
    markPending = true;
    load();
  });
  if (ADVANCED) {
    $('advanced').hidden = false;
    for (const id of ['setKey', 'twice', 'lowerKeys'])
      $(id).addEventListener('change', load);
  }
  $('saveSettings').addEventListener('click', saveSettings);
  $('resetSettings').addEventListener('click', () => selectAspect(current.id));
  $('scrim').addEventListener('click', () => {
    log('info', 'scrim tapped: the app closes the modal and tells the aspect');
    placeSlot('hidden');
    sendToAspect('modalDismiss', { status: 'cancelled' });
  });
  // Escape stands in for Android's back button (iOS has no equivalent): it collapses an open chat
  // panel, or closes an open modal as a scrim tap does.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (state.sub?.type === 'chatbot' && state.chatbotExpanded) {
      log(
        'info',
        'back pressed (Android only): the app collapses the panel and tells the aspect',
      );
      placeSlot('fab');
      state.chatbotExpanded = false;
      sendToAspect('chatbotMinimize', { status: 'host_minimized' });
    } else if (
      state.sub?.type === 'modal' &&
      state.modalOpened &&
      $('scrim').style.display === 'block'
    ) {
      log(
        'info',
        'back pressed (Android only): the app closes the modal and tells the aspect',
      );
      placeSlot('hidden');
      sendToAspect('modalDismiss', { status: 'cancelled' });
    }
  });
  const requested = new URLSearchParams(location.search).get('aspect');
  const first =
    config.aspects.find((a) => a.id === requested) ?? config.aspects[0];
  if (first) {
    $('aspect').value = first.id;
    selectAspect(first.id);
  } else {
    log(
      'warn',
      'No aspects found. Start the server with --aspect <folder>, or create one with pnpm run create-aspect:mobile.',
    );
  }
  new EventSource('/events').addEventListener('message', () => {
    if (current?.dirty) {
      log(
        'warn',
        'Files changed on disk. Your unsaved settings are kept; press Discard changes to load the files.',
      );
      return;
    }
    if (current) {
      fetch('/api/config')
        .then((r) => r.json())
        .then((c) => {
          config = c;
          fillAspectOptions();
          const same = config.aspects.find((a) => a.id === current.id);
          if (!same) {
            // The selected folder was deleted: switch to another aspect, or clear the preview.
            const next = config.aspects[0];
            if (next) $('aspect').value = next.id;
            selectAspect(next?.id);
            log('warn', 'The selected aspect folder was removed.');
            return;
          }
          $('aspect').value = same.id;
          log('info', 'files changed: reloading');
          const message = $('settingsMessage').textContent;
          const tone = $('settingsMessage')
            .className.replace('settings-message', '')
            .trim();
          selectAspect(same.id);
          settingsMessage(message, tone); // keep "Saved to ..." visible after the reload
        });
    }
  });
}

init();
