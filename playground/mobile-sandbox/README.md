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
| **Port 8083 already in use** | Stop other Metro instances or change the port in `project.json`. |
| **iOS build fails** | Ensure Xcode and iOS Simulator are installed (macOS only). See [Expo iOS setup](https://docs.expo.dev/workflow/ios-simulator/). |
| **Android build fails** | Ensure Android Studio, SDK, and emulator are set up. See [Expo Android setup](https://docs.expo.dev/workflow/android-studio-emulator/). |

**Still stuck?** Contact the Candescent platform team.

---