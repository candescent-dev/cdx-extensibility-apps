# CDX Extensibility Apps

Reference monorepo for **Candescent Digital Experience (CDX) extensibility**.

**What's included:**
- Sample **web** widgets that integrate with the CDX SDKs and the banking platform
- Sample **mobile** packages that integrate with the CDX SDKs and the banking platform
- Working examples to use as a starting point for your own extensions
- A local OLB Web Playground (Docker) for end-to-end widget/aspects testing

---

## 🐳 OLB Web Playground — Docker Image

> **Looking for the Docker image?**
> The `ghcr.io/candescent-dev/olb-playground` image lets you run a full local OLB environment to test your web widgets without any Candescent network access.
>
> **[→ OLB Web Playground setup guide](playground/web/README.md)**

---

**Package manager:** This workspace uses **npm**. Use `npm install` from the repo root, unless a child README says otherwise.

---

## Quick Start

**First time here?** Run these commands to get started:

```bash
git clone <repository-url>
cd cdx-extensibility-apps
npm install
```

**Then choose your platform:**
- **Web widgets** → See [samples/web/README.md](samples/web/README.md)
- **Mobile packages** → See [samples/mobile/README.md](samples/mobile/README.md)

**Need details?** See [Getting started (step-by-step)](#getting-started-step-by-step) below.

---

## Repository layout

| Platform | What's Inside | Entry Point |
|----------|---------------|-------------|
| **Web** | Module Federation widgets that load into the online banking (OLB) web app at runtime | [samples/web/README.md](samples/web/README.md) |
| **Mobile** | React Native packages (widgets and features) published to npm and consumed by the mobile banking app | [samples/mobile/README.md](samples/mobile/README.md) |
| **Mobile Sandbox** | Expo test app for running mobile packages locally | [playground/mobile-sandbox/README.md](playground/mobile-sandbox/README.md) |
| **Web Playground** | Docker image — run a full local OLB instance to test your web widgets against the real shell | [playground/web/README.md](playground/web/README.md) |

**Technical note:** Web and mobile share the same SDK surface (`@cdx-extensions/di-sdk`); packaging and hosting differ (Module Federation vs npm packages). Pinned dependency versions are in **[Shared dependencies](#shared-dependencies)** below.

## Getting started (step-by-step)

### 1. Clone this repo

```bash
git clone <repository-url>
cd cdx-extensibility-apps
```

### 2. Prerequisites (first-time setup)

Before installing, ensure you have the required tools:

| Requirement | Version | Notes |
|-------------|---------|-------|
| **Node.js** | 18 LTS or 20 LTS | Required for all development |
| **npm** | 9+ | Package manager for this workspace. Not every Node 18.x release bundles npm 9+; upgrade npm if `npm -v` is below 9 (for example `npm install -g npm@9`). |
| **Nx** | (optional) | Can use `npx nx` instead of global install |

**Install Node.js:** [https://nodejs.org/](https://nodejs.org/)

Install Nx globally (optional; you can also use `npx nx`):

```bash
npm install --global nx
```

### 3. Configure `.npmrc`

Ensure your repo **`.npmrc`** does **not** contain secrets. Use the template file at:
- **`.npmrc.example`**

### 4. Install dependencies

```bash
npm install
```

**Next steps:**
- **Building web widgets?** → Continue to [samples/web/README.md](samples/web/README.md)
- **Building mobile packages?** → Continue to [samples/mobile/README.md](samples/mobile/README.md)

**Install failed?** See [Troubleshooting](#troubleshooting) below.

## Shared dependencies

> **⚠️ CRITICAL: Use exact versions from these tables**
>
> Pinned versions keep extensions aligned with the **web** and **mobile** banking hosts. Version mismatches may work locally, but can break or misbehave in production with the real host app integration.

**Web** and **mobile** lists are **not interchangeable** — use the table for the platform you target. Workflow and platform-specific notes: **[samples/web/README.md](samples/web/README.md)** and **[samples/mobile/README.md](samples/mobile/README.md)**.

### Web (Module Federation widgets)

| Package                                   | Version    |
|-------------------------------------------|------------|
| `@emotion/react`                          | 11.11.1    |
| `@emotion/styled`                         | 11.11.0    |
| `@mui/icons-material`                     | 7.3.4      |
| `@mui/material`                           | 7.3.4      |
| `@mui/system`                             | 7.3.3      |
| `axios`                                   | 1.14.0     |
| `react`                                   | 18.2.0     |
| `react-dom`                               | 18.2.0     |
| `react-router-dom`                        | ^6.12.1    |
| `@cdx-extensions/di-sdk`                  | 1.1.2      |
| `@cdx-extensions/di-sdk-web`              | 2.1.2      |
| `@cdx-extensions/di-sdk-types`            | 1.1.2      |
| `@cdx-extensions/widget-template-web`     | 1.1.2      |

### Mobile (React Native packages)

| Package                                   | Version              |
|-------------------------------------------|----------------------|
| `react`                                   | 18.3.1               |
| `react-native`                            | 0.76.9               |
| `expo`                                    | ^52.0.0 (optional)   |
| `@cdx-extensions/di-sdk`                  | 1.1.2                |
| `@cdx-extensions/di-sdk-mobile`           | 2.1.2                |
| `@cdx-extensions/di-sdk-types`            | 1.1.2                |
| `@cdx-extensions/widget-template-mobile`  | 1.1.2                |
| `axios`                                   | 0.27.2               |
| `axios-mock-adapter`                      | ^2.1.0               |

> **⚠️ WARNING: Do not add dependencies without approval**
>
> Do not add runtime dependencies outside this list without coordinating with the platform team. Version conflicts between your package and the host app can cause runtime crashes.
>
> If you need a package that is not listed for **web** or **mobile**, contact the **Candescent platform team** before adding it to `package.json`. Share the package name, proposed version, and why you need it. The team will check compatibility with the host bundler and dependency tree, then approve the addition or suggest an alternative.

---

## `package.json` and dependencies

**Do not remove dependencies** from **`package.json`** files in this repository (especially the **root** `package.json` and **workspace** packages) unless the platform team has agreed to the change. This repo relies on **npm workspaces** and **nohoist** configuration so web (Nx) and mobile (Metro/Expo) work together; deleting or trimming dependencies can break installs, local runs, or CI. Only add or upgrade packages when needed and after checking the **Shared dependencies** tables above and the **[samples/web/README.md](samples/web/README.md)** / **[samples/mobile/README.md](samples/mobile/README.md)** guidance.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| **`npm install` fails with 401/403 errors** | Check your `.npmrc` configuration. See [step 3](#3-configure-npmrc) above. |
| **`command not found: nx`** | Either install Nx globally (`npm install -g nx`) or use `npx nx` instead. |
| **Metro/Webpack errors about missing dependencies** | Run `npm install` from the **repo root**, not from a subdirectory. This is an npm workspace — all packages must install together. |
| **TypeScript errors about `@cdx-extensions/*` packages** | Run `npm install` again from the repo root. Workspace linking may have failed. |

**Still stuck?** Contact the Candescent platform team.

---

## Documentation index

| Document | Contents |
|----------|----------|
| **[samples/web/README.md](samples/web/README.md)** | Web widgets, local widget development, Module Federation and OLB integration, Nx targets, creating widgets |
| **[samples/mobile/README.md](samples/mobile/README.md)** | Mobile widgets and features, Nx and tsup, creating mobile widgets, links to the sandbox |
| **[playground/mobile-sandbox/README.md](playground/mobile-sandbox/README.md)** | Expo **mobile sandbox**: prerequisites, running on iOS/Android, how samples are wired, Metro and troubleshooting |
| **[playground/web/README.md](playground/web/README.md)** | **OLB web playground**: Docker image setup, connecting your widget, available slots, runtime API, troubleshooting |
| **[samples/web/aspects/README.md](samples/web/aspects/README.md)** | **Aspect sample scripts**: what each script does, how to inject into real OLB (via platform team) and OLB Playground (via curl or UI) |

Start from the area you are building (web or mobile); follow that README end-to-end before changing build or registry settings.

---
