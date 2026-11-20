/* eslint-disable no-console */
/**
 * Chatbot aspect extension (web).
 *
 * Runs in the aspect's sandbox iframe on the FI origin. dbk.loadSecureExternalScript
 * adds the static loader to this same document, so the extension and the loader
 * share one window. This file is the only piece that talks to the host.
 *
 * It does three things:
 *   1. Loads the static loader.
 *   2. Brokers the optional OIDC identity: a one-time code from the FI token
 *      endpoint, exchanged by your backend (redirectUrl) for your own session.
 *   3. Relays messages between the loader and the host:
 *      - aspectToHost: the loader's `hostAction` ({ action, payload }) is checked against the
 *        manifest chatbot aspectToHost schema, then posted to window.parent as
 *        { type: 'ASPECT_MESSAGE', version, aspectId, action, payload }, or refused back to
 *        the loader as `messageRejected` ({ action, reason }).
 *      - hostToAspect: { type: 'ASPECT_MESSAGE', direction: 'hostToAspect', aspectId, action, payload }
 *        from window.parent on the FI origin is checked against the manifest chatbot hostToAspect
 *        schema (chatbotOpen, contextUpdate, chatbotMinimize { status: 'host_minimized' }) and passed to the loader as `hostMessage` ({ action, payload }). Messages that
 *        arrive before the loader's `hello` are queued.
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

  var LOG_PREFIX = '[ChatbotAspectExtension]';
  var CHANNEL = 'ASPECT_EXTENSION';
  var CHANNEL_VERSION = '1.0';
  var DEFAULT_TOKEN_PATH = '/feng-bff/live/v1/aspect/token';
  var HOST_ENVELOPE = 'ASPECT_MESSAGE';
  var HOST_ENVELOPE_VERSION = '1.0';
  // Manifest chatbot aspectToHost. With `values`, the payload must have exactly `key`, set to one of
  // them (additionalProperties: false). Without, `key` must be a string and other keys are allowed.
  var ASPECT_TO_HOST = {
    chatbotOpen: { key: 'reason', values: ['user_clicked_fab', 'proactive_engagement', 'new_message_received'] },
    chatbotMinimize: { key: 'status', values: ['user_minimized', 'session_ended'] },
    navigate: { key: 'url' },
  };
  // Manifest chatbot hostToAspect. null: any object payload; otherwise checked like ASPECT_TO_HOST.
  var HOST_TO_ASPECT = {
    chatbotOpen: null,
    contextUpdate: null,
    chatbotMinimize: { key: 'status', values: ['host_minimized'] },
  };
  var MAX_QUEUED = 20;
  // A second copy in the same sandbox would add its own listeners and relay every message twice.
  var INIT_FLAG = '__chatAspectExtensionInit';

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

  function payloadProblem(spec, payload) {
    var keys = isPlainObject(payload) ? Object.keys(payload) : null;

    if (!keys || keys.length !== 1 || keys[0] !== spec.key) {
      return 'payload must be { ' + spec.key + ' }';
    }
    if (!spec.values) {
      var value = payload[spec.key];
      return typeof value === 'string' && value.trim() ? '' : 'payload.' + spec.key + ' must be a non-empty string';
    }
    if (spec.values.indexOf(payload[spec.key]) === -1) {
      return spec.key + ' is not allowed';
    }
    return '';
  }

  // An action the UI asked for, from the loader. Refused ones go back to the UI instead of
  // being dropped silently by the host.
  function onHostAction(request) {
    var action = request && typeof request.action === 'string' ? request.action.slice(0, 64) : '';
    var spec = Object.prototype.hasOwnProperty.call(ASPECT_TO_HOST, action) ? ASPECT_TO_HOST[action] : null;
    var problem = spec ? payloadProblem(spec, request.payload) : 'not in the chatbot aspectToHost message bus';

    if (!problem && (!aspectId || window.parent === window)) {
      problem = 'no host to relay to';
    }

    if (problem) {
      console.warn(LOG_PREFIX + ' refused ' + action + ': ' + problem);
      send('messageRejected', { action: action, reason: problem });
      return;
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

  // The host can post its opening chatbotOpen before the loader says hello, so messages are
  // kept (up to MAX_QUEUED) until then.
  function onHostMessage(data) {
    var message = { action: hostAction(data), payload: data.payload };

    if (loaderReady) {
      send('hostMessage', message);
    } else if (hostQueue.length < MAX_QUEUED) {
      hostQueue.push(message);
    } else {
      console.warn(LOG_PREFIX + ' dropped host message (queue full): ' + message.action);
    }
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
      isPlainObject(data.payload) &&
      (HOST_TO_ASPECT[action] === null || !payloadProblem(HOST_TO_ASPECT[action], data.payload))
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
      send('init', { configTimeoutMs: configTimeoutMs, identity: identity });
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
