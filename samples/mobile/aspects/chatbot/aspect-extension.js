/* eslint-disable no-console */
// Template - Mobile V2 Chatbot aspect extension with optional OIDC identity handoff.
// Paste this into the console "Code submission" field. The Developer Console hosts it as `sourceUrl` and computes `sourceSRI`.
// In the FI extensions repo it is committed as aspects/mobile/<component-name>/<component-name>.js.
// Roles, message bus and rules: samples/mobile/aspects/ARCHITECTURE.md.
//
// Where it runs: the app's host shell (FI origin, outside the sandbox). The app's runtime defines
// window.dbk in this frame before it injects this file; the static loader runs one level down, in the
// sandbox iframe, and never talks to the app itself.
//
// Responsibilities (and nothing else):
//   1. Identity broker. When the aspect properties `oidcClientId` and `redirectUrl` are set, ask the FI
//      token endpoint for a one-time authorization code through the app's native `tokenApiDetails`
//      bridge (the app adds the bank session itself), then POST that code to redirectUrl (your backend),
//      which exchanges it server-side and answers with a session scoped to your service.
//      The code never leaves this file except to redirectUrl. No client secret, no Candescent token and
//      no FI cookie is ever read or stored here.
//   2. The only link to the app, both ways. Actions the UI asks for arrive from the loader as
//      `hostAction`; each is checked against the manifest chatbot aspectToHost schema, then sent with
//      dbk.postToHost, or refused back to the loader as `messageRejected`. Messages from the app
//      (chatbotOpen, contextUpdate, chatbotMinimize) are read on this window and passed to the loader
//      as `hostMessage`.
//   3. Answer the loader on the aspect extension channel: `init` (settings from the aspect properties and the
//      identity so far), then `identityUpdate`. The loader asks with `hello` and `identityRefresh`.
//   4. Load the SRI-pinned static loader registered under Script Name. It starts at once, so the UI is
//      never held up by the identity handoff.
//
// Must not: render UI, post on this window (the runtime relays every same-window message to the app,
// so use dbk), or call any other host via the bridge.
(function () {
  'use strict';

  var LOG = '[chatbot]';
  // MUST equal the form's "Script Name" exactly. Keep it all-lowercase so the casing always matches.
  var staticLoaderKey = 'chatbot';
  // The aspect token endpoint on the FI domain.
  var TOKEN_PATH = '/feng-bff/live/v1/aspect/token';
  // Aspect extension <-> loader channel. Not an ASPECT_MESSAGE and has no `action` key, so the runtime's relay
  // never forwards it to the app.
  var CHANNEL = 'ASPECT_EXTENSION';
  // The app's own envelope. Only this file sends it (with dbk.postToHost) and receives it.
  var ENVELOPE = 'ASPECT_MESSAGE';
  var MAX_QUEUED = 20;
  // Copy of the mobile manifest (schemaVersion 2.0.0) chatbot message bus. The app refuses any action
  // not listed and any payload key not in its schema (a missing additionalProperties counts as false).
  var ASPECT_TO_HOST = {
    chatbotOpen: {
      required: ['reason'],
      props: {
        reason: [
          'user_clicked_fab',
          'proactive_engagement',
          'new_message_received',
        ],
      },
    },
    chatbotMinimize: {
      required: ['status'],
      props: { status: ['user_minimized', 'session_ended'] },
    },
    navigate: { required: ['url'], props: { url: 'url' } },
  };
  var HOST_TO_ASPECT = {
    chatbotOpen: true,
    contextUpdate: true,
    chatbotMinimize: true,
  };

  var dbk = window.dbk;
  var aspect = dbk.getAspectConfig() || {};

  // Aspect properties: flat strings. Key casing can change on the way to the app, so match any case.
  function property(name) {
    var props = aspect.properties || {};
    var wanted = name.toLowerCase();
    for (var key in props) {
      if (
        Object.prototype.hasOwnProperty.call(props, key) &&
        key.toLowerCase() === wanted
      )
        return props[key];
    }
    return undefined;
  }

  // Values are checked by the submission form; a missing one falls back to the default.
  function msProperty(name, fallback) {
    var value = Number(property(name));
    return value > 0 ? value : fallback;
  }

  var clientId = property('oidcClientId');
  var redirectUrl = property('redirectUrl');
  var TOKEN_TIMEOUT_MS = msProperty('tokenTimeoutMs', 5000);
  var REDIRECT_TIMEOUT_MS = msProperty('redirectTimeoutMs', 5000);
  // A refresh asked for sooner than this after the last attempt returns the last result.
  var REFRESH_INTERVAL_MS = msProperty('refreshIntervalMs', 30000);
  // Passed to the loader for its runtime config fetch.
  var CONFIG_TIMEOUT_MS = msProperty('configTimeoutMs', 8000);

  // ---------- identity broker ----------
  function failure(reason, retry) {
    var error = new Error(reason);
    error.reason = reason;
    error.retry = retry;
    return error;
  }

  // Why the token endpoint gave no code. Its errors are { statusCode, error, message, details }, and the
  // app hands over the JSON body only, without the HTTP status. `retry` says whether a refresh can help.
  function codeFailure(body) {
    var error = body && body.error;
    var detail = body && body.details && body.details.code;
    // 401: no bank session, or it expired.
    if (error === 'SessionUnauthorizedException')
      return failure('session_expired', false);
    // 400: clientId missing or malformed.
    if (error === 'ValidationException')
      return failure('invalid_client_id', false);
    if (error === 'ClientUnauthorizedException') {
      // 401 CMN_90007: the client id is not registered for this FI and environment. Every other step of
      // minting the code (integration lookup, token service, circuit breaker) fails with this type too.
      return detail === 'CMN_90007'
        ? failure('client_not_authorized', false)
        : failure('code_unavailable', true);
    }
    if (body && body.statusCode === 404)
      return failure('token_endpoint_not_found', false);
    // 5xx and any other answer.
    return failure('code_unavailable', true);
  }

  function withTimeout(promise, ms, reason) {
    var timer;
    return Promise.race([
      promise,
      new Promise(function (resolve, reject) {
        timer = setTimeout(function () {
          reject(failure(reason, true));
        }, ms);
      }),
    ]).then(
      function (v) {
        clearTimeout(timer);
        return v;
      },
      function (e) {
        clearTimeout(timer);
        throw e;
      },
    );
  }

  // The app's token bridge. iOS: webkit.messageHandlers.tokenApiDetails; Android: JSBridge.
  // The app fetches the URL natively with the bank session (https, FI host or API host only), puts the
  // JSON body on dbk.tokenResponse and fires `apiToken:ready` on this window.
  function tokenBridge() {
    var ios =
      window.webkit &&
      window.webkit.messageHandlers &&
      window.webkit.messageHandlers.tokenApiDetails;
    if (ios)
      return function (json) {
        ios.postMessage(json);
      };
    if (
      window.JSBridge &&
      typeof window.JSBridge.tokenApiDetails === 'function'
    ) {
      return function (json) {
        window.JSBridge.tokenApiDetails(json);
      };
    }
    return null;
  }

  // The host shell is loaded with the FI origin as its base URL. location.origin is "null" in a srcdoc
  // frame (the local preview), so prefer window.origin.
  function fiOrigin() {
    return window.origin && window.origin !== 'null'
      ? window.origin
      : window.location.origin;
  }

  // dbk.tokenResponse is one shared slot, so this file is the only caller of the bridge. The listener
  // is removed on the answer and on timeout alike, so a late answer can't be taken by a stale request.
  function requestCode() {
    var send = tokenBridge();
    if (!send) return Promise.reject(failure('no_token_bridge', false));
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () {
        window.removeEventListener('apiToken:ready', onReady);
        // The app answers nothing when it refuses the URL, the network fails or the body is not JSON.
        reject(failure('code_timeout', true));
      }, TOKEN_TIMEOUT_MS);
      function onReady() {
        clearTimeout(timer);
        window.removeEventListener('apiToken:ready', onReady);
        var r = dbk.tokenResponse;
        dbk.tokenResponse = undefined;
        if (
          r &&
          r.token_type === 'authorization_code' &&
          typeof r.token === 'string' &&
          r.token
        )
          resolve(r.token);
        else reject(codeFailure(r));
      }
      dbk.tokenResponse = undefined;
      window.addEventListener('apiToken:ready', onReady);
      // An empty Cookie header asks Android to attach the bank session itself (iOS always does and
      // ignores headers). Never copy document.cookie: the session cookies are HttpOnly anyway.
      send(
        JSON.stringify({
          url:
            fiOrigin() +
            TOKEN_PATH +
            '?clientId=' +
            encodeURIComponent(clientId),
          method: 'GET',
          headers: { Cookie: '' },
        }),
      );
    });
  }

  // Your backend exchanges the code with Candescent (its client secret stays there), validates the ID
  // token and answers with its own short-lived session: { sessionToken, expiresIn }.
  function exchangeCode(code) {
    return fetch(redirectUrl, {
      method: 'POST',
      credentials: 'omit',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ code: code }),
    })
      .then(
        function (res) {
          // A new code can fix a 4xx too (an expired or reused code), so every answer may be retried.
          if (!res.ok) throw failure('redirect_http_' + res.status, true);
          return res.json();
        },
        function () {
          // Network, CORS or connect-src.
          throw failure('redirect_unreachable', true);
        },
      )
      .then(function (s) {
        if (
          !s ||
          typeof s.sessionToken !== 'string' ||
          !s.sessionToken ||
          typeof s.expiresIn !== 'number' ||
          s.expiresIn <= 0
        )
          throw failure('redirect_bad_response', true);
        return {
          status: 'ok',
          sessionToken: s.sessionToken,
          expiresAt: Date.now() + s.expiresIn * 1000,
        };
      });
  }

  var identity =
    clientId && redirectUrl ? { status: 'pending' } : { status: 'none' };
  var canRetry = true;
  var lastAttempt = 0;
  var inFlight = false;
  var loader = null;

  function send(name, payload) {
    if (loader)
      loader.postMessage(
        {
          type: CHANNEL,
          version: '1.0',
          direction: 'extensionToLoader',
          name: name,
          payload: payload,
        },
        fiOrigin(),
      );
  }

  // Starts a handoff unless identity is off, one is running, the last failure can't be retried or the
  // last attempt was too recent. Returns whether it started.
  function runHandoff() {
    if (identity.status === 'none' || inFlight || !canRetry) return false;
    if (lastAttempt && Date.now() - lastAttempt < REFRESH_INTERVAL_MS)
      return false;
    inFlight = true;
    lastAttempt = Date.now();
    requestCode()
      .then(function (code) {
        return withTimeout(
          exchangeCode(code),
          REDIRECT_TIMEOUT_MS,
          'redirect_timeout',
        );
      })
      .then(
        function (result) {
          identity = result;
        },
        function (err) {
          var reason = (err && err.reason) || 'failed';
          canRetry = !(err && err.retry === false);
          // Never log the code or the session; the reason is enough.
          console.warn(LOG, 'identity handoff failed:', reason);
          identity = { status: 'failed', reason: reason };
        },
      )
      .then(function () {
        inFlight = false;
        send('identityUpdate', { identity: identity });
      });
    return true;
  }

  // ---------- the app's message bus ----------
  function isNavigateUrl(v) {
    // An https link (the app opens it only on the bank's host or a host in this aspect's CSP frame-src /
    // connect-src), an in-app route such as /app/home, or feature:<featureId>.
    return (
      typeof v === 'string' &&
      v.length <= 2048 &&
      (/^https:\/\/[^\s]+$/i.test(v) ||
        /^\/[^\s/][^\s]*$/.test(v) ||
        /^feature:\s*[A-Za-z0-9._-]+\s*$/i.test(v))
    );
  }

  // Returns why the app would refuse `payload` for `spec`, or null.
  function payloadProblem(spec, payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload))
      return 'payload must be an object';
    for (var i = 0; i < spec.required.length; i++) {
      if (!Object.prototype.hasOwnProperty.call(payload, spec.required[i]))
        return spec.required[i] + ' is required';
    }
    for (var key in payload) {
      if (!Object.prototype.hasOwnProperty.call(payload, key)) continue;
      var rule = spec.props[key];
      var value = payload[key];
      if (!rule) return key + ' is not allowed';
      if (rule === 'url' && !isNavigateUrl(value))
        return 'url must be https, an in-app route or feature:<id>';
      if (Array.isArray(rule) && rule.indexOf(value) === -1)
        return key + ' must be one of ' + rule.join(', ');
    }
    return null;
  }

  // An action the UI asked for, from the loader. Refused ones go back to the UI instead of being
  // dropped silently by the app.
  function onHostAction(request) {
    var action =
      request && typeof request.action === 'string'
        ? request.action.slice(0, 64)
        : '';
    var spec = Object.prototype.hasOwnProperty.call(ASPECT_TO_HOST, action)
      ? ASPECT_TO_HOST[action]
      : null;
    var problem = spec
      ? payloadProblem(spec, request.payload)
      : 'not in the chatbot aspectToHost message bus';
    if (problem) {
      console.warn(LOG, 'refused', action + ':', problem);
      send('messageRejected', { action: action, reason: problem });
      return;
    }
    // The app checks it against the manifest again.
    dbk.postToHost(action, request.payload);
  }

  // The runtime hands the app's messages to this window as events it creates itself, so they have no
  // source and no origin; a postMessage from any frame always has both.
  function isHostMessage(event) {
    var d = event.data;
    return (
      !event.source &&
      !event.origin &&
      d.type === ENVELOPE &&
      d.direction === 'hostToAspect' &&
      typeof d.action === 'string' &&
      Object.prototype.hasOwnProperty.call(HOST_TO_ASPECT, d.action)
    );
  }

  // The app sends its opening chatbotOpen as soon as the loader has loaded, which can be before the
  // loader says hello, so messages are kept (up to MAX_QUEUED) until then.
  var hostQueue = [];
  function onHostMessage(d) {
    var message = {
      action: d.action,
      payload: d.payload && typeof d.payload === 'object' ? d.payload : {},
    };
    if (loader) send('hostMessage', message);
    else if (hostQueue.length < MAX_QUEUED) hostQueue.push(message);
  }

  window.addEventListener('message', function (event) {
    var d = event.data;
    if (!d || typeof d !== 'object') return;
    if (isHostMessage(event)) {
      onHostMessage(d);
      return;
    }
    // Otherwise only the runtime's sandbox talks here: a child frame of this window, on this (FI) origin.
    if (d.type !== CHANNEL || d.direction !== 'loaderToExtension') return;
    if (
      event.origin !== fiOrigin() ||
      !event.source ||
      event.source === window ||
      event.source.parent !== window
    )
      return;
    if (d.name === 'hello') {
      loader = event.source;
      send('init', { configTimeoutMs: CONFIG_TIMEOUT_MS, identity: identity });
      var pending = hostQueue;
      hostQueue = [];
      for (var i = 0; i < pending.length; i++) send('hostMessage', pending[i]);
      return;
    }
    if (event.source !== loader) return;
    if (d.name === 'identityRefresh' && !runHandoff())
      send('identityUpdate', { identity: identity });
    else if (d.name === 'hostAction') onHostAction(d.payload);
  });
  runHandoff();

  // ---------- static loader ----------
  dbk.loadSecureExternalScript(staticLoaderKey);
})();
