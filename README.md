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
| **Mobile Widgets** | Generated React Native widgets | `widgets/mobile/` |
| **Mobile Features** | Generated React Native features | `features/mobile/` |
| **Mobile Samples** | Reference packages (investment-portfolio, agent-feature) | `samples/mobile/` |
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
| **GitHub CLI (`gh`)** | latest | Required for `npm run submit-to-fi` — list and create PRs in your FI repo |

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

## Submit to FI extensions repo

After you build and test a widget, feature, or aspect in this repo, use the submit script to copy it into your **FI extensions repo** and open or update a GitHub PR there.

```bash
npm run submit-to-fi
```

Prompts for: FI repo Git URL, local clone path, and project name (widget, feature, or aspect).

This is a convenience wrapper around `node tools/scripts/submit-to-fi-repo.js` — both commands do the same thing.

### What it does

1. **Finds the project** in this repo by name (web widget, mobile widget, mobile feature, or web aspect).
2. **Clones or reuses** a local copy of your FI extensions repo.
3. **Syncs source files** into the matching path in the FI repo (excludes `node_modules`, `dist`, `.nx`, `coverage`, `.expo`).
4. **Commits and pushes** only the synced project path (not build artifacts or cache).
5. **Creates or updates a PR** in the FI repo via `gh`.

If the project has a `metadata.json`, its contents are added to the PR description.

### Supported project types

| Type | Looked up under |
|------|-----------------|
| Web widget | `widgets/web/`, `samples/web/widgets/` |
| Mobile widget | `widgets/mobile/`, `samples/mobile/widgets/` |
| Mobile feature | `features/mobile/`, `samples/mobile/feature/` |
| Web aspect | `samples/web/aspects/` |

If the same name exists in more than one location, the script prompts you to choose.

### PR behavior

- **New PR:** creates branch `feature/add-<project>-<timestamp>` and opens a PR against the FI repo default branch.
- **Update existing PR:** if an open PR exists on a `feature/add-<project>*` branch, the script updates that PR instead (prompts when multiple match).
- **Force new PR:** pass `--new-pr` to skip existing open PRs.

### CLI flags

All prompts can be skipped by passing flags:

```bash
npm run submit-to-fi -- \
  --fi-url https://github.com/your-org/your-fi-extensions-repo \
  --local-path ../your-fi-extensions-repo \
  --project my-widget-name
```

| Flag | Description |
|------|-------------|
| `--fi-url` | Git URL of your FI extensions repo |
| `--local-path` | Path to an existing FI repo clone, or a parent folder (cloned if missing) |
| `--project` | Widget, feature, or aspect folder name |
| `--new-pr` | Always create a new PR instead of updating an existing one |

### Requirements

- **git** — clone, commit, and push in the FI repo
- **[GitHub CLI (`gh`)](https://cli.github.com/)** — list, create, and edit PRs (`gh auth login` with access to your FI repo)

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
| `axios`                                   | 1.16.0     |
| `react`                                   | 18.2.0     |
| `react-dom`                               | 18.2.0     |
| `react-router-dom`                        | ^6.12.1    |
| `@cdx-extensions/di-sdk`                  | 1.1.4      |
| `@cdx-extensions/di-sdk-web`              | 2.1.4      |
| `@cdx-extensions/di-sdk-types`            | 1.1.4      |
| `@cdx-extensions/widget-template-web`     | 1.1.5      |

### Mobile (React Native packages)

| Package                                   | Version              |
|-------------------------------------------|----------------------|
| `react`                                   | 19.1.4               |
| `react-native`                            | 0.81.6               |
| `expo`                                    | ~54.0.0 (optional)   |
| `@cdx-extensions/di-sdk`                  | 1.1.4                |
| `@cdx-extensions/di-sdk-mobile`           | 2.1.6                |
| `@cdx-extensions/di-sdk-types`            | 1.1.4                |
| `@cdx-extensions/widget-template-mobile`  | 1.1.8                |
| `axios`                                   | 1.15.0               |
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
| **`npm install` fails with peer dependency conflicts (React)** | The repo pins **React 18** at the root for **web** while **mobile** (`playground/mobile-sandbox`) uses **React 19** + RN 0.81.x. `.npmrc` enables **`legacy-peer-deps`** so npm can install both trees. Run **`npm install` from the repo root** only. |
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
