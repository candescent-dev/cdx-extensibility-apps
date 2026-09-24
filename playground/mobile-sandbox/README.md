# Mobile Sandbox (Expo)

Runner app for CDX Extensibility **mobile** packages. It loads workspace packages from `samples/mobile/*` (and generated `widgets/mobile/*` / `features/mobile/*`) inside React Native + Expo so you can develop and validate against the mobile SDK harness.

---

## Quick Start

> **First time?** Complete the setup in the **[repository root README](../../README.md#getting-started-step-by-step)** and **[mobile README](../../samples/mobile/README.md#getting-started-step-by-step)** first.

```bash
# From repository root
pnpm exec nx start mobile-sandbox         # Start Metro bundler
# In the Metro / Expo terminal (after the dev server is up), press:
i    # iOS Simulator  (macOS only)
a    # Android emulator
# Do not press w — web is not supported in this sandbox
```

**What's included:**
- Sample mobile widgets and features loaded in Expo app
- Platform SDK harness for local development
- Bottom tab navigation to test each sample

---

## Prerequisites

| Requirement | Notes |
|-------------|-------|
| **Node.js & pnpm** | See [repository root README](../../README.md#getting-started-step-by-step) |
| **Expo CLI** | Local binary under this package’s `node_modules` (via `expo start`) — no global install needed |
| **iOS Simulator** (macOS) | [Setup guide](https://docs.expo.dev/workflow/ios-simulator/) or use physical device with [Expo Go](https://expo.dev/go) |
| **Android Emulator** | [Setup guide](https://docs.expo.dev/workflow/android-studio-emulator/) or use physical device with [Expo Go](https://expo.dev/go) |

---

## Getting started

### 1. Install dependencies

```bash
# From repository root
pnpm install --frozen-lockfile                 # Nx / web tooling
pnpm run setup:mobile   # this Expo sandbox (alias: ci:mobile)

# After generate or sandbox package.json changes:
pnpm run sync:mobile    # alias: install:mobile

# Already in playground/mobile-sandbox? Just:
pnpm install --frozen-lockfile                 # clean (lock must match package.json)
pnpm install            # when changing sandbox deps
```

| Script | When |
|--------|------|
| `setup:mobile` / `ci:mobile` | Fresh clone or clean reinstall |
| `sync:mobile` / `install:mobile` | After `nx` generate (new `file:` deps) or manual sandbox dep edits |

Do **not** run `ci:mobile` right after generate — the lockfile will be out of sync until you sync. Prefer `pnpm exec nx start mobile-sandbox` (auto-syncs) or `sync:mobile`.

### 2. Start the sandbox

```bash
pnpm exec nx start mobile-sandbox
```

This starts the Metro bundler on port **8083**. Before Expo starts, the runner:

1. Checks that Expo is installed and auto-syncs the sandbox lockfile if generate added `file:` deps (`MOBILE_SANDBOX_SKIP_SYNC=1` to skip).
2. Builds sample packages (`investment-portfolio`, `agent-feature`) via Nx.
3. Builds any **generated** packages under `widgets/mobile/*` / `features/mobile/*` that are wired as `file:` deps in this sandbox’s `package.json` (missing folders are skipped).

Set `MOBILE_SANDBOX_SKIP_SYNC=1` to skip auto-sync only.

### 3. Run on a platform

In the Metro / Expo terminal (after the dev server is up), press:
```bash
i    # iOS Simulator  (macOS only)
a    # Android emulator
```

**Physical device:**
- Install [Expo Go](https://expo.dev/go) on your device
- Scan the QR code shown in the terminal

Web (`w`) is **not** supported — this sandbox is iOS/Android only.

---

## Single-target preview

For fast iteration on a single widget or feature, append a registry id as a positional argument. The sandbox bypasses tabs and renders just that widget/feature with a thin chrome plus the `BrandingPicker`.

```bash
pnpm exec nx start   mobile-sandbox agent-chat
pnpm exec nx ios     mobile-sandbox investment-portfolio
pnpm exec nx android mobile-sandbox investment-portfolio
```

Valid ids are any `id` in [`registry/WIDGET_REGISTRY.ts`](registry/WIDGET_REGISTRY.ts) or [`registry/FEATURE_REGISTRY.tsx`](registry/FEATURE_REGISTRY.tsx). Omit the id to launch the full sandbox as usual.

The Nx targets ensure **both** `investment-portfolio` and `agent-feature` have a built `dist/` (Metro resolves `main` there). Nx **reuses the cache** when those packages have not changed, so repeat `nx start` / preview runs are quick. To force a clean rebuild, run `pnpm exec nx reset` or pass `--skip-nx-cache` on a one-off `nx run-many` / `nx run` for the sample project you edited.

> Advanced: when invoking via plain `npm run start` from `playground/mobile-sandbox`, set `EXPO_PUBLIC_PREVIEW_TARGET=<id>` instead — the Nx wrapper just forwards the positional id into that env var. **Unset** that variable (or omit the id when using Nx) before a full sandbox run; a leftover export can keep you in preview mode or confuse Metro.

---

## Making changes to samples

**After you edit a sample library**, rebuild it before the sandbox picks up changes:

```bash
pnpm exec nx run investment-portfolio:build   # After editing investment-portfolio
pnpm exec nx run agent-feature:build          # After editing agent-feature
```

Then reload the Expo app (shake device or press `R` in terminal).

---

## App structure

| Layer | Role |
|-------|------|
| **`App.tsx`** | Initializes `PlatformSDK`, provides `BrandingProvider`, `SafeAreaProvider`, `NavigationContainer`, and renders `AppTabs` |
| **`navigation/tabs.tsx`** | Bottom tab navigation with branding picker in header (`useBrandingContext`) |
| **`screens/WidgetsScreen.tsx`** | Renders `PortfolioAllocationScreen` from `@cdx-extensions-examples/investment-portfolio` |
| **`screens/AgentScreen.tsx`** | Renders `AgentChatScreen` from `@cdx-extensions-examples/agent-feature` |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| **Expo not installed / “run setup:mobile”** | `pnpm run setup:mobile` from the repo root. Root `pnpm install --frozen-lockfile` does not install Expo. |
| **`pnpm run ci:mobile` fails after generate** | Generators add `file:` deps without updating the lockfile. Use `pnpm exec nx start mobile-sandbox` (auto-sync) or `pnpm run sync:mobile`. |
| **Metro can't resolve a workspace package** | Check `watchFolders`, `nodeModulesPaths`, and `extraNodeModules` in `metro.config.js`. Run `pnpm run sync:mobile` (and `pnpm install --frozen-lockfile` at the repo root for Nx). |
| **Invalid hook call / useMemo of null** | Duplicate React (sandbox React 19 vs root React 18). Metro must pin `react`/`react-native` via `extraNodeModules` to the sandbox — restart Metro with `--clear`. |
| **Axios / Node crypto errors in React Native** | Keep `axios` on the version in **[Shared dependencies](../../README.md#shared-dependencies)** (mobile table). Prefer the platform HTTP client from the CDX SDK where possible. |
| **Changes to samples not appearing** | Rebuild the sample package (see [Making changes to samples](#making-changes-to-samples) above), then reload the Expo app. |
| **“Unknown preview target” (e.g. got your `--fiId`)** | Preview must match the **`id`** in [`registry/WIDGET_REGISTRY.ts`](registry/WIDGET_REGISTRY.ts) or [`registry/FEATURE_REGISTRY.tsx`](registry/FEATURE_REGISTRY.tsx). For the starter template, that id is the **`--name`** you passed to `nx g …:widget`, not **`--fiId`**. Example: `pnpm exec nx start mobile-sandbox my-widget` if you used `--name=my-widget`. |
| **Single-target id ignored; always see the portfolio widget** | You are likely in the **full** sandbox on the default Widget tab. Preview reads `EXPO_PUBLIC_PREVIEW_TARGET` first; restart Metro after changing the id. Clear a stale export: `unset EXPO_PUBLIC_PREVIEW_TARGET`. |
| **After preview, `pnpm exec nx start mobile-sandbox` “does nothing” / wrong UI** | `run-with-preview.mjs` clears `EXPO_PUBLIC_PREVIEW_TARGET` when you omit the id. If you started Expo outside that script, unset the variable manually. If Metro says port `8083` is in use, stop the other dev server or free the port. |
| **Port 8083 already in use** | Stop other Metro instances or change the port in `project.json`. |
| **Web bundling / Press w fails** | Web is not supported. Use **i** or **a** only. |
| **iOS build fails** | Ensure Xcode and iOS Simulator are installed (macOS only). See [Expo iOS setup](https://docs.expo.dev/workflow/ios-simulator/). |
| **Android build fails** | Ensure Android Studio, SDK, and emulator are set up. See [Expo Android setup](https://docs.expo.dev/workflow/android-studio-emulator/). |
| **`Expo Go is not installed` / `running in offline mode`** | `pnpm exec nx start mobile-sandbox` runs online by default so Expo can install Expo Go when you press **`a`** or **`i`**. If you set `MOBILE_SANDBOX_EXPO_OFFLINE=1` (VPN workaround), install [Expo Go](https://expo.dev/go) on the emulator/device first, or unset that variable. |
| **App won’t load in Expo Go after pulling `develop`** | Recent `develop` uses **Expo SDK 54** (was SDK 52). Run `pnpm run sync:mobile` (or `setup:mobile` on a clean tree), update Expo Go on the emulator/device, then restart Metro. |

**Still stuck?** Contact the Candescent platform team.

---
