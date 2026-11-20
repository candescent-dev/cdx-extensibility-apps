/*
 * Turns a normalized submission into what the developer needs to submit it:
 * a friendly label, the Developer Console form values (Mobile) and the FI repo file path.
 * Pure functions, shared by the preview's "Use this aspect" panel and its tests.
 */

import { previewOnly as unsubmittable } from './metadata-builder.mjs';

export { unsubmittable };

const LABELS = {
  chatbot: 'Chatbot',
  modal: 'Modal',
  bottom_right_fab: 'Bottom Right FAB',
  bottom_sheet: 'Bottom Sheet',
  center_overlay: 'Center Overlay',
  partner_delegated: 'Partner Delegated',
  host_immediate: 'Host Immediate',
  on_route_match: 'On Route Match',
  lazy_on_intent: 'Lazy On Intent',
  pageLoad: 'Page Load',
  event: 'Event',
  always: 'Always',
  authenticated_session: 'Authenticated Session',
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
};

// The Developer Console's Page dropdown (modal) and the route it stores. Home and My Settings are
// confirmed in real submissions; My Accounts and Transaction History come from the iOS app's screen
// map (AspectScreenMap.swift), which accepts these four web routes. Anything else is shown as-is.
const PAGES = {
  '/app/home': 'Home Page',
  '/app/home/settings/overview': 'My Settings Page',
  '/app/home/olb/accounts': 'My Accounts Page',
  '/app/home/olb/history': 'Transaction History Page',
};

/** The console's name for a page route ("Home Page"), or the route itself when it has none. */
export const pageLabel = (page) => PAGES[page] ?? page;

/**
 * The mobile screen a page lands on, as the iOS app maps it (AspectScreenMap.swift): 'home' (mobile
 * home is the accounts screen, so web home and accounts both land there), 'settings', 'transactions'
 * (resolves, but has no native host, so aspects never mount there), or null when the app has no
 * screen for it. Query strings, trailing slashes and a trailing " page" are ignored, as on iOS.
 */
export function screenForPage(page) {
  const key = String(page ?? '')
    .trim()
    .toLowerCase()
    .replace(/\?.*$/, '')
    .replace(/\/+$/, '')
    .replace(/ page$/, '')
    .trim();
  if (
    [
      '/app/home',
      '/app/home/olb/accounts',
      'home',
      'accounts',
      'my accounts',
    ].includes(key)
  )
    return 'home';
  if (
    [
      '/app/home/settings/overview',
      'settings',
      'my settings',
      'settings/overview',
    ].includes(key)
  )
    return 'settings';
  if (
    [
      '/app/home/olb/history',
      'history',
      'transaction history',
      'olb/history',
    ].includes(key)
  )
    return 'transactions';
  return null;
}

const label = (value) => LABELS[value] ?? value;

/** "Chatbot · chatbot" style label for the aspect picker. */
export function aspectLabel(id, sub) {
  const type = LABELS[sub.type] ?? (sub.type || 'Unknown type');
  return `${type} · ${id}`;
}

const BLOCKED_NOTE = {
  local:
    'Preview-only address on this machine or a private network. Replace it with your hosted https URL under Customize.',
  placeholder:
    'Placeholder address. Replace it with your real https URL under Customize.',
  loaderPlaceholder:
    'Placeholder. Host your loader and enter its https URL in the hosting step.',
};

/**
 * Console form values, in form order. `hostedSri` (when the hosted file was checked) replaces the
 * submission SRI so the value shown is the one that will verify. A row whose value only works in
 * this preview gets `blocked` ('local' | 'placeholder') and a note saying what to replace.
 * Returns [{ label, value, note?, blocked? }].
 */
export function formValues(sub, metadata, { hostedSri = {} } = {}) {
  const rows = [
    { label: 'Platform', value: 'Mobile' },
    {
      label: 'Sector',
      value: metadata.sector === 'BUSINESS' ? 'Business' : 'Retail',
    },
    { label: 'Component Name', value: metadata.name ?? '' },
    { label: 'Description', value: metadata.widgetDescription ?? '' },
    { label: 'Aspect Type', value: label(sub.type) },
  ];
  sub.csp
    .split(';')
    .map((d) => d.trim())
    .filter(Boolean)
    .forEach((d, i) => {
      const [key, ...sources] = d.split(/\s+/);
      rows.push({
        label: i === 0 ? 'CSP Directives' : '',
        value: `${key} → ${sources.join(' ')}`,
      });
    });
  rows.push(
    { label: 'Permission Policy', value: 'none (leave empty)' },
    {
      label: 'Sandbox Directives',
      value: 'only the locked allow-scripts, allow-same-origin',
    },
    { label: 'Placement', value: label(sub.placement) },
    { label: 'Placement Size', value: label(sub.size) || '(default)' },
    { label: 'Display Authority', value: label(sub.displayAuthority) },
  );
  if (sub.type === 'modal')
    rows.push({ label: 'Page', value: pageLabel(sub.page) });
  rows.push(
    {
      label: 'Mount Strategy / Trigger',
      value: `${label(sub.mountStrategy)} / ${label(sub.trigger)}`,
    },
    { label: 'Frequency', value: label(sub.frequency) },
  );
  for (const [key, s] of Object.entries(sub.scripts)) {
    const sri = hostedSri[key] ?? s.sri;
    rows.push(
      { label: 'Loader Script · Script Name', value: key },
      { label: 'Script URL', value: s.url, note: 'your hosted, versioned URL' },
      {
        label: 'SRI Hash',
        value: sri,
        note: hostedSri[key]
          ? 'computed from the hosted file'
          : 'compute it from the hosted file before submitting',
      },
    );
    for (const [k, v] of Object.entries(s.data))
      rows.push({ label: 'Data Attribute', value: `${k} = ${v}` });
    for (const [k, v] of Object.entries(s.html))
      rows.push({ label: 'HTML Attribute', value: `${k} = ${v}` });
  }
  for (const r of rows) {
    const blocked = unsubmittable(r.value);
    if (!blocked) continue;
    const note =
      blocked === 'placeholder' && r.label === 'Script URL'
        ? BLOCKED_NOTE.loaderPlaceholder
        : BLOCKED_NOTE[blocked];
    Object.assign(r, { blocked, note });
  }
  return rows;
}

/** Where the aspect extension goes in the FI extensions repo. */
export function fiRepoPath(name) {
  return `aspects/mobile/${name}/${name}.js`;
}

/** Plain-text version of the panel, for "Copy all". Blocked values are never copied. */
export function formValuesText(rows) {
  return rows
    .map(
      (r) =>
        `${r.label || ' '.repeat(4)}: ${
          r.blocked ? '<replace with your hosted https URL>' : r.value
        }`,
    )
    .join('\n');
}
