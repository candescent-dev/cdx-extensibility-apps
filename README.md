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

**Package manager:** This repo uses **pnpm** with **two install roots**:

| Track | Where | Clean install | Refresh deps |
|-------|--------|---------------|--------------|
| **Web / Nx** | Repository root | `pnpm install --frozen-lockfile` | `pnpm install` |
| **Mobile / Expo** | [`playground/mobile-sandbox`](playground/mobile-sandbox) | `pnpm run setup:mobile` (or `ci:mobile`) | `pnpm run sync:mobile` (or `install:mobile`) |

Both `pnpm install --frozen-lockfile` and `pnpm install` work in each root. Prefer `pnpm install --frozen-lockfile` / `setup:mobile` for a clean checkout; use `sync:mobile` when changing sandbox dependencies (including after generate). Do **not** expect Expo/React Native under the repo-root `node_modules`.

---

## Quick Start

**First time here?** Run these commands to get started:

```bash
git clone <repository-url>
cd cdx-extensibility-apps
corepack enable   # one-time; ships with Node 18+
pnpm run setup              # pnpm install --frozen-lockfile + setup:mobile (or: pnpm install --frozen-lockfile && pnpm run ci:mobile)
```

**Then choose your platform:**
- **Web widgets** → See [samples/web/README.md](samples/web/README.md)
- **Mobile packages** → See [samples/mobile/README.md](samples/mobile/README.md)

### Mobile dev loop

**First-time (once per clone):**

```bash
pnpm install --frozen-lockfile
pnpm run setup:mobile       # same as pnpm run ci:mobile
```

**Daily (catalog generate → build → start):**

```bash
pnpm exec nx run generate-mobile-extensions
pnpm exec nx run generate-mobile-widget -- --fiId=0123 --template=credit-score --name=test-widget
pnpm exec nx run generate-mobile-feature -- --template=agent-chat --fiId=0123 --name=my-feature

pnpm exec nx start mobile-sandbox    # builds samples + wired generated packages; auto-syncs lockfile
# press i (iOS) or a (Android) — web (w) is not supported
```

After generate, do **not** run `pnpm run ci:mobile` (lockfile will be out of sync). `pnpm exec nx start mobile-sandbox` syncs automatically, or run `pnpm run sync:mobile` manually.

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
| **Node.js** | 18 or 20 LTS | See `engines` in root `package.json`. |
| **pnpm** | 9+ | Package manager for this workspace (`packageManager` in root `package.json`). Enable with `corepack enable`. |
| **Nx** | (optional) | Can use `pnpm exec nx` instead of global install |
| **GitHub CLI (`gh`)** | latest | Required for `pnpm run submit-to-fi` — list and create PRs in your FI repo |

**Install Node.js:** [https://nodejs.org/](https://nodejs.org/)

Install Nx globally (optional; you can also use `pnpm exec nx`):

```bash
pnpm install --global nx
```

### 3. Configure `.npmrc`

Ensure your repo **`.npmrc`** does **not** contain secrets. Use the template file at:
- **`.npmrc.example`**

### 4. Install dependencies

**Web / Nx (repository root):**

```bash
pnpm install --frozen-lockfile          # clean install from lockfile
pnpm install     # when adding/changing root dependencies
```

**Mobile / Expo** (separate install — skips Expo/RN on web-only machines):

```bash
# From repository root (no need to cd):
pnpm run setup:mobile    # clean install (alias: ci:mobile)
pnpm run sync:mobile     # after generate or sandbox dep changes (alias: install:mobile)

# One-shot first-time setup (root + sandbox):
pnpm run setup

# Or from inside playground/mobile-sandbox:
pnpm install --frozen-lockfile
pnpm install
```

Do **not** use `ci:mobile` / `setup:mobile` right after generating a widget/feature — the sandbox lockfile will not include the new `file:` deps yet. Prefer `pnpm exec nx start mobile-sandbox` (auto-sync) or `pnpm run sync:mobile`.
#### Windows cloud / VDI notes

Expo/React Native installs write deep trees under `playground/mobile-sandbox/node_modules`. On Windows:

1. Clone to a **short path without spaces** (for example `C:\src\cdx-apps`). Long paths like `C:\Users\...\Tools and SDK\...` often hit `MAX_PATH`.
2. Enable Win32 long paths (`LongPathsEnabled=1`).
3. Exclude the repo (or at least `node_modules`) from Microsoft Defender real-time scanning — otherwise installs can appear to hang.
4. Use **Node 18 or 20 LTS** and **pnpm 9+** (see `engines` / `packageManager` in root `package.json`).
5. If install still fails, capture logs with `pnpm install --frozen-lockfile --loglevel verbose` (look for `ENAMETOOLONG`, `EPERM`, network/TLS errors). See [DEVEX-6748](https://candescentco.atlassian.net/browse/DEVEX-6748).

**Next steps:**
- **Building web widgets?** → Continue to [samples/web/README.md](samples/web/README.md)
- **Building mobile packages?** → Continue to [samples/mobile/README.md](samples/mobile/README.md)

**Install failed?** See [Troubleshooting](#troubleshooting) below.

## Submit to FI extensions repo

After you build and test a widget, feature, or aspect in this repo, use the submit script to copy it into your **FI extensions repo** and open or update a GitHub PR there.

```bash
pnpm run submit-to-fi
```

Prompts for: FI repo Git URL, local clone path, and project name (widget, feature, or aspect).

This is a convenience wrapper around `node tools/scripts/submit-to-fi-repo.js` — both commands do the same thing.

### What it does

1. **Finds the project** in this repo by name (web widget, mobile widget, mobile feature, or web aspect).
2. **Clones or reuses** a local copy of your FI extensions repo.
3. **Syncs source files** into the matching path in the FI repo (excludes `node_modules`, `dist`, `.nx`, `coverage`, `.expo`).
4. **Validates mobile packages** with `pnpm install` in the synced folder, updates root `pnpm-lock.yaml` when needed, and verifies with `pnpm install --frozen-lockfile` at the FI repo root.
5. **Commits and pushes** the synced project path and root `pnpm-lock.yaml` when the lockfile changed (not build artifacts or cache).
6. **Creates or updates a PR** in the FI repo via `gh`.

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
pnpm run submit-to-fi -- \
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
| `axios`                                   | 1.19.0     |
| `react`                                   | 18.2.0     |
| `react-dom`                               | 18.2.0     |
| `react-router-dom`                        | ^6.12.1    |
| `@cdx-extensions/di-sdk`                  | 1.1.7      |
| `@cdx-extensions/di-sdk-web`              | 2.1.8      |
| `@cdx-extensions/di-sdk-types`            | 1.1.8      |
| `@cdx-extensions/widget-template-web`     | 1.1.6      |

### Mobile (React Native packages)

| Package                                   | Version              |
|-------------------------------------------|----------------------|
| `react`                                   | 19.1.4               |
| `react-native`                            | 0.81.6               |
| `expo`                                    | ~54.0.0 (optional)   |
| `@cdx-extensions/di-sdk`                  | 1.1.7                |
| `@cdx-extensions/di-sdk-mobile`           | 2.1.9                |
| `@cdx-extensions/di-sdk-types`            | 1.1.8                |
| `@cdx-extensions/extension-generator-mobile` | 1.1.6             |
| `@cdx-extensions/widget-template-mobile`  | 1.1.12               |
| `axios`                                   | 1.19.0               |
| `axios-mock-adapter`                      | ^2.1.0               |
> **⚠️ WARNING: Do not add dependencies without approval**
>
> Do not add runtime dependencies outside this list without coordinating with the platform team. Version conflicts between your package and the host app can cause runtime crashes.
>
> If you need a package that is not listed for **web** or **mobile**, contact the **Candescent platform team** before adding it to `package.json`. Share the package name, proposed version, and why you need it. The team will check compatibility with the host bundler and dependency tree, then approve the addition or suggest an alternative.

---

## `package.json` and dependencies

**Do not remove dependencies** from **`package.json`** files in this repository (especially the **root** `package.json` and **mobile sandbox** `package.json`) unless the platform team has agreed to the change.

Installs are **split on purpose** for speed and React majors:

- **Root** — web/Nx (React **18**). No Expo/React Native.
- **`playground/mobile-sandbox`** — Expo/Metro (React **19** + RN). Samples are linked via `file:` dependencies.

Only add or upgrade packages when needed and after checking the **Shared dependencies** tables above and the **[samples/web/README.md](samples/web/README.md)** / **[samples/mobile/README.md](samples/mobile/README.md)** guidance.

Mobile sample/template packages should declare `react` / `react-native` as **peerDependencies** only (runtime comes from the sandbox). Do not re-add them as `devDependencies`.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| **Missing Expo / Metro / `react-native`** | Install the mobile root: `pnpm run setup:mobile` (or `ci:mobile`). Root install is web-only. |
| **`pnpm run ci:mobile` fails after generate** | Expected — generators add `file:` deps to sandbox `package.json` without updating the lockfile. Run `pnpm exec nx start mobile-sandbox` (auto-syncs) or `pnpm run sync:mobile`. Do not use `ci:mobile` until the lock is synced. |
| **`pnpm install` is slow or fails on Windows** | Use a short clone path without spaces, enable Win32 long paths, exclude `node_modules` from Defender, use Node 18/20 + pnpm 9+, and run `pnpm install --frozen-lockfile` in the correct root (repo vs sandbox). See [Windows cloud / VDI notes](#4-install-dependencies). |
| **`pnpm install` fails with 401/403 errors** | Check your `.npmrc` configuration. See [step 3](#3-configure-npmrc) above. |
| **`command not found: nx`** | Either install Nx globally (`pnpm install -g nx`) or use `pnpm exec nx` instead. |
| **Metro/Webpack errors about missing dependencies** | Web: `pnpm install --frozen-lockfile` / `pnpm install` at repo root. Mobile: `pnpm run setup:mobile` / `sync:mobile`, or the same commands inside `playground/mobile-sandbox`. |
| **TypeScript errors about `@cdx-extensions/*` packages** | Re-run `pnpm install --frozen-lockfile` in the install root that owns that package (root for web SDK; sandbox for mobile). |

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
