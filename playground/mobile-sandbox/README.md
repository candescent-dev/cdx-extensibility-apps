# Mobile Sandbox (Expo)

Runner app for CDX Extensibility **mobile** packages. It loads workspace packages from `widgets/mobile/*`, `features/mobile/*`, and `samples/mobile/*` inside React Native + Expo so you can develop and validate against the mobile SDK harness.

---

## Quick Start

> **First time?** Complete the setup in the **[repository root README](../../README.md#getting-started-step-by-step)** and **[mobile README](../../samples/mobile/README.md#getting-started-step-by-step)** first.

```bash
# From repository root
npx nx start mobile-sandbox         # Start Metro bundler
# In the Metro / Expo terminal (after the dev server is up), press:
i    # iOS Simulator  (macOS only)
a    # Android emulator  
```

**What's included:**
- Sample mobile widgets and features loaded in Expo app
- Platform SDK harness for local development
- Bottom tab navigation to test each sample

---

## Prerequisites

| Requirement | Notes |
|-------------|-------|
| **Node.js & npm** | See [repository root README](../../README.md#getting-started-step-by-step) |
| **Expo CLI** | Included via `npx expo` — no global install needed |
| **iOS Simulator** (macOS) | [Setup guide](https://docs.expo.dev/workflow/ios-simulator/) or use physical device with [Expo Go](https://expo.dev/go) |
| **Android Emulator** | [Setup guide](https://docs.expo.dev/workflow/android-studio-emulator/) or use physical device with [Expo Go](https://expo.dev/go) |

---

## Getting started

### 1. Install dependencies

```bash
# From repository root (required for workspace packages)
npm install
```

### 2. Start the sandbox

```bash
npx nx start mobile-sandbox
```

This starts the Metro bundler on port **8083**.

### 3. Run on a platform

In the Metro / Expo terminal (after the dev server is up), press:
```bash
i    # iOS Simulator  (macOS only)
a    # Android emulator  
```

**Physical device:**
- Install [Expo Go](https://expo.dev/go) on your device
- Scan the QR code shown in the terminal

---

## Single-target preview

For fast iteration on a single widget or feature, append a registry id as a positional argument. The sandbox bypasses tabs and renders just that widget/feature with a thin chrome plus the `BrandingPicker`.

```bash
npx nx start   mobile-sandbox agent-chat
npx nx ios     mobile-sandbox investment-portfolio
npx nx android mobile-sandbox investment-portfolio
```

Valid ids are any `id` in [`registry/WIDGET_REGISTRY.ts`](registry/WIDGET_REGISTRY.ts) or [`registry/FEATURE_REGISTRY.tsx`](registry/FEATURE_REGISTRY.tsx). Omit the id to launch the full sandbox as usual.

The Nx targets ensure **both** `investment-portfolio` and `agent-feature` have a built `dist/` (Metro resolves `main` there). Nx **reuses the cache** when those packages have not changed, so repeat `nx start` / preview runs are quick. To force a clean rebuild, run `npx nx reset` or pass `--skip-nx-cache` on a one-off `nx run-many` / `nx run` for the sample project you edited.

> Advanced: when invoking via plain `npm run start --workspace=mobile-sandbox`, set `EXPO_PUBLIC_PREVIEW_TARGET=<id>` instead — the Nx wrapper just forwards the positional id into that env var. **Unset** that variable (or omit the id when using Nx) before a full sandbox run; a leftover export can keep you in preview mode or confuse Metro.

---

## Making changes to samples

**After you edit a sample library**, rebuild it before the sandbox picks up changes:

```bash
npx nx run investment-portfolio:build   # After editing investment-portfolio
npx nx run agent-feature:build          # After editing agent-feature
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
| **Metro can't resolve a workspace package** | Check `watchFolders`, `nodeModulesPaths`, and `extraNodeModules` in `metro.config.js`. Run `npm install` from the repo root. |
| **Axios / Node crypto errors in React Native** | Keep `axios` on the version in **[Shared dependencies](../../README.md#shared-dependencies)** (mobile table). Prefer the platform HTTP client from the CDX SDK where possible. |
| **Changes to samples not appearing** | Rebuild the sample package (see [Making changes to samples](#making-changes-to-samples) above), then reload the Expo app. |
| **“Unknown preview target” (e.g. got your `--fiId`)** | Preview must match the **`id`** in [`registry/WIDGET_REGISTRY.ts`](registry/WIDGET_REGISTRY.ts) or [`registry/FEATURE_REGISTRY.tsx`](registry/FEATURE_REGISTRY.tsx). For the starter template, that id is the **`--name`** you passed to `nx g …:widget`, not **`--fiId`**. Example: `npx nx start mobile-sandbox my-widget` if you used `--name=my-widget`. |
| **Single-target id ignored; always see the portfolio widget** | You are likely in the **full** sandbox on the default Widget tab. Preview reads `EXPO_PUBLIC_PREVIEW_TARGET` first; restart Metro after changing the id. Clear a stale export: `unset EXPO_PUBLIC_PREVIEW_TARGET`. |
| **After preview, `nx start mobile-sandbox` “does nothing” / wrong UI** | `run-with-preview.mjs` clears `EXPO_PUBLIC_PREVIEW_TARGET` when you omit the id. If you started Expo outside that script, unset the variable manually. If Metro says port `8083` is in use, stop the other dev server or free the port. |
| **Port 8083 already in use** | Stop other Metro instances or change the port in `project.json`. |
| **iOS build fails** | Ensure Xcode and iOS Simulator are installed (macOS only). See [Expo iOS setup](https://docs.expo.dev/workflow/ios-simulator/). |
| **Android build fails** | Ensure Android Studio, SDK, and emulator are set up. See [Expo Android setup](https://docs.expo.dev/workflow/android-studio-emulator/). |
| **`Expo Go is not installed` / `running in offline mode`** | `npx nx start mobile-sandbox` runs online by default so Expo can install Expo Go when you press **`a`** or **`i`**. If you set `MOBILE_SANDBOX_EXPO_OFFLINE=1` (VPN workaround), install [Expo Go](https://expo.dev/go) on the emulator/device first, or unset that variable. |
| **App won’t load in Expo Go after pulling `develop`** | Recent `develop` uses **Expo SDK 54** (was SDK 52). Run `npm install` from the repo root, update Expo Go on the emulator/device, then restart Metro. |

**Still stuck?** Contact the Candescent platform team.

---