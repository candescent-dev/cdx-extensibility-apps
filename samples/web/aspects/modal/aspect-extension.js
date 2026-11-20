/* eslint-disable no-console */
/**
 * Modal aspect extension, host_immediate card activation banner (web).
 *
 * Runs in the aspect's sandbox iframe on the FI origin. dbk.loadSecureExternalScript
 * adds the static loader to this same document, so the extension and the loader
 * share one window. This file is the only piece that talks to the host.
 *
 * It does four things:
 *   1. Loads the static loader.
 *   2. Brokers the optional OIDC identity: a one-time code from the FI token
 *      endpoint, exchanged by your backend (redirectUrl) for your own session.
 *   3. Relays messages between the loader and the host:
 *      - aspectToHost: the loader's `hostAction` ({ action, payload }) is checked against the
 *        manifest modal aspectToHost schema and the modal lifecycle, then posted to window.parent
 *        as { type: 'ASPECT_MESSAGE', version, aspectId, action, payload }, or refused back to the
 *        loader as `messageRejected` ({ action, reason }).
 *      - hostToAspect: { type: 'ASPECT_MESSAGE', aspectId, action, payload } from window.parent on
 *        the FI origin is checked against the manifest modal hostToAspect actions and passed to the
 *        loader as `hostMessage` ({ action, payload }). Messages that arrive before the loader's
 *        `hello` are queued.
 *   4. Keeps the modal lifecycle: one modalOpen, inside the host's open window (partner_delegated:
 *      15 s from when the host starts loading the aspect, counted here from this file's start with a
 *      2 s margin), nothing after a dismiss until the host's next modalOpen (a new display). A
 *      host_immediate modal is shown by the host itself, so it counts as shown from the start.
 *
 * Loader <-> extension channel: a same-window CustomEvent 'ASPECT_EXTENSION' with detail
 * { type, version, direction, name, payload }. loaderToExtension: hello, identityRefresh,
 * hostAction. extensionToLoader: init, identityUpdate, hostMessage, messageRejected.
 * The identity never goes through postMessage or storage.
 *
 * aspect.properties (data-aspect-properties JSON; key case is ignored):
 *   staticLoaderKey    required  Script Name of the static loader
 *   oidcClientId       optional  OIDC client id (legacy key: clientId)
 *   redirectUrl        optional  https (http://localhost in local dev); POST {code} -> {sessionToken, expiresIn}
 *   tokenPath          optional  default /feng-bff/live/v1/aspect/token
 *   tokenTimeoutMs     optional  default 5000
 *   redirectTimeoutMs  optional  default 5000
 *   refreshIntervalMs  optional  default 30000
 *   configTimeoutMs    optional  passed to the loader in init, default 8000
 * Without oidcClientId and redirectUrl the identity is { status: 'none' }.
 */
(function () {
  'use strict';

  var LOG_PREFIX = '[CardActivationBannerExtension]';
  var CHANNEL = 'ASPECT_EXTENSION';
  var CHANNEL_VERSION = '1.0';
  var DEFAULT_TOKEN_PATH = '/feng-bff/live/v1/aspect/token';
  var HOST_ENVELOPE = 'ASPECT_MESSAGE';
  var HOST_ENVELOPE_VERSION = '1.0';
  // This template is a host_immediate modal; used when the aspect record has no displayAuthority.
  var DEFAULT_DISPLAY_AUTHORITY = 'host_immediate';
  // The host shows a partner_delegated modal only if modalOpen arrives within 15 s of it starting to
  // load the aspect. The clock starts when this file runs; the 2 s margin covers the time before that.
  var OPEN_DEADLINE_MS = 13000;
  // Manifest modal aspectToHost. `required` keys must be present; keys not in `props` are refused
  // unless `extra` is true. A props rule is 'string' (non-empty), 'object', or a list of allowed values.
  var ASPECT_TO_HOST = {
    modalOpen: { required: ['reason'], props: { reason: 'string' } },
    modalDismiss: {
      required: ['status'],
      props: { status: ['success', 'cancelled', 'error'], actionData: 'object' },
    },
    navigate: { required: ['url'], props: { url: 'string' } },
  };
  // Manifest modal hostToAspect (payload: any object).
  var HOST_TO_ASPECT = { modalOpen: true };
  var MAX_QUEUED = 20;
  // A second copy in the same sandbox would add its own listeners and relay every message twice.
  var INIT_FLAG = '__modalHostAspectExtensionInit';

  if (window[INIT_FLAG]) {
    console.warn(LOG_PREFIX + ' already running in this sandbox; skipped');
    return;
  }
  window[INIT_FLAG] = true;

  var currentScript = document.currentScript;
  var properties = readProperties(currentScript);
  var dbk = window.dbk;
  var aspectId =
    (currentScript && currentScript.getAttribute('data-aspect-id')) || (dbk && dbk.__aspectId) || '';
  var fiOrigin = window.location.origin;
  var openDeadlineAt = null;
  var loaderReady = false;
  var hostQueue = [];
  var staticLoaderKey = stringProperty('staticloaderkey');
  var clientId = stringProperty('oidcclientid') || stringProperty('clientid');
  var redirectUrl = stringProperty('redirecturl');
  var tokenPath = stringProperty('tokenpath') || DEFAULT_TOKEN_PATH;
  var tokenTimeoutMs = msProperty('tokentimeoutms', 5000);
  var redirectTimeoutMs = msProperty('redirecttimeoutms', 5000);
  var refreshIntervalMs = msProperty('refreshintervalms', 30000);
  var configTimeoutMs = msProperty('configtimeoutms', 8000);
  var identityEnabled = Boolean(clientId && redirectUrl);

  var identity = { status: identityEnabled ? 'pending' : 'none' };
  var inFlight = false;
  var lastAttemptAt = 0;
  var lastFailureRetry = true;

  function readProperties(script) {
    var raw = script && script.getAttribute('data-aspect-properties');
    var parsed;

    if (!raw) {
      return {};
    }

    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      console.error(LOG_PREFIX + ' data-aspect-properties is not valid JSON');
      return {};
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    return Object.keys(parsed).reduce(function (result, key) {
      result[key.toLowerCase()] = parsed[key];
      return result;
    }, {});
  }

  function stringProperty(name) {
    var value = properties[name];
    return typeof value === 'string' ? value.trim() : '';
  }

  function msProperty(name, fallback) {
    var value = Number(properties[name]);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
  }

  // http is accepted only for localhost, and only while OLB itself runs on localhost.
  function isAllowedRedirectUrl(value) {
    try {
      var url = new URL(value);

      return (
        url.protocol === 'https:' ||
        (url.protocol === 'http:' &&
          url.hostname === 'localhost' &&
          window.location.hostname === 'localhost')
      );
    } catch (error) {
      return false;
    }
  }

  function failure(reason, retry) {
    var error = new Error(reason);
    error.reason = reason;
    error.retry = retry;
    return error;
  }

  function newCorrelationId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }

    return Date.now().toString(16) + Math.random().toString(16).slice(2);
  }

  function withTimeout(run, timeoutMs, timeoutReason) {
    var controller = typeof AbortController === 'function' ? new AbortController() : undefined;
    var timer;

    return Promise.race([
      run(controller && controller.signal),
      new Promise(function (resolve, reject) {
        timer = setTimeout(function () {
          if (controller) {
            controller.abort();
          }
          reject(failure(timeoutReason, true));
        }, timeoutMs);
      }),
    ]).finally(function () {
      clearTimeout(timer);
    });
  }

  // The token endpoint answers { statusCode, error, message, details } on failure.
  function codeFailure(status, body) {
    var error = body && body.error;
    var detail = body && body.details && body.details.code;

    if (error === 'SessionUnauthorizedException') {
      return failure('session_expired', false);
    }
    if (error === 'ValidationException') {
      return failure('invalid_client_id', false);
    }
    if (error === 'ClientUnauthorizedException') {
      return detail === 'CMN_90007'
        ? failure('client_not_authorized', false)
        : failure('code_unavailable', true);
    }
    if (status === 404 || (body && body.statusCode === 404)) {
      return failure('token_endpoint_not_found', false);
    }
    return failure('code_unavailable', true);
  }

  function requestCode() {
    var url =
      window.location.origin + tokenPath + '?clientId=' + encodeURIComponent(clientId);

    return withTimeout(
      function (signal) {
        return fetch(url, {
          method: 'GET',
          credentials: 'include',
          headers: { Accept: 'application/json', correlationId: newCorrelationId() },
          signal: signal,
        }).then(
          function (response) {
            return response.json().then(
              function (body) {
                return { status: response.status, ok: response.ok, body: body };
              },
              function () {
                throw failure('code_unavailable', true);
              },
            );
          },
          function () {
            throw failure('code_timeout', true);
          },
        );
      },
      tokenTimeoutMs,
      'code_timeout',
    ).then(function (result) {
      var body = result.body;

      if (
        result.ok &&
        body &&
        typeof body.token === 'string' &&
        body.token &&
        (!body.token_type || body.token_type === 'authorization_code')
      ) {
        return body.token;
      }

      throw codeFailure(result.status, body);
    });
  }

  function exchangeCode(code) {
    return withTimeout(
      function (signal) {
        return fetch(redirectUrl, {
          method: 'POST',
          credentials: 'omit',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ code: code }),
          signal: signal,
        }).then(
          function (response) {
            if (!response.ok) {
              throw failure('redirect_http_' + response.status, true);
            }

            return response.json().catch(function () {
              throw failure('redirect_bad_response', true);
            });
          },
          function () {
            throw failure('redirect_unreachable', true);
          },
        );
      },
      redirectTimeoutMs,
      'redirect_timeout',
    ).then(function (session) {
      var expiresIn = Number(session && session.expiresIn);
      if (
        !session ||
        typeof session.sessionToken !== 'string' ||
        !session.sessionToken ||
        !Number.isFinite(expiresIn) ||
        expiresIn <= 0
      ) {
        throw failure('redirect_bad_response', true);
      }

      return {
        status: 'ok',
        sessionToken: session.sessionToken,
        expiresAt: Date.now() + expiresIn * 1000,
      };
    });
  }

  function send(name, payload) {
    window.dispatchEvent(
      new CustomEvent(CHANNEL, {
        detail: {
          type: CHANNEL,
          version: CHANNEL_VERSION,
          direction: 'extensionToLoader',
          name: name,
          payload: payload,
        },
      }),
    );
  }

  function publishIdentity(next) {
    identity = next;

    if (loaderReady) {
      send('identityUpdate', { identity: identity });
    }
  }

  function runHandoff() {
    inFlight = true;
    lastAttemptAt = Date.now();

    return requestCode()
      .then(exchangeCode)
      .then(
        function (next) {
          lastFailureRetry = true;
          publishIdentity(next);
        },
        function (error) {
          var reason = (error && error.reason) || 'code_unavailable';

          lastFailureRetry = !error || error.retry !== false;
          // The reason only: never log the code or the session token.
          console.warn(LOG_PREFIX + ' identity failed: ' + reason);
          publishIdentity({ status: 'failed', reason: reason });
        },
      )
      .finally(function () {
        inFlight = false;
      });
  }

  function canRefresh() {
    return (
      identityEnabled &&
      !inFlight &&
      lastFailureRetry &&
      Date.now() - lastAttemptAt >= refreshIntervalMs
    );
  }

  function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  // Returns why the host would refuse `payload` for `spec`, or ''.
  function payloadProblem(spec, payload) {
    var i;
    var key;
    var rule;
    var value;

    if (!isPlainObject(payload)) {
      return 'payload must be an object';
    }
    for (i = 0; i < spec.required.length; i += 1) {
      if (!Object.prototype.hasOwnProperty.call(payload, spec.required[i])) {
        return spec.required[i] + ' is required';
      }
    }
    for (key in payload) {
      if (!Object.prototype.hasOwnProperty.call(payload, key)) {
        continue;
      }
      rule = spec.props[key];
      value = payload[key];
      if (!rule) {
        if (spec.extra) {
          continue;
        }
        return key + ' is not allowed';
      }
      if (rule === 'string' && !(typeof value === 'string' && value.trim())) {
        return key + ' must be a non-empty string';
      }
      if (rule === 'object' && !isPlainObject(value)) {
        return key + ' must be an object';
      }
      if (Array.isArray(rule) && rule.indexOf(value) === -1) {
        return key + ' must be one of ' + rule.join(', ');
      }
    }
    return '';
  }

  // ---------- modal lifecycle ----------
  function displayAuthority() {
    var aspect = null;
    var value;

    try {
      aspect = dbk && typeof dbk.getAspectConfig === 'function' ? dbk.getAspectConfig(aspectId) : null;
    } catch (error) {
      aspect = null;
    }
    // Same lookup as OLB getAspectDisplayAuthority (aspectLifecyclePolicy.js): any of the three
    // controls spellings, then the aspect itself; a list means its first entry.
    var controls = aspect && (aspect.lifecycleControls || aspect.lifeCycleControls || aspect.lifecycleControl);
    value = isPlainObject(controls) && controls.displayAuthority !== undefined
      ? controls.displayAuthority
      : aspect && aspect.displayAuthority;
    if (Array.isArray(value)) {
      value = value[0];
    }
    return String(value || DEFAULT_DISPLAY_AUTHORITY).replace(/[\s_-]/g, '').toLowerCase();
  }

  // requested: our modalOpen went to the host. shown: the host shows the modal (host_immediate, or
  // it answered with its own modalOpen). dismissed: a modalDismiss went to the host.
  var requested = false;
  var shown = displayAuthority() === 'hostimmediate';
  var dismissed = false;

  // The host ignores these anyway; refusing them here tells the UI why.
  function lifecycleProblem(action) {
    if (dismissed) {
      return 'the modal was already dismissed';
    }
    if (action === 'modalOpen') {
      if (requested || shown) {
        return 'modalOpen was already sent';
      }
      if (openDeadlineAt && Date.now() - openDeadlineAt > OPEN_DEADLINE_MS) {
        return 'the open window has passed';
      }
    } else if (!shown && !requested) {
      return 'the modal has not been opened yet';
    }
    return '';
  }

  // An action the UI asked for, from the loader. Refused ones go back to the UI instead of being
  // dropped silently by the host.
  function onHostAction(request) {
    var action = request && typeof request.action === 'string' ? request.action.slice(0, 64) : '';
    var spec = Object.prototype.hasOwnProperty.call(ASPECT_TO_HOST, action) ? ASPECT_TO_HOST[action] : null;
    var problem = spec ? payloadProblem(spec, request.payload) : 'not in the modal aspectToHost message bus';

    if (!problem) {
      problem = lifecycleProblem(action);
    }
    if (!problem && (!aspectId || window.parent === window)) {
      problem = 'no host to relay to';
    }

    if (problem) {
      console.warn(LOG_PREFIX + ' refused ' + action + ': ' + problem);
      send('messageRejected', { action: action, reason: problem });
      return;
    }

    if (action === 'modalOpen') {
      requested = true;
    } else if (action === 'modalDismiss') {
      dismissed = true;
    }

    // The host checks it against the manifest again.
    window.parent.postMessage(
      {
        type: HOST_ENVELOPE,
        version: HOST_ENVELOPE_VERSION,
        aspectId: aspectId,
        action: action,
        payload: request.payload,
      },
      fiOrigin,
    );
    console.log(LOG_PREFIX + ' relayed ' + action + ' to the host');
  }

  // The host's modalOpen can arrive before the loader says hello, so messages are kept (up to
  // MAX_QUEUED) until then.
  function deliverHostMessage(message) {
    if (loaderReady) {
      send('hostMessage', message);
      return true;
    }
    if (hostQueue.length < MAX_QUEUED) {
      hostQueue.push(message);
      return true;
    }
    console.warn(LOG_PREFIX + ' dropped host message (queue full): ' + message.action);
    return false;
  }

  function onHostMessage(data) {
    var message = { action: hostAction(data), payload: data.payload };

    // Each host modalOpen is a fresh display (frequency always re-shows after a dismiss).
    if (message.action === 'modalOpen') {
      if (deliverHostMessage(message)) {
        shown = true;
        dismissed = false;
      }
      return;
    }

    deliverHostMessage(message);
  }

  // The web host sends { type: <action>, aspectId, payload }; the ASPECT_MESSAGE envelope is also accepted.
  function hostAction(data) {
    return isPlainObject(data) && (data.type === HOST_ENVELOPE ? data.action : data.type);
  }

  function isHostMessage(event) {
    var data = event.data;
    var action = hostAction(data);

    return (
      event.source === window.parent &&
      event.origin === fiOrigin &&
      typeof action === 'string' &&
      (data.direction === undefined || data.direction === 'hostToAspect') &&
      Object.prototype.hasOwnProperty.call(HOST_TO_ASPECT, action) &&
      (!data.aspectId || data.aspectId === aspectId) &&
      isPlainObject(data.payload)
    );
  }

  function onWindowMessage(event) {
    if (isHostMessage(event)) {
      onHostMessage(event.data);
    }
  }

  function onLoaderMessage(event) {
    var detail = event && event.detail;

    if (!isPlainObject(detail) || detail.type !== CHANNEL || detail.direction !== 'loaderToExtension') {
      return;
    }

    if (detail.name === 'hello') {
      loaderReady = true;
      openDeadlineAt = Date.now();
      send('init', { configTimeoutMs: configTimeoutMs, shown: shown, identity: identity });
      hostQueue.splice(0).forEach(function (message) {
        send('hostMessage', message);
      });
    } else if (!loaderReady) {
      return;
    } else if (detail.name === 'identityRefresh') {
      if (canRefresh()) {
        runHandoff();
      } else {
        send('identityUpdate', { identity: identity });
      }
    } else if (detail.name === 'hostAction') {
      onHostAction(detail.payload);
    }
  }

  if (!staticLoaderKey) {
    console.error(LOG_PREFIX + ' fail closed: the staticLoaderKey property is missing');
    return;
  }

  if (!dbk || typeof dbk.loadSecureExternalScript !== 'function') {
    console.error(LOG_PREFIX + ' fail closed: dbk.loadSecureExternalScript is unavailable');
    return;
  }

  if (identityEnabled && !isAllowedRedirectUrl(redirectUrl)) {
    identity = { status: 'failed', reason: 'redirect_url_invalid' };
    lastFailureRetry = false;
  } else if (identityEnabled && !/^\/(?!\/)/.test(tokenPath)) {
    identity = { status: 'failed', reason: 'token_path_invalid' };
    lastFailureRetry = false;
  }

  if (!shown) {
    window.addEventListener(CHANNEL, function warnOpenDeadlineOnce(event) {
      var detail = event && event.detail;
      if (!isPlainObject(detail) || detail.name !== 'hello') {
        return;
      }
      window.setTimeout(function () {
        if (!requested && !shown) {
          console.warn(LOG_PREFIX + ' no modalOpen within the open window; the host will not show this modal');
        }
      }, OPEN_DEADLINE_MS);
    }, { once: true });
  }

  // Registered before the loader runs, so its hello is answered.
  window.addEventListener(CHANNEL, onLoaderMessage);
  window.addEventListener('message', onWindowMessage);

  dbk.loadSecureExternalScript(staticLoaderKey).catch(function (error) {
    console.error(LOG_PREFIX + ' static loader "' + staticLoaderKey + '" failed to load', error);
  });

  if (identity.status === 'pending') {
    runHandoff();
  }
})();
