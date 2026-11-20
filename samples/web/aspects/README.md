# Web Aspects

Folder-based web aspects (chatbot and modal) with `metadata.json`, a bootstrap (`aspect-extension.js`), a hosted static loader, and a partner UI page.

```bash
pnpm run create-aspect:web                 # 1. make your own web aspect from a sample
#                                            2. try it in the OLB web playground at http://localhost:4200/home-page
#                                            3. host the loader and your UI page
pnpm run submit-to-fi                      # 4. raise the PR in your FI repo
```

| Sample | Type | Script key | Partner UI |
| --- | --- | --- | --- |
| [`chatbot`](chatbot) | Chatbot | `chatbot` | `support-chat-ui.html` |
| [`modal`](modal) | Modal (host immediate) | `modal` | `card-activation-banner-ui.html` |

Test them in the **OLB Web Playground**, the real host shell at **http://localhost:4200/home-page**.

## Create a web aspect

```bash
pnpm run create-aspect:web
```

Pick a template and a Sector from the menus, and type a name. Then choose how to set it up:

- **Quick start** (the default): uses the template's defaults, and asks only for what has no default (your UI page URL). There is no web preview to change them in later, so edit `metadata.json`, or submit asks for anything still missing.
- **Answer each setting now**: one question per setting, with the default already filled in (edit it, or press Enter to keep it). The OIDC client id and redirect URL go together: set one and you are asked for the other. You review everything before anything is written.

Either way, it lists what you still need to do before you submit.

Without prompts (defaults, plus any values you pass):

```bash
pnpm run create-aspect:web -- --template chatbot --name my-bank-chat \
  --set uiurl=https://ui.my-bank.com/chat.html --yes
```

`--template` accepts `chatbot` or `modal`. `--customize` goes straight to the one-question-per-setting path. `pnpm run create-aspect` asks web or mobile first. This writes `aspects/web/<name>/`. The extension, loader, and UI page are copied from the sample unchanged.

Your aspect's Script Name is its name without dashes (`my-bank-chat` → `mybankchat`). The static loader key (`ASPECT_PROPERTY_WEB_STATICLOADERKEY`) defaults to that Script Name. If you change it, every `ASPECT_SCRIPT_<key>_*` property uses the new key, so `loadSecureExternalScript` still finds `ASPECT_SCRIPT_<key>_URL`. The static loader URL is optional at create; submit asks for it, adds its origin to `script-src`, and takes the SRI from it.

## Files in each sample

| File | What it is |
| --- | --- |
| `aspect-extension.js` | **Bootstrap.** Runs in the extension sandbox and calls `dbk.loadSecureExternalScript`. Submit copies it to your FI repo as `aspects/web/<name>/<name>.js`. |
| `static-loader.js` | **Static loader** that you host. It mounts the partner UI iframe and relays messages to the extension. Never change a published file; publish a new version instead. |
| `support-chat-ui.html` / `card-activation-banner-ui.html` | **Partner UI page.** You host it. |
| `metadata.json` | Developer Console fields. Submit puts this JSON in the PR body. |
| `template.json` | Questions for this template (values the author must fill in, such as UI URL and SRI), so submit can ask for anything still missing. |

## Open the playground

From the repo root:

```bash
cd playground/web
docker compose pull
docker compose up
```

When the logs show the playground is ready, open **http://localhost:4200/home-page**.

Full Docker setup: [playground/web/README.md](../../../playground/web/README.md).

## Test a web aspect

1. On **http://localhost:4200/home-page**, click **Add Aspect** (home toolbar) to open **Manage Aspects**.
2. The playground already has sample chatbot and modal records. They start **disabled**. Turn **isEnabledWeb** on for the one you want, then wait for the reload.
3. To try **your** aspect (or a sample from this folder) instead, click **New submission** and fill the form from that folder's `metadata.json`:

   | Playground field | Where it comes from |
   | --- | --- |
   | Type | `ASPECT_TYPE` (`chatbot` or `modal`) |
   | Name | `metadata.json` `"name"` |
   | Extension script | Paste `aspect-extension.js`, or use **standard** |
   | Script key | `ASPECT_PROPERTY_WEB_STATICLOADERKEY` (the `<key>` in `ASPECT_SCRIPT_<key>_URL`) |
   | Loader | Paste `static-loader.js`, **or** the hosted URL + SRI from metadata |
   | scriptData | Each `ASPECT_SCRIPT_<key>_DATA_*` value (`uiurl`, `configurl`, `uiorigin`, and so on) |
   | Display authority / frequency | `ASPECT_PROPERTY_WEB_DISPLAYAUTHORITY` and `ASPECT_PROPERTY_WEB_FREQUENCY` |

4. Save. The shell reloads. Confirm the chatbot launcher or modal on **http://localhost:4200/home-page**.

Aspects are in-memory only. `docker compose down && docker compose up` clears anything you added.

## Submit to the FI repo

After it looks right in the playground:

```bash
pnpm run submit-to-fi
```

Pick your aspect from the menu (or pass `--project my-bank-chat`). Before touching the FI repo, submit asks for anything still missing, downloads the hosted loader to take its SRI, and checks every value. It copies only the bootstrap to `aspects/web/<name>/<name>.js` in your FI repo. Details: [repository root README](../../../README.md#submit-to-fi-extensions-repo).

## Test plan (submit metadata)

Run once per template against a test FI repo (or `--local-path` to a bare clone). Host `static-loader.js` on an **https** URL before submit.

**Chatbot**

```bash
pnpm run create-aspect:web -- --template chatbot --name devex-chat-e2e --set uiurl=https://ui.example.com/chat.html --yes
pnpm run submit-to-fi -- --project devex-chat-e2e --loader-url https://cdn.example.com/devex-chat-e2e/static-loader.js --fi-url <test-fi> --yes
```

In the PR body `Metadata:` block, confirm:

- `ASPECT_PROPERTY_WEB_PAGE` is `/app/home`
- `ASPECT_PROPERTY_WEB_MOUNTSTRATEGY` is **not** in the metadata (web aspects do not set it)
- `ASPECT_PROPERTY_WEB_STATICLOADERKEY` is `devexchate2e` (the Script Name: the aspect name without dashes)
- `ASPECT_SCRIPT_devexchate2e_URL` / `_SRI` are set from the hosted loader
- `ASPECT_SCRIPT_devexchate2e_DATA_uiurl` matches the create `--set` value

**Modal**

```bash
pnpm run create-aspect:web -- --template modal --name devex-modal-e2e --set uiurl=https://ui.example.com/banner.html --yes
pnpm run submit-to-fi -- --project devex-modal-e2e --loader-url https://cdn.example.com/devex-modal-e2e/static-loader.js --fi-url <test-fi> --yes
```

Confirm the same page and key properties, plus modal defaults:

- `ASPECT_PROPERTY_WEB_FREQUENCY` is `oncePerSession`
- `ASPECT_SCRIPT_devexmodale2e_DATA_bannerheight` is `320px`

The FI repo should contain only `aspects/web/<name>/<name>.js` (bootstrap from `aspect-extension.js`).
