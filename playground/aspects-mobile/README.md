# Mobile Aspect Preview (V2)

Preview and check a **mobile V2 aspect** (Chatbot or Modal) in the browser before you submit it. There's no simulator, emulator or Docker involved.

It runs your **aspect extension** and **static loader** the way the mobile app does, plays the native host (chatbot button and panel, bottom sheet, link allowlist), and tells you every reason the app would drop the aspect.

```bash
pnpm exec nx run aspects-mobile-preview:serve
# or: node playground/aspects-mobile/serve.mjs
```

Open **http://127.0.0.1:4310**. If that port is taken (another preview is running), it moves to the next free one and prints the address; add `--strict-port` to stop instead. Stuck? **Troubleshooting** (top right) opens the [Aspects FAQ](https://docs.candescent.com/guides/Building%20Extensions/Aspects/faq/#troubleshooting). Your aspects in `aspects/mobile/` (from `pnpm run create-aspect:mobile`) and the samples in [`samples/mobile/aspects`](../../samples/mobile/aspects/README.md) load by default. The full create → preview → host → submit flow is in the [samples README](../../samples/mobile/aspects/README.md).

## What a mobile V2 aspect is made of

| Piece                   | What it is                                                                                               | Where it goes                                                                                                               |
| ----------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Aspect extension**    | Calls `dbk.loadSecureExternalScript('<Script Name>')`; the samples also run the optional sign-in handoff | Console "Code submission", or `aspects/mobile/<name>/<name>.js` in your FI repo                                             |
| **Static loader**       | Your UI and logic                                                                                        | Hosted by you at an immutable, versioned `https` URL; entered as **Loader Script** (Script Name, URL, SRI, Data Attributes) |
| **Submission metadata** | The values from the console form (`ASPECT_*` properties)                                                 | The `Metadata:` JSON in the pull request                                                                                    |

## Preview your own aspect

`pnpm run create-aspect:mobile` creates `aspects/mobile/<name>/`, which the preview picks up. To preview a folder somewhere else:

```bash
node playground/aspects-mobile/serve.mjs --aspect ./my-chatbot
```

The page reloads whenever a file in the folder changes. To try a chatbot's backend before yours exists, point its `apiUrl` at `http://127.0.0.1:4310/demo/chat`, a stand-in that echoes (the same origin as the preview's UI page, which the reference UI accepts without changes). Customize accepts it; the checks warn that it isn't https, and the submit refuses it, so it can't reach a device.

The sample UI pages (`*-ui.html`) are references served by this preview only. You host your own copy, styled to follow FDS, and set its https URL as **Your UI page URL**.

## Using the page

The **Aspect** list has two groups: **My aspects**, the ones you created in `aspects/mobile/` (never committed: that folder is gitignored), and **Templates** to start from, from `samples/mobile/aspects/`: **Support Chat** (a chatbot) and **Promotion Sheet** (a bottom-sheet modal).

The log shows what the app would do with each `navigate`, using the app's own rule (the same on iOS and Android, in every build): an in-app route opens if it maps to a mobile screen (Home or My Settings), `feature:<id>` opens an app feature if it is enabled for the customer, and an https link opens in the phone's browser only if its host is in the aspect's CSP `frame-src` or `connect-src` (`*.example.com` covers subdomains only) or is exactly your bank's online banking host. The preview can't know your bank's host, so it marks those links as a warning. Everything else is refused.

### Customize

**Customize** has one field for each setting in the aspect's `template.json`: titles, messages, links, colours, size and frequency. Each change shows in the phone and in the checks straight away. Invalid values are marked and cannot be saved. Optional groups (customer sign-in, advanced) start folded.

- **Your own aspect** (`aspects/mobile/<name>/`): **Save to metadata.json** writes the values to the aspect's `metadata.json`. These settings are Data Attributes and console settings, so your loader file and its SRI don't change: a copy you already host keeps working, and the next submit sends the new values.
- **A template** (Support Chat, Promotion Sheet): templates are read-only. Try your values, enter a name and press **Create my aspect**. This does the same as `pnpm run create-aspect:mobile` with those answers, and selects the new aspect. Host its `static-loader.v1.js`, then submit.

Saving only works from the preview page on the same machine (`127.0.0.1` or `localhost`); other websites and other computers can't write to your files.

The phone always runs the loader files in your aspect folder, and warns when a file's hash no longer matches the submission's SRI.

**Next steps**, under Customize, tells you:

- where the aspect came from,
- whether it's ready to submit,
- where to host your loader, with a **Hosted loader URL** field. **Check** downloads it the way a device does and reports a redirect, 404, missing CORS or an SRI mismatch. It also warns when the hosted copy differs from your local file (a stale upload), shows the SRI the submit will use, and adds `--loader-url` to the submit command. The page remembers the URL in this browser only.
- where the aspect extension goes in your FI repo (`aspects/mobile/<name>/<name>.js`),
- how to submit it: the Developer Console steps (with a copy button for the aspect extension), or `forge` commands when the Forge CLI started the preview,
- every Developer Console form value, with copy buttons.

The values come from the aspect's `metadata.json`, so they always match what you previewed.

For runtime experiments, add `?advanced=1` to the URL: whether the runtime sets `__ASPECT_SCRIPT_KEY__`, evaluating the loader twice, and lowercasing Script Names.

## The aspect folder

The preview, the checker and `forge aspect submit --platform mobile` all read the same folder:

| File                         | Required          | Content                                                                                                              |
| ---------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------- |
| `<name>/aspect-extension.js` | yes               | Aspect extension (committed to the FI repo as `<name>.js`; older folders may use `<name>.js`)                        |
| `<name>/metadata.json`       | yes               | Submission metadata (`ASPECT_*` properties), the same JSON as the PR's `Metadata:` block                             |
| `<name>/static-loader.vN.js` | for local testing | Static loader(s). Each is matched to `ASPECT_SCRIPT_<key>_URL` by file name (the template's `loaderFile` otherwise). |

## Check without a browser (CI, pre-submit)

```bash
node playground/aspects-mobile/check.mjs ./my-chatbot --fetch
node playground/aspects-mobile/check.mjs pr-body.txt --extension my-chatbot.js --fetch
```

`--fetch` downloads each Script URL and verifies the HTTP status, CORS and SRI. The exit code is `1` when the app would reject the aspect.

## What the checks cover

The rules are in [`src/mobile-rules.json`](src/mobile-rules.json):

- **CSP:** allowed directives only (so no `frame-ancestors` or `media-src`: the app drops the aspect). `script-src` (or `default-src`) needs `'nonce-aspect'`, quoted, or the scripts are blocked. Commas and other unquoted keywords spoil only the source they touch, so they are warnings; so is `'unsafe-eval'`, which the app allows but you should avoid.
- **Sandbox and permissions:** only `allow-scripts allow-same-origin`, separated by spaces; no granted permissions (an empty `camera=()` is fine).
- **Placement and display:**
  - Chatbot: `bottom_right_fab`.
  - Modal: `bottom_sheet` or `center_overlay` (one dialog size on mobile, so Placement Size is ignored), `partner_delegated` or `host_immediate`. The page must map to a mobile screen (Home, My Accounts or My Settings), and a `partner_delegated` modal must send `modalOpen` within 15 s (the aspect extension sends it with `dbk.postToHost` when your UI asks to open).
  - Missing mount strategy, trigger or frequency is a warning: the app uses its default.
- **Loader Script:**
  - `https` only; not a `storage.cloud.google.com` link.
  - The SRI is well formed and isn't the hash of an empty response.
  - The file name is versioned.
  - The Script Name matches the aspect extension exactly, including case (lowercase is recommended).
  - Config usually goes under Data Attributes, one value per setting; HTML Attributes become attributes on the `<script>` tag. A Data Attribute may hold JSON text (the loader parses it); invalid JSON is a warning.
- **Links:** create, Customize and submit add the host of the modal's button link and the chatbot's help link to the CSP `frame-src`, so the app opens them. When a CSP doesn't list that host (one entered in the Developer Console, an aspect created before this, or a hand edit), it is a warning: the app then opens the link only if its host is exactly your bank's online banking host. Pull request bodies get this check too, using the sample template of the same Aspect Type.
- **Messages:** every message the app's relay receives (and every `dbk.*` call the aspect extension makes) is validated against the manifest payload schema, as the app does: extra keys, unknown values, blank strings and arrays where an object is expected are rejected.
- **Code scan:** flags `eval` and `new Function` (blocked by the CSP), `window.open` and forms (blocked by the sandbox), device APIs (denied), `innerHTML` and `document.write` (review guidance only), a chatbot loader used for a modal, and the reverse.

**Errors** are things that make the app drop the aspect, or stop it loading or showing, plus values that only work in this preview. **Warnings** are things the app only logs or fills with a default, and habits that cause silent failures.

## Limits

This is a stand-in for the app, not the app. It doesn't reproduce:

- the bank's token service or session,
- iOS's token bridge (`webkit.messageHandlers.tokenApiDetails`; the preview only has Android's `JSBridge`),
- `contextUpdate` when locale or theme changes between screens,
- frequency capping,
- WebView differences between iOS and Android,
- native permission prompts.

Always do a final check on a real build. The rules follow the aspect manifest (schemaVersion 2.0.0); when the app's manifest changes, update `src/mobile-rules.json` and the tests.

## For tools

`serve.mjs` exports `startPreviewServer({ aspects, port, host, launcher, onReady })` and `check.mjs` exports `runCheck(target, options)`, so the Forge CLI reuses the preview and the rules instead of copying them. Only the Forge CLI passes `launcher: 'forge'`; it switches the submit steps from the Developer Console to `forge` commands. Started any other way, the page never mentions the CLI.
