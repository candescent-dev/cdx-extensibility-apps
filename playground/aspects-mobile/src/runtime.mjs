/*
 * Browser stand-in for the mobile app's V2 aspect runtime (aspect_runtime_loader.js on iOS and Android).
 *
 * What it reproduces:
 *   - the host shell: the app's web view on the FI origin (this page's origin here), with the aspect
 *     CSP and 'nonce-aspect' replaced by a fresh per-load nonce. window.dbk is defined there, then the
 *     aspect extension runs there.
 *   - dbk.loadSecureExternalScript(<Script Name>) creates one sandbox iframe inside the host shell
 *     (sandbox="allow-scripts allow-same-origin", same CSP) and injects the loader with its SRI, the
 *     nonce, its HTML attributes and its Data Attributes as JSON in data-aspect-config
 *   - dbk.getAspectConfig() with the aspect properties (`properties`), dbk.getAspectScriptConfig(<key>)
 *   - the relay: an ASPECT_MESSAGE (or anything with an `action`) that the host shell or the sandbox
 *     posts on the host shell is handed to the host for schema validation, except hostToAspect ones
 *   - host -> aspect messages delivered to the sandbox from the host shell, and also on the host shell
 *     itself as a created event with no source and no origin (where the aspect extension reads them)
 *   - the token bridge in Android's shape (JSBridge.tokenApiDetails; iOS uses
 *     webkit.messageHandlers.tokenApiDetails), limited to this preview's own host, with the JSON
 *     answer on dbk.tokenResponse + `apiToken:ready`. The preview server plays the bank's token route.
 *   - the dbk helper defaults (navigate('url') -> { url }, a bare chatbotOpen() -> user_clicked_fab)
 *
 * What it does not reproduce: the real token service and bank session, iOS's webkit bridge, frequency
 * caps, contextUpdate on screen changes, WebView quirks, native permission handling.
 */

export async function sha384(buffer) {
  const digest = await crypto.subtle.digest('SHA-384', buffer);
  let bin = '';
  for (const b of new Uint8Array(digest)) bin += String.fromCharCode(b);
  return `sha384-${btoa(bin)}`;
}

function randomNonce() {
  return btoa(
    String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))),
  );
}

/**
 * Fetches a loader the way the device would and reports why it would fail.
 * Returns { ok, integrity?, bytes?, problem? }.
 */
export async function probeScript(url) {
  try {
    const head = await fetch(url, { cache: 'no-store', redirect: 'manual' });
    if (head.type === 'opaqueredirect') {
      return {
        ok: false,
        problem: `${url} redirects (often to a sign-in page). The app needs the file itself at a public URL.`,
      };
    }
    if (!head.ok)
      return { ok: false, problem: `${url} returned HTTP ${head.status}.` };
    const bytes = await head.arrayBuffer();
    if (!bytes.byteLength)
      return { ok: false, problem: `${url} returned an empty body.` };
    return {
      ok: true,
      integrity: await sha384(bytes),
      bytes: bytes.byteLength,
    };
  } catch {
    return {
      ok: false,
      problem: `${url} could not be fetched from the browser: the host is unreachable, redirects (for example to a sign-in page), or does not send Access-Control-Allow-Origin. The app needs the file itself, with CORS, to verify the hash.`,
    };
  }
}

/**
 * Starts one aspect in `slot`.
 *
 * opts = {
 *   submission,            // from normalizeSubmission()
 *   bootstrapUrl,          // absolute URL of the aspect extension
 *   scripts,               // { [key]: { url, integrity } } as the runtime should load them
 *   setScriptKeyGlobal,    // set window.__ASPECT_SCRIPT_KEY__ before each loader runs
 *   evaluateTwice,         // inject the loader a second time to test run-once guards
 *   log(level, message),   // level: ok | info | warn | bad
 *   onMessage(action, payload),
 *   onHandle(handle)  called with the handle before the aspect extension runs,
 *   onLoaderLoaded(key),
 *   isCurrent(),           // optional: false once a newer run has started
 * }
 * Returns { frame, nonce, postToAspect(action, payload), startedAt }.
 */
export async function startAspect(slot, opts) {
  const { submission, log } = opts;
  const nonce = randomNonce();
  const csp = submission.csp.replace(/'nonce-aspect'/g, `'nonce-${nonce}'`);
  const cspMeta = `<meta http-equiv="Content-Security-Policy" content="${csp.replace(
    /"/g,
    '&quot;',
  )}">`;

  const bootstrapProbe = await probeScript(opts.bootstrapUrl);
  // A newer run started while we were fetching: don't add a second frame to the slot.
  if (opts.isCurrent && !opts.isCurrent()) return null;
  if (!bootstrapProbe.ok) {
    log('bad', `aspect extension: ${bootstrapProbe.problem}`);
    return null;
  }

  // The host shell. srcdoc without a sandbox attribute keeps this page's origin, as the app's web view
  // keeps the FI origin.
  const host = document.createElement('iframe');
  host.setAttribute('title', `${submission.name || 'aspect'} host shell`);
  host.style.cssText =
    'width:100%;height:100%;border:0;display:block;background:transparent';
  host.srcdoc = `<!doctype html><html style="height:100%"><head>${cspMeta}</head><body style="margin:0;height:100%"></body></html>`;
  slot.appendChild(host);
  await new Promise((resolve) =>
    host.addEventListener('load', resolve, { once: true }),
  );
  // A newer run started while the frame loaded: remove this one and stop.
  if (opts.isCurrent && !opts.isCurrent()) {
    host.remove();
    return null;
  }
  const hw = host.contentWindow;
  const hdoc = host.contentDocument;
  const reportCsp = (e) =>
    log(
      'bad',
      `CSP blocked ${e.blockedURI || 'inline code'} (${e.effectiveDirective})`,
    );
  hdoc.addEventListener('securitypolicyviolation', reportCsp);

  let sandbox = null;
  const handle = {
    frame: host,
    nonce,
    startedAt: Date.now(),
    postToAspect(action, payload) {
      const data = {
        type: 'ASPECT_MESSAGE',
        version: '1.0',
        aspectId: submission.name,
        action,
        payload,
        direction: 'hostToAspect',
      };
      // As in the apps (dbk.__receiveHostMessage): to the sandbox, and on the host shell itself as a
      // created event, which has no source and no origin.
      const sw = sandbox?.contentWindow;
      // The app posts from the host shell. A message posted from this page would have this page as
      // its source, so build the event the sandbox would get: source = host shell, same origin.
      if (sw) {
        sw.dispatchEvent(
          new sw.MessageEvent('message', {
            data,
            origin: location.origin,
            source: hw,
          }),
        );
      }
      hw.dispatchEvent(new hw.MessageEvent('message', { data }));
    },
  };

  function inject(doc, url, integrity, attrs = {}) {
    return new Promise((resolve, reject) => {
      const s = doc.createElement('script');
      for (const [k, v] of Object.entries(attrs)) {
        try {
          s.setAttribute(k, v);
        } catch {
          log(
            'warn',
            `HTML attribute "${k}" is not a valid attribute name and was skipped`,
          );
        }
      }
      s.src = url;
      s.integrity = integrity;
      s.crossOrigin = 'anonymous';
      s.nonce = nonce;
      s.onload = resolve;
      s.onerror = () =>
        reject(new Error('blocked: SRI mismatch, CSP, or network'));
      (doc.head ?? doc.body).appendChild(s);
    });
  }

  // HTML Attributes as the apps apply them: never src, integrity, nonce, crossorigin,
  // data-aspect-config or an event handler; Data Attributes go in data-aspect-config as JSON.
  function loaderAttributes(key) {
    const attrs = {};
    for (const [k, v] of Object.entries(submission.scripts[key]?.html ?? {})) {
      const name = k.toLowerCase();
      if (
        [
          'src',
          'integrity',
          'nonce',
          'crossorigin',
          'data-aspect-config',
        ].includes(name) ||
        name.startsWith('on')
      ) {
        log('warn', `HTML attribute "${k}" is ignored by the app`);
        continue;
      }
      attrs[k] = v;
    }
    attrs['data-aspect-config'] = JSON.stringify(
      submission.scripts[key]?.data ?? {},
    );
    return attrs;
  }

  async function ensureSandbox() {
    if (sandbox) return sandbox;
    const frame = hdoc.createElement('iframe');
    frame.setAttribute('sandbox', 'allow-scripts allow-same-origin');
    frame.setAttribute('title', `${submission.name || 'aspect'} sandbox`);
    frame.style.cssText =
      'border:0;display:block;width:100%;height:100%;background:transparent';
    frame.srcdoc = `<!doctype html><html><head>${cspMeta}</head><body></body></html>`;
    hdoc.body.appendChild(frame);
    await new Promise((resolve) =>
      frame.addEventListener('load', resolve, { once: true }),
    );
    // The apps share dbk into the sandbox too.
    frame.contentWindow.dbk = bridge;
    frame.contentDocument.addEventListener(
      'securitypolicyviolation',
      reportCsp,
    );
    sandbox = frame;
    return frame;
  }

  const bridge = {
    sessionInfo() {
      // The apps return { userGuid, locale, isMobileFlow: true } (aspect_runtime_loader.js).
      log(
        'info',
        'aspect called dbk.sessionInfo(). On a device it returns { userGuid, locale, isMobileFlow: true }; userGuid is left out here.',
      );
      return { locale: navigator.language || 'en', isMobileFlow: true };
    },
    getLocale: () => navigator.language || 'en',
    // A subset of the descriptor the apps return: the resolved displayAuthority and the aspect
    // properties as flat strings.
    getAspectConfig: () => ({
      name: submission.name,
      type: submission.type,
      placementId: submission.placement,
      placement: { id: submission.placement, size: submission.size },
      displayAuthority: submission.displayAuthority,
      mountStrategy: submission.mountStrategy,
      frequency: submission.frequency,
      properties: { ...submission.aspectProperties },
    }),
    getAspectScriptConfig(key) {
      const s = submission.scripts[key];
      return s
        ? { scriptKey: key, script: { url: s.url, scriptData: { ...s.data } } }
        : null;
    },
    // The apps' helper defaults (aspect_runtime_loader.js): a bare chatbotOpen() is a FAB tap, a
    // bare chatbotMinimize() a user minimize, navigate('url') becomes { url }, others default to {}.
    chatbotOpen: (p) =>
      opts.onMessage('chatbotOpen', p ?? { reason: 'user_clicked_fab' }),
    chatbotMinimize: (p) =>
      opts.onMessage('chatbotMinimize', p ?? { status: 'user_minimized' }),
    modalOpen: (p) => opts.onMessage('modalOpen', p ?? {}),
    modalDismiss: (p) => opts.onMessage('modalDismiss', p ?? {}),
    navigate: (p) =>
      opts.onMessage(
        'navigate',
        typeof p === 'string' ? { url: p } : (p ?? {}),
      ),
    postToHost: (action, payload) => opts.onMessage(action, payload ?? {}),
    async loadSecureExternalScript(key) {
      const entry = opts.scripts[key];
      if (!entry) {
        const known =
          Object.keys(opts.scripts)
            .map((k) => `"${k}"`)
            .join(', ') || 'none';
        log(
          'bad',
          `loadSecureExternalScript("${key}"): no loader registered under that Script Name (registered: ${known}). Nothing will render.`,
        );
        throw new Error(`No script registered for key ${key}`);
      }
      const frame = await ensureSandbox();
      const doc = frame.contentDocument;
      if (opts.setScriptKeyGlobal)
        frame.contentWindow.__ASPECT_SCRIPT_KEY__ = key;
      const attrs = loaderAttributes(key);
      try {
        await inject(doc, entry.url, entry.integrity, attrs);
      } catch (err) {
        log(
          'bad',
          `loader "${key}" ${err.message}. On a device the aspect simply does not appear.`,
        );
        throw err;
      }
      log('ok', `loader "${key}" loaded and passed SRI`);
      opts.onLoaderLoaded?.(key);
      if (opts.evaluateTwice) {
        await inject(doc, entry.url, entry.integrity, attrs).catch(() => {});
        const roots = doc.body.querySelectorAll(':scope > :not(script)').length;
        log(
          roots === 1 ? 'ok' : 'bad',
          `loader evaluated twice: ${roots} root element(s) in the sandbox (expect 1)`,
        );
      }
      return { scriptKey: key };
    },
  };

  // The relay, as in the apps: same-origin messages from the host shell itself or the sandbox go to
  // the app when they are an ASPECT_MESSAGE or carry an action; hostToAspect ones never do.
  hw.addEventListener('message', (ev) => {
    if (ev.origin !== location.origin) return;
    if (ev.source !== hw && !(sandbox && ev.source === sandbox.contentWindow))
      return;
    const d = ev.data;
    if (!d || d.direction === 'hostToAspect') return;
    if (d.type === 'ASPECT_MESSAGE' || d.action) {
      opts.onMessage(
        d.action || (d.type !== 'ASPECT_MESSAGE' ? d.type : undefined),
        d.payload || {},
      );
    }
  });

  // Stand-in for the app's token bridge, in Android's JSBridge shape. iOS has no JSBridge: there the
  // same JSON string goes to webkit.messageHandlers.tokenApiDetails.postMessage. The rules differ:
  //   iOS: https on the bank's host, its subdomains or the API host; drops extra fields and methods
  //        other than GET/POST; ignores request headers and always adds the bank session.
  //   Android: https on the bank's host or the API host exactly; ignores extra fields; sends the
  //        bank session only when the request has an empty Cookie header.
  // Both put any JSON answer (an HTTP error body too) on dbk.tokenResponse and fire apiToken:ready
  // on the host shell (the runtime passes it on to the sandbox), and send nothing on a refusal, a
  // network error or a non-JSON answer.
  hw.JSBridge = {
    tokenApiDetails(json) {
      let req;
      try {
        req = JSON.parse(json);
      } catch {
        log('bad', 'tokenApiDetails: not JSON; the app drops it');
        return;
      }
      const extra = Object.keys(req ?? {}).find(
        (k) => !['url', 'method', 'headers'].includes(k),
      );
      if (extra) {
        log(
          'bad',
          `tokenApiDetails: unknown field "${extra}"; iOS drops the request (Android ignores the field). Send only url, method and headers.`,
        );
        return;
      }
      let url;
      try {
        url = new URL(req.url);
      } catch {
        log('bad', 'tokenApiDetails: invalid url; the app drops it');
        return;
      }
      if (url.host !== location.host) {
        log(
          'bad',
          `tokenApiDetails: ${url.host} is not your bank's host (iOS also allows its subdomains) or the API host; the app refuses it and never answers`,
        );
        return;
      }
      const method = String(req.method ?? 'GET').toUpperCase();
      if (method !== 'GET' && method !== 'POST') {
        log(
          'bad',
          `tokenApiDetails: method ${method}; iOS drops it (use GET or POST)`,
        );
        return;
      }
      log(
        'info',
        `tokenApiDetails -> ${method} ${url.pathname}. On a device the URL must be https; iOS adds the bank session itself, Android only when headers has Cookie: "".`,
      );
      fetch(url, {
        method,
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      })
        .then((r) => r.json())
        .then((body) => {
          bridge.tokenResponse = body;
          hw.dispatchEvent(new Event('apiToken:ready'));
          sandbox?.contentWindow?.dispatchEvent(new Event('apiToken:ready'));
          log(
            body?.token_type ? 'ok' : 'warn',
            body?.token_type
              ? `tokenApiDetails answered (token_type: ${body.token_type})`
              : `tokenApiDetails answered with an error: ${body?.statusCode ?? ''} ${body?.error ?? ''}`.trim(),
          );
        })
        .catch(() =>
          log(
            'warn',
            'tokenApiDetails: network error or non-JSON answer; the app sends nothing back, so use a timeout',
          ),
        );
    },
  };

  hw.dbk = bridge;

  opts.onHandle?.(handle);
  try {
    // DevX hosts the aspect extension and computes its hash, so use the hash of what was served.
    await inject(hdoc, opts.bootstrapUrl, bootstrapProbe.integrity);
    log('ok', 'aspect extension loaded');
  } catch (err) {
    log('bad', `aspect extension ${err.message}`);
  }
  return handle;
}
