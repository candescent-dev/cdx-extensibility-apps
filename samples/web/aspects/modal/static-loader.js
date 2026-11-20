/* eslint-disable no-console, indent, prettier/prettier */
/**
 * Card activation banner static loader, host_immediate modal (web): the sandbox end of the
 * aspect message bus.
 *
 * dbk.loadSecureExternalScript adds this script to the aspect's sandbox document, next to the
 * aspect extension, so both share one window. window.frameElement is the sandbox iframe inside
 * the host's modal overlay. The aspect extension is the only piece that talks to the host (OLB).
 * This loader:
 *   - reads its scriptData and mounts exactly one partner UI iframe; fails closed otherwise
 *   - passes messages between that UI and the aspect extension:
 *       UI <-> loader     postMessage { type:'ASPECT_UI', version:'1.0', direction, action, data }
 *                         (`data`, not `payload`: the platform bridge relays any UI message that has
 *                         a type and a payload object to the host, which would duplicate it)
 *         'aspectToHost'  actions the UI asks for (modalOpen, modalDismiss, navigate): sent to the
 *                         aspect extension as `hostAction`, which checks them against the manifest and
 *                         the modal lifecycle and sends them to the host
 *         'hostToAspect'  the host's messages (modalOpen), from the aspect extension's `hostMessage`,
 *                         forwarded unchanged
 *         'uiToLoader'    uiReady, identityRefresh, resize (sizes the banner frame; never relayed)
 *         'loaderToUi'    aspectInit, identityUpdate, messageRejected (from the aspect extension)
 *       loader <-> aspect extension  same-window CustomEvent 'ASPECT_EXTENSION', detail
 *                         { type, version, direction, name, payload }:
 *                         hello / identityRefresh / hostAction up (loaderToExtension),
 *                         init / identityUpdate / hostMessage / messageRejected down (extensionToLoader)
 * Must not: use window.dbk for messaging, post ASPECT_MESSAGE to the host, or listen to window.parent.
 *
 * host_immediate: the host shows the modal itself, so the UI never sends modalOpen
 * (aspectInit config.requestOpen is false).
 *
 * scriptData (aspect.scripts[<Script Name>].scriptData, read with dbk.getAspectScriptConfig):
 *   uiUrl                https banner UI page (required unless configUrl is set)
 *   configUrl            https; GET returns { schemaVersion: 1, isActive: true, uiUrl }
 *   uiOrigin             required with configUrl; the only origin its uiUrl may have
 *   bannerWidth, bannerHeight   initial frame size, e.g. '520px'
 *   bannerLinkUrl        optional https link for the primary button (opened by the host).
 *                        Not named redirectUrl: the platform treats it as the same key as the
 *                        redirecturl property and drops that property from the aspect record.
 *   internalNavigateUrl  optional in-app route, must start with /app/
 *   widget               optional object (or JSON text) of banner copy and styles
 *   eligibilityAllow, eligibilityDelayMs   partner_delegated only: whether and when to ask for modalOpen
 */
(function () {
    'use strict';

    var LOG_PREFIX = '[modalHostStaticLoader]';
    var ASPECT_TYPE = 'modal';
    var REQUEST_OPEN = false;
    var MAX_QUEUED = 20;
    var MAX_ELIGIBILITY_DELAY_MS = 10000;
    var ENVELOPE = 'ASPECT_UI';
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
    // Manifest modal `context`: required locale, theme, viewport; optional auth flag. The OLB web host
    // sends it as `isAuthenticate` (aspectHostContext.js), not the manifest's `isAuthenticated`.
    var CONTEXT_KEYS = ['locale', 'theme', 'viewport', 'isAuthenticate'];
    var PARTNER_IFRAME_ID = 'card-activation-banner-iframe';
    var PARTNER_TITLE = 'Card activation banner';
    var PARTNER_SANDBOX = 'allow-scripts allow-same-origin';

    // Run once per sandbox, even if the script is evaluated twice.
    var INIT_FLAG = '__modalHostStaticLoaderInit';

    if (window[INIT_FLAG]) {
        return;
    }
    window[INIT_FLAG] = true;

    var currentScript = document.currentScript;
    var scriptKey = (currentScript && currentScript.getAttribute('data-aspect-script-key')) || '';
    var aspectId = (currentScript && currentScript.getAttribute('data-aspect-id')) || '';
    var fiOrigin = window.location.origin;

    var identity = { status: 'pending' };
    var context = {};
    var ui = null;
    var uiReady = false;
    var queue = [];
    var initialised = false;
    // shown: the host shows the modal (host_immediate, or its modalOpen came first); for aspectInit.
    var shown = false;
    var identityWaiters = [];

    function isPlainObject(value) {
        return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
    }

    function isAllowedUrl(value) {
        try {
            var url = new URL(value);

            return url.protocol === 'https:' ||
                (url.protocol === 'http:' && url.hostname === 'localhost' && window.location.hostname === 'localhost');
        } catch (error) {
            return false;
        }
    }

    function isHttpsUrl(value) {
        try {
            return new URL(value).protocol === 'https:';
        } catch (error) {
            return false;
        }
    }

    function cssPx(value, fallback) {
        if (typeof value === 'number' && value > 0 && value < 10000) {
            return Math.round(value) + 'px';
        }

        return typeof value === 'string' && /^\d{1,4}px$/.test(value.trim()) ? value.trim() : fallback;
    }

    function readWidget(value) {
        var parsed = value;

        if (typeof value === 'string') {
            try {
                parsed = JSON.parse(value);
            } catch (error) {
                console.warn(LOG_PREFIX + ' scriptData.widget is not valid JSON; using the UI defaults');
                return {};
            }
        }

        return isPlainObject(parsed) ? parsed : {};
    }

    function pickScriptDataField(scriptData, name) {
        var lower = name.toLowerCase();
        var value = typeof scriptData[lower] === 'string' ? scriptData[lower] : scriptData[name];
        return typeof value === 'string' ? value.trim() : '';
    }

    function pickScriptDataNumber(scriptData, name) {
        var lower = name.toLowerCase();
        var raw = scriptData[lower] !== undefined ? scriptData[lower] : scriptData[name];
        return Number(raw);
    }

    function readConfig() {
        var dbk = window.dbk;
        var entry = scriptKey && dbk && typeof dbk.getAspectScriptConfig === 'function'
            ? dbk.getAspectScriptConfig(scriptKey)
            : null;
        var scriptData = entry && entry.script && entry.script.scriptData;
        var configUrl;
        var uiUrl;
        var redirectUrl;
        var internalNavigateUrl;
        var delay;
        var uiOrigin;

        if (!isPlainObject(scriptData)) {
            console.error(LOG_PREFIX + ' fail closed: no scriptData for this Script Name');
            return null;
        }

        configUrl = pickScriptDataField(scriptData, 'configUrl');
        uiUrl = pickScriptDataField(scriptData, 'uiUrl');
        uiOrigin = pickScriptDataField(scriptData, 'uiOrigin');
        redirectUrl = pickScriptDataField(scriptData, 'bannerLinkUrl');
        internalNavigateUrl = pickScriptDataField(scriptData, 'internalNavigateUrl');
        delay = pickScriptDataNumber(scriptData, 'eligibilityDelayMs');

        if (configUrl && (!isAllowedUrl(configUrl) || !isAllowedUrl(uiOrigin))) {
            console.error(LOG_PREFIX + ' fail closed: configUrl and uiOrigin must both be https');
            return null;
        }

        if (!configUrl && !isAllowedUrl(uiUrl)) {
            console.error(LOG_PREFIX + ' fail closed: uiUrl must be an https URL');
            return null;
        }

        if (redirectUrl && !isHttpsUrl(redirectUrl)) {
            console.warn(LOG_PREFIX + ' ignoring bannerLinkUrl: it must be https');
            redirectUrl = '';
        }

        if (internalNavigateUrl && internalNavigateUrl.indexOf('/app/') !== 0) {
            console.warn(LOG_PREFIX + ' ignoring internalNavigateUrl: it must start with /app/');
            internalNavigateUrl = '';
        }

        if (!Number.isFinite(delay) || delay < 0) {
            delay = 0;
        } else if (delay > MAX_ELIGIBILITY_DELAY_MS) {
            console.warn(LOG_PREFIX + ' eligibilityDelayMs capped at ' + MAX_ELIGIBILITY_DELAY_MS + ' (the host waits 15 s)');
            delay = MAX_ELIGIBILITY_DELAY_MS;
        }

        return {
            configUrl: configUrl,
            uiOrigin: configUrl ? new URL(uiOrigin).origin : '',
            uiUrl: uiUrl,
            bannerWidth: cssPx(pickScriptDataField(scriptData, 'bannerWidth'), '520px'),
            bannerHeight: cssPx(pickScriptDataField(scriptData, 'bannerHeight'), '320px'),
            // Display settings are data for the UI; the loader never renders them.
            display: {
                requestOpen: REQUEST_OPEN,
                redirectUrl: redirectUrl,
                internalNavigateUrl: internalNavigateUrl,
                widget: readWidget(scriptData.widget),
                eligibilityAllow: scriptData.eligibilityAllow !== false,
                eligibilityDelayMs: Math.floor(delay),
            },
        };
    }

    // Partner-scoped session only; never FI cookies, the authorization code or a Candescent token.
    function toUiIdentity(result) {
        if (result && result.status === 'ok' && typeof result.sessionToken === 'string') {
            return { status: 'ok', sessionToken: result.sessionToken, expiresAt: result.expiresAt };
        }
        if (result && (result.status === 'none' || result.status === 'pending')) {
            return { status: result.status };
        }
        return {
            status: 'failed',
            reason: result && typeof result.reason === 'string' ? result.reason.slice(0, 64) : 'failed',
        };
    }

    function envelope(direction, action, data) {
        return { type: ENVELOPE, version: VERSION, direction: direction, action: action, data: data || {} };
    }

    // Messages for a UI that is not ready yet are kept (up to MAX_QUEUED) and replayed after aspectInit.
    function toUi(direction, action, payload) {
        var message = envelope(direction, action, payload);

        if (uiReady) {
            ui.window.postMessage(message, ui.origin);
        } else if (queue.length < MAX_QUEUED) {
            queue.push(message);
        }
    }

    function toExtension(name, payload) {
        window.dispatchEvent(
            new CustomEvent(EXTENSION, {
                detail: { type: EXTENSION, version: VERSION, direction: DIR.TO_EXTENSION, name: name, payload: payload || {} },
            }),
        );
    }

    function setIdentity(next) {
        identity = toUiIdentity(next);

        if (identity.status !== 'pending') {
            identityWaiters.splice(0).forEach(function (resolve) {
                resolve();
            });
        }

        if (uiReady) {
            toUi(DIR.LOADER_TO_UI, 'identityUpdate', { identity: identity });
        }
    }

    // The host caps the sandbox iframe at the manifest maximum for the modal size.
    function sizeFrames(width, height) {
        var hostFrame = null;

        if (ui) {
            ui.frame.style.width = width;
            ui.frame.style.height = height;
        }

        try {
            hostFrame = window.frameElement;
        } catch (error) {
            hostFrame = null;
        }

        if (hostFrame) {
            hostFrame.style.width = width;
            hostFrame.style.minWidth = width;
            hostFrame.style.height = height;
            hostFrame.style.minHeight = height;
        }
    }

    // The UI often gets no referrer, so it learns the parent origin from #parentOrigin.
    function withParentOrigin(url) {
        var target = new URL(url);

        target.hash = 'parentOrigin=' + encodeURIComponent(fiOrigin);
        return target.toString();
    }

    function mountUi(uiUrl) {
        var frame;

        if (ui) {
            return;
        }

        document.documentElement.style.cssText = 'margin:0;height:100%;background:transparent;';
        document.body.style.cssText = 'margin:0;height:100%;background:transparent;';

        frame = document.createElement('iframe');
        frame.id = PARTNER_IFRAME_ID;
        frame.title = PARTNER_TITLE;
        frame.setAttribute('sandbox', PARTNER_SANDBOX);
        frame.referrerPolicy = 'strict-origin-when-cross-origin';
        frame.style.cssText = 'border:0;display:block;width:100%;height:100%;background:transparent;';
        frame.src = withParentOrigin(uiUrl);
        document.body.appendChild(frame);

        ui = { frame: frame, window: frame.contentWindow, origin: new URL(uiUrl).origin };
        sizeFrames(config.bannerWidth, config.bannerHeight);
        console.log(LOG_PREFIX + ' mounted banner UI', { uiOrigin: ui.origin });
    }

    function whenIdentitySettled(timeoutMs) {
        return new Promise(function (resolve) {
            if (identity.status !== 'pending') {
                resolve();
                return;
            }
            identityWaiters.push(resolve);
            setTimeout(resolve, timeoutMs);
        });
    }

    function fetchRuntimeConfig(timeoutMs) {
        var headers = { Accept: 'application/json' };
        var controller = typeof AbortController === 'function' ? new AbortController() : undefined;
        var timer = setTimeout(function () {
            if (controller) {
                controller.abort();
            }
        }, timeoutMs);

        if (identity.status === 'ok') {
            headers.Authorization = 'Bearer ' + identity.sessionToken;
        }

        return fetch(config.configUrl, {
            headers: headers,
            credentials: 'omit',
            signal: controller && controller.signal,
        })
            .then(function (response) {
                if (!response.ok) {
                    throw new Error('config_http_' + response.status);
                }
                return response.json();
            })
            .then(function (data) {
                if (!data || data.schemaVersion !== 1 || data.isActive !== true) {
                    throw new Error('config_inactive');
                }
                if (!isAllowedUrl(data.uiUrl) || new URL(data.uiUrl).origin !== config.uiOrigin) {
                    throw new Error('config_bad_origin');
                }
                return data.uiUrl;
            })
            .finally(function () {
                clearTimeout(timer);
            });
    }

    function onInit(payload) {
        var timeoutMs = Number(payload.configTimeoutMs) > 0 ? Number(payload.configTimeoutMs) : 8000;

        setIdentity(payload.identity);

        if (payload.shown === true) {
            shown = true;
        }

        function finishInit() {
            initialised = true;
        }

        if (!config.configUrl) {
            mountUi(config.uiUrl);
            finishInit();
            return;
        }

        // configUrl gets the partner session when there is one, so wait (up to timeoutMs) for identity.
        whenIdentitySettled(timeoutMs)
            .then(function () {
                return fetchRuntimeConfig(timeoutMs);
            })
            .then(function (uiUrl) {
                mountUi(uiUrl);
                finishInit();
            }, function (error) {
                console.error(LOG_PREFIX + ' fail closed: ' + (error && error.message));
            });
    }

    function onExtensionMessage(event) {
        var detail = event && event.detail;
        var payload;

        if (!isPlainObject(detail) || detail.type !== EXTENSION || detail.direction !== DIR.FROM_EXTENSION) {
            return;
        }

        payload = isPlainObject(detail.payload) ? detail.payload : {};

        if (detail.name === 'init' && !initialised) {
            onInit(payload);
        } else if (detail.name === 'identityUpdate') {
            setIdentity(payload.identity);
        } else if (detail.name === 'hostMessage' && typeof payload.action === 'string') {
            var data = isPlainObject(payload.payload) ? payload.payload : {};

            CONTEXT_KEYS.forEach(function (key) {
                if (data[key] !== undefined) {
                    context[key] = data[key];
                }
            });
            if (payload.action === 'modalOpen') {
                shown = true;
            }
            toUi(DIR.FROM_HOST, payload.action, data);
        } else if (detail.name === 'messageRejected') {
            toUi(DIR.LOADER_TO_UI, 'messageRejected', {
                action: String(payload.action).slice(0, 64),
                reason: String(payload.reason).slice(0, 200),
            });
        }
    }

    function onUiMessage(data) {
        if (data.direction === DIR.UI_TO_LOADER) {
            if (data.action === 'uiReady' && !uiReady) {
                uiReady = true;
                ui.window.postMessage(
                    envelope(DIR.LOADER_TO_UI, 'aspectInit', {
                        schemaVersion: 1,
                        aspectType: ASPECT_TYPE,
                        aspectId: aspectId,
                        fiOrigin: fiOrigin,
                        context: context,
                        config: Object.assign({}, config.display, {
                            bannerWidth: config.bannerWidth,
                            bannerHeight: config.bannerHeight,
                        }),
                        identity: identity,
                        // true when the host shows the modal (host_immediate, or its modalOpen came first)
                        shown: shown,
                    }),
                    ui.origin,
                );
                queue.splice(0).forEach(function (message) {
                    ui.window.postMessage(message, ui.origin);
                });
            } else if (data.action === 'identityRefresh') {
                toExtension('identityRefresh');
            } else if (data.action === 'resize' && isPlainObject(data.data)) {
                sizeFrames(
                    cssPx(data.data.width, config.bannerWidth),
                    cssPx(data.data.height, config.bannerHeight),
                );
            }
            return;
        }

        if (data.direction !== DIR.TO_HOST) {
            return;
        }

        // The aspect extension checks it against the manifest and the modal lifecycle, and sends it to the host.
        toExtension('hostAction', { action: data.action.slice(0, 64), payload: data.data });
    }

    function onWindowMessage(event) {
        var data = event.data;

        if (!isPlainObject(data) || data.type !== ENVELOPE || typeof data.action !== 'string') {
            return;
        }
        if (!ui || event.source !== ui.window || event.origin !== ui.origin) {
            return;
        }

        onUiMessage(data);
    }

    var config = readConfig();

    if (!config) {
        return;
    }

    window.addEventListener(EXTENSION, onExtensionMessage);
    window.addEventListener('message', onWindowMessage);
    toExtension('hello');
})();
