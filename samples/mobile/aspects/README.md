# Mobile V2 Aspects

Build a mobile **Chatbot** or **Modal** aspect from these samples, preview it in the browser, and raise the pull request in your FI repo, all from this repository.

```bash
pnpm run create-aspect:mobile               # 1. make your own aspect from a sample
pnpm exec nx run aspects-mobile-preview:serve    # 2. preview and check it at http://127.0.0.1:4310
#                                            3. host the loader (your CDN or bucket)
pnpm run submit-to-fi                       # 4. raise the PR in your FI repo
```

Read [ARCHITECTURE.md](ARCHITECTURE.md) first. It covers who does what (app, aspect extension, loader, UI page, your backend), the message bus from your UI through the loader and the aspect extension to the app, the optional OIDC identity handoff, and what the app rejects. All of it follows aspect manifest 2.0.0.

## Samples

| Sample               | Type                                      | What it does                                                                                                                                                                                          | You provide                                                                                                                  |
| -------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| [`chatbot`](chatbot) | Chatbot (`bottom_right_fab`)              | The loader frames your chat UI page (`support-chat-ui.html`): a button that expands to a chat panel. The page sends each message to your chat backend; without one it echoes. Optional OIDC identity. | **Chat UI page URL**, title, greeting, colour, help center URL, chat backend URL, optional OIDC client id + redirect URL     |
| [`modal`](modal)     | Modal (`bottom_sheet`, partner delegated) | The loader frames your sheet page (`promotion-sheet-ui.html`), which asks to open on page load with a message and a call-to-action. Optional OIDC identity.                                           | Page, **sheet UI page URL**, headline, message, button text, **button link**, colour, optional OIDC client id + redirect URL |

## 1. Create your aspect

```bash
pnpm run create-aspect:mobile
```

Pick a template and a Sector from the menus, and type a name. Then choose how to set it up:

- **Quick start** (the default): creates the aspect with the template's defaults. Change them later in the preview (**Customize**, then **Save**).
- **Answer each setting now**: one question per setting, with the default already filled in (edit it, or press Enter to keep it). Customer sign-in and the advanced settings are skipped unless you choose to change them. You review everything before anything is written.

Either way, it lists what you still need to do before you submit, and can open the preview with your aspect selected.

Without prompts (defaults, plus any values you pass):

```bash
pnpm run create-aspect:mobile -- --template chatbot --name my-bank-chat \
  --set helpUrl=https://www.my-bank.com/help --set apiUrl=https://chat.my-bank.com/api --yes
```

`--customize` goes straight to the one-question-per-setting path.

This writes `aspects/mobile/<name>/`:

Each file is named for its role; only the UI page is named for what it shows.

| File                  | What it is                                                                                                                                                                                                                                         |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `aspect-extension.js` | **Aspect extension.** Submit commits it to your FI repo as `aspects/mobile/<name>/<name>.js` (the path the platform expects). Its `staticLoaderKey` is the **Script Name** (the name without dashes).                                              |
| `static-loader.v1.js` | **Static loader** that you host. Never change a published file; publish `static-loader.v2.js` instead.                                                                                                                                             |
| `*-ui.html`           | **UI page: you host it.** A reference starting point: change its look, layout and content to follow FDS, then host it on your own https domain and set it as the UI page URL. It can change without a new SRI, as long as it stays on that domain. |
| `metadata.json`       | Every Developer Console field, in the same JSON the PR carries. The preview and the submit read it.                                                                                                                                                |
| `template.json`       | The questions for this template, so the submit can ask for anything still missing                                                                                                                                                                  |

Links must be `https`. The app opens a link in the phone's browser only if its host is exactly your bank's online banking host, or a host listed in the aspect's CSP `frame-src` or `connect-src` (`*.example.com` covers subdomains only); it ignores any other link. The button link (modal) and help link (chatbot) hosts are added to `frame-src` for you, so those links open. In-app pages such as `/app/home` open when they map to a mobile screen (Home or My Settings), and `feature:<id>` opens an app feature such as `feature:Transfers` when it is enabled for the customer. The UI page URL is added to the CSP `frame-src`, and the redirect and remote config URLs to `connect-src`, automatically. The chat backend is called by your UI page, so it is not.

## 2. Preview it

```bash
pnpm exec nx run aspects-mobile-preview:serve
```

Pick your aspect from the list. The page runs it the way the app does and lists every problem the app would reject it for. If your aspect doesn't show on a device, see [Troubleshooting in the Aspects FAQ](https://docs.candescent.com/guides/Building%20Extensions/Aspects/faq/#troubleshooting). See [the preview README](../../../playground/aspects-mobile/README.md).

## 3. Host the loader and your UI page

**You host the UI page.** The sample `*-ui.html` is a reference, not a finished product. Change its look, layout and content to follow FDS. Keep the message contract it uses with the loader ([ARCHITECTURE.md](ARCHITECTURE.md#3-message-bus)), host it on your own https domain, and set that URL as **Your UI page URL**. The preview default (`http://127.0.0.1:4310/...`) works only on your machine; on another port the preview uses that port instead.

Host `static-loader.v1.js` at an `https` URL that sends `Access-Control-Allow-Origin`.

- For Google Cloud Storage, use `https://storage.googleapis.com/<bucket>/<path>`, not the `storage.cloud.google.com` console link, which redirects to a sign-in page.
- In the preview, use **Check** under **Next steps** to test the hosted file.

## 4. Raise the PR in your FI repo

```bash
pnpm run submit-to-fi
```

Pick your aspect from the menu (or pass `--project my-bank-chat`). The FI repo URL and clone path you enter are remembered on this machine, so the next submit offers them again.

Needs the GitHub CLI (`gh`) signed in with access to your FI repo. Before it touches the FI repo, it:

1. Asks for the hosted loader URL, and for any value that is missing or invalid. A wrong answer is shown with the reason and asked again.
2. Downloads the hosted loader and takes the **SRI from the served bytes**, so you never type a hash.
3. Stops to ask if the hosted file differs from your local loader, which usually means a stale upload.
4. Runs every mobile check, including the hosted file's status and CORS. Errors stop the submit.
5. Asks for confirmation.

It then commits only the aspect extension to `aspects/mobile/<name>/<name>.js`, and opens the PR (or updates your open one). The PR body is the `Metadata:` block the platform reads.

Non-interactive use: add `--fi-url <repo-url> --local-path <clone> --loader-url <hosted-url> --yes`. Without prompts, a hosted file that differs from your local loader stops the submit; add `--accept-hosted` to submit the hosted file anyway.

**No terminal?** Use the Developer Console instead: Manage Submissions → Aspects, Platform Mobile, Upload code snippet. Paste the aspect extension and enter the values. In the preview, **Next steps → Developer Console form values** lists every value with copy buttons.

## Chat backend contract (chatbot)

Your UI page calls your backend:

```http
POST <apiUrl>
Content-Type: application/json

{ "message": "What are your hours?", "sessionId": "8f0c…" }
```

```json
{ "reply": "We're open 9am to 5pm, Monday to Friday." }
```

- Your UI page calls `apiUrl` only if its origin is in `ALLOWED_API_ORIGINS` near the top of the page's script; otherwise it stays in demo mode. `create-aspect` adds the `apiUrl` origin for you. If you change `apiUrl` later, add the new origin yourself; the preview and the submit warn when it is missing.
- Before going live, also list your online banking origins in `ALLOWED_HOST_ORIGINS`, so only your bank's pages can drive the UI page.
- Your backend must accept CORS requests from your UI page's origin. No cookies or credentials are sent.
- It must answer within 15 seconds. Replies over 2,000 characters are cut, and they're shown as plain text.
- `sessionId` identifies the conversation, not the user. With the OIDC identity handoff on, the request also carries `Authorization: Bearer <sessionToken>`: your own session, issued by your backend after it exchanged the code (see [ARCHITECTURE.md](ARCHITECTURE.md#4-oidc-identity-handoff)). Without it the user is a guest.
- Messages go from the bank's customers to your backend. Make sure your data-sharing agreement with the bank covers this.

## Writing your own loader

- Build the DOM with `createElement` and `textContent`. Don't use `innerHTML` (review guidance), `eval` (blocked by the CSP), `window.open` (the sandbox has no `allow-popups`) or `<form>` (no `allow-forms`). Send `navigate` to open links.
- The samples use **one Data Attribute per setting** with a lowercase key, for example `title`, `accentcolor`, `helpurl`. A Data Attribute may also hold JSON text, which reaches the loader as a string to `JSON.parse` (on current iOS and Android builds, and web).
- The loader reads its Data Attributes from its own `<script>` tag: the app puts them there as JSON in `data-aspect-config`. Treat them as untrusted: validate every value, and accept only `https` links.
- The loader never talks to the app. It passes your UI's requests to the aspect extension over the aspect extension channel (`hostAction`) and gets the app's messages back from it (`hostMessage`). Only the aspect extension uses `window.dbk`, which the app defines in the frame the aspect extension runs in, and only the aspect extension sends to the app. Don't post the app's `ASPECT_MESSAGE` envelope from the loader: the runtime would send it straight to the app, past the aspect extension's checks.
- On iOS every chatbot launcher sits in the same bottom-right spot, so when several chatbot aspects are enabled for an FI only the front one can be seen and tapped. Android shows only the first chatbot in the list. Disable other chatbots for the FI while you test yours.
- Guard against running twice.
- In the aspect extension, `dbk.sessionInfo()` returns `{ userGuid, locale, isMobileFlow: true }` on mobile. Don't treat `userGuid` as proof of who the customer is; use the OIDC identity handoff for that.
- Talk to your UI iframe only through the `ASPECT_UI` envelope in [ARCHITECTURE.md](ARCHITECTURE.md#3-message-bus). The aspect extension checks every request against the manifest schema before it sends it to the app.
