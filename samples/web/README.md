# CDX Extensibility Apps - Web Samples

Template repository for building **web widgets** that extend the OLB/Platform using the CDX extensibility SDKs. Use the sample widgets as a starting point for your own extensions.

**Shared dependencies (web):** pinned versions are listed under **Shared dependencies** in the **[repository root README](../../README.md#shared-dependencies)**.

---

## Quick Start

> **First time?** Complete the setup in the **[repository root README](../../README.md#getting-started-step-by-step)** first (Node.js, npm, Nx).

```bash
# From repository root
nx serve agent-widget              # Opens at http://localhost:4101
nx serve qa-automation-widget      # Opens at http://localhost:4102
nx serve investmentportfolio-widget # Opens at http://localhost:4302
```

**Next steps:**
- See [Getting started (step-by-step)](#getting-started-step-by-step) below for full workflow
- Read [Using the CDX SDK](#using-the-cdx-sdk) to understand platform integration

---

## Widgets in this repo

Three reference widgets are included. Use them as working examples when building your own. You can test any widget against a full local OLB instance using the **[OLB Web Playground](../../playground/web/README.md)** — no Candescent network access required.
### agent-widget — Bring Your Own Agent (BYOA)

An AI-powered chat assistant that integrates with the OLB platform.

- Renders a `ChatInterface` backed by an `agentService` that routes all API calls through the platform's secure `httpClient`
- Reads user context via `sdk.useUserContext()` and greets the logged-in user by name
- Adapts its MUI theme automatically: inherits the **host app's theme** when embedded in OLB, or uses SDK branding when run standalone
- Supports a `standalone` prop — pass `true` only for local development

### qa-automation-widget — SDK Integration Tester

A QA/testing utility widget that validates SDK integration end-to-end.

- Demonstrates the three core SDK hooks: `useUserContext()`, `useBranding()`, and `getHttpClient()`
- Displays user information and platform configuration (environment, API base URL, feature flags)
- Includes an HTTP client test card to fire **positive** (`/api/demo/account-summary`) or **negative** (404) test calls and inspect the response
- Shows a branding theme selector in standalone mode (hidden when embedded in OLB)
- Supports a `standalone` prop — pass `true` only for local development

### investmentportfolio-widget — Investment portfolio sample

A reference widget that shows how to build a **data-rich financial UI** with the CDX SDK and host-aligned theming.

- Displays a **portfolio allocation** donut chart and legend using mock holdings data (`investmentMock.json`) by default
- Reads the logged-in user via `sdk.useUserContext()` (e.g. `fullName` in the overview)
- Uses `sdk.useBranding()` and inherits the **host MUI theme** when embedded in OLB, or wraps with `ThemeProvider` + SDK branding when `standalone` is `true`
- Demonstrates **`sdk.getHttpClient()`** for optional refresh: fetches portfolio JSON from `environment.apiUrl` when you trigger refresh (falls back to a public mock URL for local demos)
- Supports a `standalone` prop — pass `true` only for local development

---

## Getting started (step-by-step)

### 1. Run a widget locally

```bash
nx serve agent-widget
nx serve qa-automation-widget
nx serve investmentportfolio-widget
```

**Default ports:**
- `agent-widget` → `http://localhost:4101`
- `qa-automation-widget` → `http://localhost:4102`
- `investmentportfolio-widget` → `http://localhost:4302`

See [Changing the local port](#changing-the-local-port) if you need to run widgets simultaneously or use a different port.

### 2. Build a widget

```bash
nx build agent-widget --configuration=production
nx build qa-automation-widget --configuration=production
nx build investmentportfolio-widget --configuration=production
```

**Available configurations:** `production`, `stage`, `qal`, `preprod`, `demo`, `development`.

Build output is written to `dist/apps/<widget-name>/` (unchanged for CI; widget source lives under `widgets/web/`).

### 3. Create a new widget

**Option A – Generate (recommended)**

```bash
nx generate @cdx-extensions/widget-template-web:widget <widget-name>
```

Example:

```bash
nx generate @cdx-extensions/widget-template-web:widget my-widget
```

This scaffolds a new app under `widgets/web/` with the following structure — **do not rename, move, or delete any of these files**:

```
widgets/web/<your-widget>/
├── src/
│   ├── app/                        ← your widget component code lives here
│   ├── environments/               ← environment config per build configuration
│   ├── bootstrap.tsx               ← standalone dev entry point — do not modify
│   └── main.ts                     ← module federation async entry — do not modify
├── module-federation.config.ts     ← remote name + exposes — only change `name` and `exposes`
├── webpack.config.ts               ← wires module federation — do not modify
├── project.json                    ← nx build/serve/test targets — only change `port` if needed
├── tsconfig.json                   ← TypeScript project references — do not modify
├── tsconfig.app.json               ← app TypeScript config — do not modify
├── tsconfig.spec.json              ← test TypeScript config — do not modify
└── jest.config.ts                  ← test runner config — do not modify
```

**What you can edit:**

| File / Folder | Can you edit? | Notes |
|---------------|---------------|-------|
| `src/app/` | ✅ Yes — freely | All your widget UI and business logic goes here |
| `src/environments/environment.ts` | ✅ Yes | Set apiUrl and feature flags for local dev |
| `src/environments/environment.prod.ts` | ✅ Yes | Set apiUrl and feature flags for production |
| `src/assets/` | ✅ Yes | Add images, fonts, static files |
| `module-federation.config.ts` | ⚠️ Partially | Only change `name` (widget's remote name) and `exposes` (component path). Do not change anything else. |
| `project.json` | ⚠️ Partially | Only change port under `serve` and `serve-static` if needed. Do not remove or rename targets. |
| `webpack.config.ts` | ❌ Do not touch | Wires Module Federation — any change breaks OLB loading |
| `bootstrap.tsx` | ❌ Do not touch | Required async boundary for Module Federation |
| `main.ts` | ❌ Do not touch | Required async Module Federation entry point |
| `tsconfig.json` / `tsconfig.app.json` / `tsconfig.spec.json` | ❌ Do not touch | Required TypeScript project references |
| `jest.config.ts` | ❌ Do not touch | Required for nx test to work |

**Option B – Copy an existing widget**

Copy `widgets/web/agent-widget`, `widgets/web/qa-automation-widget`, or `widgets/web/investmentportfolio-widget` as a starting point and rename it. When doing this:

- Do **not** delete or modify existing entries in `package.json`
- Do **not** change dependency versions
- Do **not** modify `webpack.config.ts`, `tsconfig*.json`, `main.ts`, or `bootstrap.tsx`
- Only update `name` and `exposes` in `module-federation.config.ts` for your new widget
- Only use packages from the [Shared dependencies](../../README.md#shared-dependencies) table in the repository root README

---

## Testing against the OLB Playground

Once your widget is serving locally, test it inside a real OLB shell using the **OLB Web Playground** — a Docker image that runs the full banking platform and mock BFF on your machine.

> **Full guide:** [playground/web/README.md](../../playground/web/README.md)

## Using the CDX SDK

All platform utilities — `useUserContext`, `useBranding`, and `getHttpClient` — are delegated to the **active platform**: the **web harness** when you run locally, and the **real OLB implementation** when the widget is embedded in production. Your widget code stays the same; only the implementation behind the SDK changes by environment.

### Usage in a widget

Always import from `@cdx-extensions/di-sdk` and use the singleton instance:

```ts
import { PlatformSDK } from '@cdx-extensions/di-sdk';

const sdk = PlatformSDK.getInstance();
const { data: user } = sdk.useUserContext();
const { theme } = sdk.useBranding('branding-1');
const httpClient = sdk.getHttpClient();
```

| API | Purpose |
|-----|---------|
| `useUserContext()` | Logged-in user data (e.g. name, email, institution) for personalization. |
| `useBranding('branding-1')` | MUI theme and branding from the platform (or harness locally). |
| `getHttpClient()` | Authenticated HTTP client for API calls; use this instead of raw `fetch` or Axios. |

> **Important:** Always use `@cdx-extensions/di-sdk` in your widget code. Do **not** import from `di-sdk-web` or `di-sdk-mobile` directly — the main SDK selects the correct implementation at runtime.

---

## Module Federation & OLB integration

Every widget in this repo is a **Module Federation remote**. This is the mechanism OLB uses to load your widget at runtime without bundling it into the host app.

### `module-federation.config.ts`

This is the most important file in your widget. It defines the two values OLB needs to locate and load it:

```ts
// widgets/web/agent-widget/module-federation.config.ts
const config: ModuleFederationConfig = {
  disableNxRuntimeLibraryControlPlugin: true, // required — do not remove
  name: 'agent-widget',                        // ← Remote name
  exposes: {
    './AgentWidget': './src/app/AgentWidget',   // ← Exposed component
  },
};
```

```ts
// widgets/web/qa-automation-widget/module-federation.config.ts
const config: ModuleFederationConfig = {
  disableNxRuntimeLibraryControlPlugin: true,
  name: 'qa-automation-widget',
  exposes: {
    './QaAutomationWidget': './src/app/QaAutomationWidget',
  },
};
```

```ts
// widgets/web/investmentportfolio-widget/module-federation.config.ts
const config: ModuleFederationConfig = {
  disableNxRuntimeLibraryControlPlugin: true,
  name: 'investmentportfolio-widget',
  exposes: {
    './InvestmentportfolioWidget': './src/app/InvestmentportfolioWidget',
  },
};
```

| Field | Purpose |
|-------|---------|
| `name` | **Remote name** — uniquely identifies your widget to the OLB host. Must match exactly what is registered in the NextGen Admin Portal. |
| `exposes` | The component(s) your widget makes available to the host app at runtime. |

> **Do not change the `name` field** without coordinating with the OLB platform team.

> **Do not modify `webpack.config.ts`** — it wires `module-federation.config.ts` into the Webpack build. Any changes will break the Module Federation setup and prevent OLB from loading your widget.

### `remoteEntry.js`

Every `nx build` generates a `remoteEntry.js` in the output folder (build output remains under `dist/apps/<widget>/` for CI compatibility):

```
dist/apps/agent-widget/remoteEntry.js
dist/apps/qa-automation-widget/remoteEntry.js
dist/apps/investmentportfolio-widget/remoteEntry.js
```

This is the **first file OLB fetches at runtime**. It contains the widget's module manifest and shared dependency negotiation logic. OLB loads this file, resolves shared packages (React, MUI, etc.), then dynamically imports the exposed component.

### Registering your widget in OLB

When you are ready to integrate your widget with the OLB platform, provide the platform team with these three values:

| Value | Example |
|-------|---------|
| Remote name | `agent-widget` |
| Remote entry URL | `https://ui.qal.dbk.ncr.com/cdxExtensibility/agent-widget/remoteEntry.js` |
| Exposed component path | `./AgentWidget` |

The OLB host registers your widget using these three values in the NextGen Admin Portal. Until that registration is done, the widget is deployed to GCS but not visible in the platform.

---

## Changing the local port

### Current port assignments

| Widget | Target | Port |
|--------|--------|------|
| `agent-widget` | `nx serve agent-widget` | 4101 |
| `agent-widget` | `nx run agent-widget:serve-static` | 4101 |
| `qa-automation-widget` | `nx serve qa-automation-widget` | 4102 |
| `qa-automation-widget` | `nx run qa-automation-widget:serve-static` | 4102 |
| `investmentportfolio-widget` | `nx serve investmentportfolio-widget` | 4302 |
| `investmentportfolio-widget` | `nx run investmentportfolio-widget:serve-static` | 4302 |

### Option A — Override at the command line (no file change needed)

The quickest way to change the port for a single run:

```bash
nx serve agent-widget --port=4103
nx serve qa-automation-widget --port=4104
nx serve investmentportfolio-widget --port=4305
```

### Option B — Update `project.json` permanently

To persist the port change, edit the widget's `project.json` and update the `port` field under both the `serve` and `serve-static` targets.

Example — changing `agent-widget` to port `4103`:

```json
"serve": {
  "options": {
    "port": 4103
  }
},
"serve-static": {
  "options": {
    "port": 4103
  }
}
```

> **Running widgets simultaneously?** They must use different ports. Use Option A (`--port` flag) or set different ports in each widget's `project.json` so they don't conflict.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| **Widget doesn't load in browser** | Check the port number in the console output. Make sure no other service is using that port. |
| **Module Federation errors** | Do not modify `webpack.config.ts`, `main.ts`, or `bootstrap.tsx`. These files are required for Module Federation. |
| **Build fails with TypeScript errors** | Run `npm install` from the **repo root**. Workspace linking may have failed. |
| **Widget works locally but not in OLB** | Verify your `module-federation.config.ts` `name` field matches exactly what is registered in the NextGen Admin Portal. |
| **Dependency version conflicts** | Only use packages from the [Shared dependencies](../../README.md#shared-dependencies) table. Version mismatches can cause runtime crashes. |

**Still stuck?** Contact the Candescent platform team.

---

## Nx caching

Nx automatically caches `build`, `test`, and `lint` results on your local disk. If the inputs to a task haven't changed, Nx replays the cached output instantly — no configuration needed.

```bash
nx build agent-widget        # replays from cache if nothing changed
```

**Skip the cache for a single run:**

```bash
nx <target> <project> --skip-nx-cache
```

---

## Running tasks

```bash
nx <target> <project>                          # single target
nx run-many -t <target1> <target2>             # multiple targets
nx run-many -t <target1> -p <proj1> <proj2>    # filtered by project
```

Targets are defined in each app's `project.json`. See [Nx docs](https://nx.dev/core-features/run-tasks).

---

## Editor integration

Install [Nx Console](https://nx.dev/nx-console) for VSCode or IntelliJ to get autocomplete, a task runner UI, and generator support.

---

## Repo-specific configuration

If you fork or rename this template, update:

- **`widgets/web/<widget>/project.json`** – replace the `name` field with your widget name
- **`package.json`** – replace `"name"` with your project name
- **`.github/workflows/build-and-deploy-gcp.yaml`** – update the `gcp_bucket` default and `gcs_object_url` for your environment
- **`.whitesource/wss-unified-agent.config`** – set `projectName` and `productName` for your WhiteSource project

---
