/*
 * Template - Mobile V2 Modal static loader: the sandbox end of the aspect message bus.
 * Roles, message bus and rules: samples/mobile/aspects/ARCHITECTURE.md.
 *
 * Where it runs: the one sandbox iframe the app's runtime creates (FI origin, the aspect CSP).
 * Responsibilities (and nothing else):
 *   - validate its Data Attributes and the optional runtime JSON (configUrl); fail closed
 *   - mount exactly one child iframe for the partner UI (uiUrl, partner origin)
 *   - pass messages between that UI and the aspect extension, which is the only piece that talks to the app
 *     and keeps the modal lifecycle (one modalOpen inside the app's open window, nothing after a dismiss):
 *       UI <-> loader     private envelope { type:'ASPECT_UI', version:'1.0', direction, action, payload }
 *         'aspectToHost'  actions the UI asks for (modalOpen, modalDismiss, navigate): sent to the
 *                         aspect extension as `hostAction`, which checks them and sends them to the app
 *         'hostToAspect'  the app's messages, from the aspect extension's `hostMessage`, forwarded unchanged:
 *                         modalOpen (the app has shown the modal; carries the context) / modalDismiss
 *                         {cancelled} (the app closed it)
 *         'uiToLoader'    uiReady, identityRefresh
 *         'loaderToUi'    aspectInit, identityUpdate, messageRejected (from the aspect extension)
 *       loader <-> aspect extension  channel 'ASPECT_EXTENSION': hello / identityRefresh / hostAction up,
 *                         init / identityUpdate / hostMessage / messageRejected down
 *   - hand the UI the partner-scoped session the aspect extension obtained; never FI cookies, the
 *     authorization code or a Candescent token
 * Must not: use window.dbk, post the app's ASPECT_MESSAGE envelope (the runtime would relay it straight
 * to the app), act on the copies of the app's messages the runtime also posts into this sandbox, render
 * product UI, call the token bridge, use eval / innerHTML / document.write / window.open / forms.
 *
 * The app owns position and size (bottom_sheet or center_overlay, Placement Size).
 * Its SRI is pinned: never change a hosted copy. Host each change at a new versioned URL (for example .v2.js).
 */
(function () {
  'use strict';

  var LOG = '[modal]';
  var ASPECT_TYPE = 'modal';
  var MAX_QUEUED = 20;

  // UI <-> loader envelope. Not the app's ASPECT_MESSAGE: only the aspect extension talks to the app.
  var ENVELOPE = 'ASPECT_UI';
  // Aspect extension <-> loader channel (see aspect-extension.js). Not an ASPECT_MESSAGE and has no
  // `action` key, so the runtime's relay never forwards it to the app.
  var EXTENSION = 'ASPECT_EXTENSION';
  var VERSION = '1.0';
  var DIR = {
    TO_HOST: 'aspectToHost',
    FROM_HOST: 'hostToAspect',
    UI_TO_LOADER: 'uiToLoader',
    LOADER_TO_UI: 'loaderToUi',
    TO_EXTENSION: 'loaderToExtension',
    FROM_EXTENSION: 'extensionToLoader',
  };
  // Manifest `context` block: required locale, theme, viewport; optional isAuthenticated.
  var CONTEXT_KEYS = ['locale', 'theme', 'viewport', 'isAuthenticated'];

  // Run once per sandbox, even if the runtime evaluates the loader twice.
  var INIT_FLAG = '__modalStaticLoaderInit';
  if (window[INIT_FLAG]) return;
  window[INIT_FLAG] = true;

  // The runtime puts this script's Data Attributes on its own <script> tag as JSON
  // (data-aspect-config). document.currentScript is only set while this file first runs.
  var ownScript = document.currentScript;

  // ---------- config (Data Attributes; treat as untrusted) ----------
  // https only; plain http is accepted for localhost so the local preview can serve the UI.
  function isWebUrl(v) {
    return (
      typeof v === 'string' &&
      (/^https:\/\/[^\s]+$/i.test(v) ||
        /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/[^\s]*$/i.test(v))
    );
  }

  function originOf(url) {
    try {
      return new URL(url).origin;
    } catch (e) {
      return null;
    }
  }

  function isText(v, max) {
    return typeof v === 'string' && v.trim().length > 0 && v.length <= max;
  }

  function findScriptData() {
    var el = ownScript || document.querySelector('script[data-aspect-config]');
    try {
      var data = JSON.parse(
        (el && el.getAttribute('data-aspect-config')) || '{}',
      );
      return data && typeof data === 'object' ? data : {};
    } catch (e) {
      return {};
    }
  }

  function readConfig() {
    var data = findScriptData();
    // Key names may arrive lowercased, so try both spellings.
    function pick(name) {
      var lower = name.toLowerCase();
      return typeof data[lower] === 'string' ? data[lower] : data[name];
    }
    var uiUrl = isWebUrl(pick('uiUrl')) ? pick('uiUrl') : '';
    return {
      uiUrl: uiUrl,
      // The registered UI origin: the origin of the Data Attribute uiUrl, which the CSP frame-src allows.
      uiOrigin: uiUrl ? originOf(uiUrl) : null,
      configUrl: isWebUrl(pick('configUrl')) ? pick('configUrl') : '',
      // Display settings are data for the UI; the loader never renders them.
      display: {
        title: isText(pick('title'), 60) ? pick('title') : 'Go paperless',
        body: isText(pick('body'), 300)
          ? pick('body')
          : 'Switch to e-statements.',
        ctaText: isText(pick('ctaText'), 30) ? pick('ctaText') : 'Learn more',
        ctaUrl: /^https:\/\/[^\s]+$/i.test(pick('ctaUrl') || '')
          ? pick('ctaUrl')
          : '',
        accentColor: /^#[0-9a-f]{6}$/i.test(pick('accentColor') || '')
          ? pick('accentColor')
          : '#081728',
      },
    };
  }

  // Optional runtime JSON: schemaVersion 1, isActive, and a uiUrl on the registered origin.
  // timeoutMs comes from the aspect properties, through the aspect extension's init.
  function fetchRuntimeConfig(cfg, timeoutMs) {
    if (!cfg.configUrl) return Promise.resolve(cfg);
    var controller =
      typeof AbortController === 'function' ? new AbortController() : null;
    var timer = setTimeout(function () {
      if (controller) controller.abort();
    }, timeoutMs);
    return fetch(cfg.configUrl, {
      method: 'GET',
      credentials: 'omit',
      headers: { Accept: 'application/json' },
      signal: controller ? controller.signal : undefined,
    })
      .then(function (res) {
        if (!res.ok) throw new Error('config_http');
        return res.json();
      })
      .then(function (runtime) {
        if (!runtime || typeof runtime !== 'object')
          throw new Error('invalid_config');
        if (runtime.schemaVersion !== 1) throw new Error('schema_version');
        if (runtime.isActive !== true) throw new Error('inactive');
        if (runtime.uiUrl !== undefined) {
          if (
            !isWebUrl(runtime.uiUrl) ||
            originOf(runtime.uiUrl) !== cfg.uiOrigin
          )
            throw new Error('ui_origin');
          cfg.uiUrl = runtime.uiUrl;
        }
        return cfg;
      })
      .finally(function () {
        clearTimeout(timer);
      });
  }

  // This document's origin (the FI origin, inherited by the sandbox). location.origin is "null" in a
  // srcdoc frame, so prefer window.origin.
  function selfOrigin() {
    return window.origin && window.origin !== 'null'
      ? window.origin
      : window.location.origin;
  }

  // To the aspect extension in the host shell, which is this sandbox's parent on the same origin. Only
  // ASPECT_EXTENSION messages, which the runtime's relay never forwards to the app.
  function toParent(msg) {
    window.parent.postMessage(msg, selfOrigin());
  }

  // ---------- identity (from the aspect extension; partner-scoped session only) ----------
  // failed carries the aspect extension's reason, for example session_expired or client_not_authorized.
  function toUiIdentity(result) {
    if (
      result &&
      result.status === 'ok' &&
      typeof result.sessionToken === 'string'
    ) {
      return {
        status: 'ok',
        sessionToken: result.sessionToken,
        expiresAt: result.expiresAt,
      };
    }
    if (result && (result.status === 'none' || result.status === 'pending'))
      return { status: result.status };
    return {
      status: 'failed',
      reason:
        result && typeof result.reason === 'string'
          ? result.reason.slice(0, 64)
          : 'failed',
    };
  }

  // ---------- one sandboxed child iframe for the partner UI ----------
  function mountUi(uiUrl) {
    var style = document.createElement('style');
    style.textContent =
      'html,body{margin:0;height:100%;background:transparent;overflow:hidden;}';
    document.head.appendChild(style);
    var frame = document.createElement('iframe');
    // Same tokens as the app's own sandbox; no `allow` attribute, mobile grants no permissions.
    frame.setAttribute('sandbox', 'allow-scripts allow-same-origin');
    frame.setAttribute('title', 'Promotion');
    frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    frame.style.cssText =
      'border:0;display:block;width:100%;height:100%;background:transparent;';
    frame.src = uiUrl;
    document.body.appendChild(frame);
    return frame;
  }

  // ---------- the bus ----------
  // The aspect extension passes on the app's messages as soon as this script says hello, which can be before
  // the UI exists. The UI is mounted after the aspect extension's init.
  function startBus(cfg) {
    var identity = { status: 'pending' };
    var context = {};
    var ui = null;
    var uiReady = false;
    var queue = [];
    var initialised = false;
    // shown: the app has shown the modal (host_immediate, or its modalOpen came first); for aspectInit.
    var shown = false;

    function envelope(direction, action, payload) {
      return {
        type: ENVELOPE,
        version: VERSION,
        direction: direction,
        action: action,
        payload: payload || {},
      };
    }

    // Messages for a UI that is not ready yet are kept (up to MAX_QUEUED) and replayed after aspectInit.
    function toUi(direction, action, payload) {
      var msg = envelope(direction, action, payload);
      if (uiReady) ui.window.postMessage(msg, ui.origin);
      else if (queue.length < MAX_QUEUED) queue.push(msg);
    }

    function setIdentity(next) {
      identity = toUiIdentity(next);
      if (uiReady)
        toUi(DIR.LOADER_TO_UI, 'identityUpdate', { identity: identity });
    }

    function toExtension(name, payload) {
      toParent({
        type: EXTENSION,
        version: VERSION,
        direction: DIR.TO_EXTENSION,
        name: name,
        payload: payload,
      });
    }

    function attachUi(ready) {
      var frame = mountUi(ready.uiUrl);
      ui = {
        window: frame.contentWindow,
        origin: ready.uiOrigin,
        display: ready.display,
      };
      console.log(LOG, 'ready, UI at', ready.uiOrigin);
    }

    function onExtensionMessage(d) {
      var payload = d.payload && typeof d.payload === 'object' ? d.payload : {};
      if (d.name === 'identityUpdate') {
        setIdentity(payload.identity);
      } else if (
        d.name === 'hostMessage' &&
        typeof payload.action === 'string'
      ) {
        // From the app, through the aspect extension.
        var data =
          payload.payload && typeof payload.payload === 'object'
            ? payload.payload
            : {};
        for (var i = 0; i < CONTEXT_KEYS.length; i++) {
          if (data[CONTEXT_KEYS[i]] !== undefined)
            context[CONTEXT_KEYS[i]] = data[CONTEXT_KEYS[i]];
        }
        if (payload.action === 'modalOpen') shown = true;
        toUi(DIR.FROM_HOST, payload.action, data);
      } else if (d.name === 'messageRejected') {
        // The aspect extension refused an action the UI asked for; tell the UI why.
        toUi(DIR.LOADER_TO_UI, 'messageRejected', {
          action: String(payload.action).slice(0, 64),
          reason: String(payload.reason).slice(0, 200),
        });
      } else if (d.name === 'init' && !initialised) {
        initialised = true;
        setIdentity(payload.identity);
        if (payload.shown === true) shown = true;
        fetchRuntimeConfig(cfg, payload.configTimeoutMs).then(
          attachUi,
          function (err) {
            // Fail closed: invalid runtime config never mounts a UI and never breaks the app.
            console.error(LOG, 'runtime config rejected:', err && err.message);
          },
        );
      }
    }

    function onUiMessage(d) {
      if (d.direction === DIR.UI_TO_LOADER) {
        if (d.action === 'uiReady' && !uiReady) {
          uiReady = true;
          ui.window.postMessage(
            envelope(DIR.LOADER_TO_UI, 'aspectInit', {
              schemaVersion: 1,
              aspectType: ASPECT_TYPE,
              context: context,
              config: ui.display,
              identity: identity,
              // true when the app has shown the modal (host_immediate, or its modalOpen came first)
              shown: shown,
            }),
            ui.origin,
          );
          var pending = queue;
          queue = [];
          for (var i = 0; i < pending.length; i++)
            ui.window.postMessage(pending[i], ui.origin);
        } else if (d.action === 'identityRefresh') {
          toExtension('identityRefresh');
        }
        return;
      }
      if (d.direction !== DIR.TO_HOST) return;
      // The aspect extension checks it against the manifest and the modal lifecycle, and sends it to the app.
      toExtension('hostAction', {
        action: d.action.slice(0, 64),
        payload: d.payload,
      });
    }

    window.addEventListener('message', function (event) {
      var d = event.data;
      if (!d || typeof d !== 'object') return;

      // From the host shell (same origin as this sandbox), never from the UI: only the aspect extension. The
      // runtime also posts the app's ASPECT_MESSAGEs here; they reach the UI through the aspect extension
      // instead, so these copies are ignored.
      if (event.source === window.parent && event.origin === selfOrigin()) {
        if (d.type === EXTENSION && d.direction === DIR.FROM_EXTENSION)
          onExtensionMessage(d);
        return;
      }

      // UI -> loader: only our child iframe, only the registered UI origin.
      if (d.type !== ENVELOPE || typeof d.action !== 'string') return;
      if (!ui || event.source !== ui.window || event.origin !== ui.origin)
        return;
      onUiMessage(d);
    });

    toExtension('hello');
  }

  function boot() {
    var cfg = readConfig();
    if (!cfg.uiUrl || !cfg.uiOrigin) {
      // Fail closed: no UI origin registered, so nothing is mounted.
      console.error(
        LOG,
        'uiUrl Data Attribute missing or not https; nothing mounted',
      );
      return;
    }
    startBus(cfg);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
