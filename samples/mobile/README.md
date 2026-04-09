# CDX Extensibility Apps — Mobile samples

Sample **React Native** packages that extend the mobile banking app using the same **CDX Extensibility SDKs** as web widgets. Mobile samples are **published and consumed as npm packages** (built with **tsup**, CJS + ESM), not Module Federation.

**Shared dependencies (mobile):** pinned versions are listed under **Shared dependencies** in the **[repository root README](../../README.md#shared-dependencies)**.

For web widgets and Module Federation details, see **[samples/web/README.md](../web/README.md)**.

---

## Quick Start

> **First time?** Complete the setup in the **[repository root README](../../README.md#getting-started-step-by-step)** first (Node.js, npm, Nx).

```bash
# From repository root
npx nx start mobile-sandbox         # Start Metro bundler

# In the Metro / Expo terminal (after the dev server is up), press:
i    # iOS Simulator (macOS only)
a    # Android emulator         
```

**Next steps:**
- See [Getting started (step-by-step)](#getting-started-step-by-step) below for full workflow
- Read [Using the CDX SDK](#using-the-cdx-sdk) to understand platform integration
- Check [Mobile Sandbox README](../../playground/mobile-sandbox/README.md) for sandbox details

---

## Samples in this repo

### `feature/agent-feature` — Bring Your Own Agent (BYOA)

React Native feature module: full-screen AI chat with user context and platform-oriented integration.

| Export | Description |
|--------|-------------|
| `AgentChatScreen` | Full-screen chat UI with keyboard handling and agent service |
| `Message` | TypeScript type for a single chat message |

**Path:** `samples/mobile/feature/agent-feature`

### `widgets/investment-portfolio`

Investment portfolio example: donut chart, legend, and sample data hooks.

| Export | Description |
|--------|-------------|
| `PortfolioAllocationScreen` | Full-screen portfolio breakdown |
| `PortfolioItem` | TypeScript type for a single allocation entry |

**Path:** `samples/mobile/widgets/investment-portfolio`

---

## Getting started (step-by-step)

### 1. Prerequisites

| Requirement | Version | Notes |
|-------------|---------|--------|
| **Node.js** | 18 LTS or 20 LTS | Required for Expo, Metro, and native builds |
| **npm** | 9+ | `npx` ships with npm — no separate install needed. Not every Node 18.x release bundles npm 9+; upgrade npm if `npm -v` is below 9. |
| **Nx** | 22+ (or use `npx nx`) | Global install is optional; prefix commands with `npx` instead |
| **Expo CLI** | Included via `npx expo` | No global install needed |
| **iOS Simulator** (macOS) or **Android Emulator** | Latest stable | Or a physical device with [Expo Go](https://expo.dev/go). **iOS:** [Set up iOS Simulator](https://docs.expo.dev/workflow/ios-simulator/). **Android:** [Set up Android Emulator](https://docs.expo.dev/workflow/android-studio-emulator/). |

### 2. Run the mobile sandbox (Expo)

The sandbox app under `playground/mobile-sandbox` hosts the sample packages. **Metro uses port 8083.**

```bash
npx nx start mobile-sandbox

# In the Metro / Expo terminal (after the dev server is up), press:
i    # iOS Simulator (macOS only)
a    # Android emulator     
```

The sandbox initializes `PlatformSDK` with the mobile harness (`MobilePlatform`, `BrandingProvider` from `@cdx-extensions/di-sdk-mobile`). Tab **Widget Example** loads `investment-portfolio`; tab **Agent Chat** loads `agent-feature`. See `playground/mobile-sandbox/App.tsx`, `navigation/tabs.tsx`, and `screens/`.

For more details, see the **[Mobile Sandbox README](../../playground/mobile-sandbox/README.md)**.

### 3. Build or typecheck a sample

From the repo root:

```bash
npx nx run investment-portfolio:typecheck
npx nx run investment-portfolio:build

npx nx run agent-feature:typecheck
npx nx run agent-feature:build
```

Or from a package directory after install:

```bash
npm run typecheck
npm run build
```

---

## Using the CDX SDK

Use the **same entry point as web widgets**: import from `@cdx-extensions/di-sdk` only. Do **not** import `@cdx-extensions/di-sdk-web` or `@cdx-extensions/di-sdk-mobile` directly in widget or feature package code — the main SDK selects the correct implementation at runtime when the host (or sandbox) has initialized the platform.

### Usage in a widget or feature

Typical usage from a **React component** or **custom hook** (hooks must follow the rules of hooks):

```ts
import { PlatformSDK } from '@cdx-extensions/di-sdk';

const sdk = PlatformSDK.getInstance();

// Logged-in user (personalization). Returns hook result; e.g. `data` with user fields.
const { data: userContext } = sdk.useUserContext();

// Branding / theme from the platform or sandbox harness. Web often passes a branding id, e.g. `'branding-1'`.
const { theme } = sdk.useBranding();
// or: sdk.useBranding('branding-1');

// Authenticated API client — use for network calls instead of raw `fetch` / ad hoc Axios.
const httpClient = sdk.getHttpClient();
```

| API | Purpose |
|-----|---------|
| `useUserContext()` | Logged-in user data (e.g. name, email, institution) for personalization. |
| `useBranding()` | React Native theme and branding from the platform (or sandbox harness locally). |
| `getHttpClient()` | Authenticated HTTP client for API calls; use this instead of raw `fetch` or Axios. |

---

## Create a new mobile feature or widget (starter template)

The package **`@cdx-extensions/widget-template-mobile`** ships two Nx generators — **`feature`** (full-screen route) and **`widget`** (embedded component). Both produce a React Native library wired for `@cdx-extensions/di-sdk`, built with tsup, and auto-registered with the sandbox.

For the full walkthrough — scaffolded file layout, what you can edit, common pitfalls, and host-app integration — see **[Widgets — Mobile](https://docs.candescent.com/guides/Building%20Extensions/Widgets/Mobile/overview/)** in the Candescent developer documentation.

### Commands

From the repository root (use `npx nx` if Nx is not installed globally):

**Feature** — full-screen experience with its own navigation route:

```bash
nx generate @cdx-extensions/widget-template-mobile:feature --fiId=<fi-id> --name=<name>
```

**Widget** — component embedded within an existing screen:

```bash
nx generate @cdx-extensions/widget-template-mobile:widget --fiId=<fi-id> --name=<name>
```

| Option | Required | Description |
|--------|----------|-------------|
| `--fiId` | Yes | Your FI id. Used as the package scope — generated package name is `@<fiId>-extensions/<name>`. |
| `--name` | Yes | Feature or widget name (e.g. `account-summary`). Used as the Nx project name and folder name. |

### Examples

```bash
# Feature
nx generate @cdx-extensions/widget-template-mobile:feature --fiId=0000 --name=my-feature

# Widget
nx generate @cdx-extensions/widget-template-mobile:widget --fiId=0000 --name=my-widget
```

After generation, install and run the sandbox to verify:

```bash
npm install
npx nx start mobile-sandbox
```

### Align `@cdx-extensions/di-sdk` and `@cdx-extensions/di-sdk-types`

The generator template’s **`package.json`** may pin older **peer** versions than this monorepo (or omit `@cdx-extensions/di-sdk-types`). Before you treat the new package as done:

1. Open the generated **`package.json`** under `samples/mobile/feature/<name>/` or `samples/mobile/widgets/<name>/`.
2. In **`peerDependencies`**, set **`@cdx-extensions/di-sdk`** and **`@cdx-extensions/di-sdk-types`** to the exact versions in **[Shared dependencies](../../README.md#shared-dependencies)** (mobile table in the repository root README). Add **`@cdx-extensions/di-sdk-types`** if it is missing.
3. Run **`npm install`** again from the **repository root** so the workspace resolves the same versions as the sandbox and other samples.

### Option B — Copy an existing sample

1. Copy `samples/mobile/feature/agent-feature` or `samples/mobile/widgets/investment-portfolio` (or another mobile package).
2. Update **`package.json`:** `name` (and scope if required), reset `version`, keep **peerDependencies** for `react`, `react-native`, `expo` (if used), `@cdx-extensions/di-sdk`, **`@cdx-extensions/di-sdk-types`** (same versions as **[Shared dependencies](../../README.md#shared-dependencies)**), and add peers such as `react-native-svg` if needed.
3. Update **`project.json`:** `name`, `root`, `sourceRoot`, and `outputs` / `--outDir` in the `build` target to match the new folder.
4. Implement and export from `src/index.ts`.
5. Wire into the sandbox: dependency in `playground/mobile-sandbox/package.json` and render in the appropriate screen (e.g. `screens/WidgetsScreen.tsx` or a new tab).

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| **Metro can't resolve a workspace package** | Check `watchFolders`, `nodeModulesPaths`, and `extraNodeModules` in `playground/mobile-sandbox/metro.config.js`. Run `npm install` from the repo root. |
| **Axios / Node crypto errors in React Native** | Keep `axios` on the version in **[Shared dependencies](../../README.md#shared-dependencies)** (mobile table). Prefer `sdk.getHttpClient()` for API calls. |
| **Changes to samples not appearing in sandbox** | Rebuild the sample package (`npx nx run <package>:build`), then reload the Expo app. |
| **TypeScript errors about `@cdx-extensions/*` packages** | Run `npm install` from the repo root. Workspace linking may have failed. |
| **Build fails with missing peer dependencies** | Ensure all peer dependencies listed in sample `package.json` are installed. Check `playground/mobile-sandbox/package.json`. |
| **Generated feature/widget won’t build, or TypeScript types disagree with other packages** | The template may ship stale SDK peers. In the new package’s `package.json`, align **`peerDependencies`** for **`@cdx-extensions/di-sdk`** and **`@cdx-extensions/di-sdk-types`** with **[Shared dependencies](../../README.md#shared-dependencies)** (mobile table); add **`di-sdk-types`** if omitted. Then **`npm install`** from the repo root. |

**Still stuck?** Contact the Candescent platform team.

---

## Running tasks

```bash
npx nx <target> <project>
npx nx run-many -t <target1> <target2>
npx nx run-many -t <target1> -p <proj1> <proj2>
```

See [Nx docs](https://nx.dev/core-features/run-tasks).

---

## Editor integration

Install [Nx Console](https://nx.dev/nx-console) for VS Code or IntelliJ for task and generator discovery.

---