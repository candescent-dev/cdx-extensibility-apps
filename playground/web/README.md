# OLB Web Playground

A self-contained local OLB (Online Banking) environment packaged as a **single Docker image**. Run the full NextGen OLB shell with all its widget slots and a mock BFF locally — no Candescent network access, no JFrog credentials, no source code needed.

Use this playground to develop and validate your CDX web widgets and JavaScript aspects against the real OLB host before submitting for integration.

---

## Docker image

| |                                                                                                                                                              |
|---|--------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Image** | `ghcr.io/candescent-dev/olb-playground:1.0.0`                                                                                                                |
| **Registry** | [github.com/orgs/candescent-dev/packages/container/package/olb-playground](https://github.com/orgs/candescent-dev/packages/container/package/olb-playground) |

The image contains:
- **nginx** serving the banking-platform shell and all internal widget MF remotes
- **Express mock BFF** (internal, proxied through nginx — no extra port to manage)
- Bundled offline images and mock banking data

---

## Prerequisites

| Requirement | Notes |
|-------------|-------|
| **Docker Desktop** | [docs.docker.com/get-docker](https://docs.docker.com/get-docker/) — no other tools needed |

---

## Quick Start

The `docker-compose.yml` file is already in this folder— no download needed. if not already done, clone the repo and navigate to this directory:
cdx-extensibility-apps/playground/web

```bash

### Step 1 — Pull the image

```bash
docker pull ghcr.io/candescent-dev/olb-playground:1.0.0
```

> The image is hosted at the [Candescent GitHub packages registry](https://github.com/orgs/candescent-dev/packages/container/package/olb-playground). First pull is ~500 MB and is cached for subsequent runs.

### Step 2 — Start
Ensure to run this command from folder where your docker-compose.yml is located (this folder):
```bash
docker compose up or docker compose up -d (for background)
```

### Step 3 — Open the OLB

Open **http://localhost:4200**

> The container is ready when you see `[playground] Playground ready — open http://localhost:4200` in the logs.

---

## Connect Your Widget

### Step 1 — Serve your widget locally

From your widget repository (see [samples/web/README.md](../../samples/web/README.md)):

```bash
nx serve agent-widget    # e.g. http://localhost:4101
```

### Step 2 — Open the Playground

Navigate to **http://localhost:4200** in your browser.

You will see all available widget slots with their current configurations. The three dedicated development slots are **Widget 01**, **Widget 02**, and **Widget 03** — use these to load your own widgets without displacing any built-in content.

### Step 3 — Mount your widget

Click **widget** on one of the widget slots (e.g. Widget 01). A form appears with three fields:

| Field | Description | Example |
|-------|-------------|----|
| **url** | Where your widget is served. | ` http://localhost:4101` |
| **name** | The `name` value from your widget's `module-federation.config.ts` | `agent-widget` |
| **entry** | The exposed component key from `module-federation.config.ts` (without `./`) | `AgentWidget` |


Click  **Save**. your widget appears in the replaced slot.

To restore a slot to its default, restart your container (`docker compose down && docker compose up`).
---

## Available Widget Slots

| extensionId | Default content | Port |
|-------------|----------------|------|
| `com.ncr.dbk.olb.widgets.widget1` | Widget 01 (primary dev slot) | 4220 |
| `com.ncr.dbk.olb.widgets.widget2` | Widget 02 (dev slot) | — |
| `com.ncr.dbk.olb.widgets.widget3` | Widget 03 (dev slot) | — |
| `com.ncr.dbk.olb.widgets.greeting` | greeting-widget | 4201 |
| `com.ncr.dbk.olb.widgets.message` | messages-widget | 4202 |
| `com.ncr.dbk.olb.widgets.purchase-rewards` | purchase-rewards-widget | 4205 |
| `com.ncr.dbk.olb.widgets.quick-actions` | quick-actions-widget | 4209 |
| `com.ncr.dbk.olb.widgets.bill-pay` | billpay-widget | 4210 |
| `com.ncr.dbk.olb.widgets.transfers` | transfers-widget | 4216 |
| `com.ncr.dbk.olb.widgets.widget-stack` | widget-stack | 4219 |
| `com.ncr.dbk.olb.widgets.fdic` | fdic-widget | 4223 |
| `com.ncr.dbk.olb.widgets.my-accounts` | my-accounts-widget | 4226 |

---

## JavaScript Aspects

Aspects are JavaScript snippets injected into the OLB shell at runtime. Use them to simulate chatbots, analytics tags, banners, or any other host-level customisation without rebuilding the image.

### Open the Aspects panel

Navigate to **http://localhost:4200** and click the **Manage Aspects** tab.

### Add an aspect

Click **New submission** and fill in the form:

| Field | Description |
|-------|-------------|
| **name** | A human-readable label shown in the panel |
| **sourceSnippet** | The JavaScript code to run when the OLB shell loads |

**Example snippet** — shows a browser alert when the shell starts:

```javascript
alert('Hello World!');
```

A more realistic example — appending a banner element to the page:

```javascript
const banner = document.createElement('div');
banner.textContent = 'This is a test aspect banner';
banner.style.cssText = 'background:#1976d2;color:#fff;padding:8px 16px;text-align:center;';
document.body.prepend(banner);
```

Click **Add and reload** to register the aspect. The OLB shell will execute the snippet on its next load — refresh **http://localhost:4200** to see it take effect.

### Edit an aspect

In the Aspects list, click **Edit** next to an added aspect name. Update the `sourceSnippet` (or any other field) and click **Save**. Refresh **http://localhost:4200** to see the updated behaviour.

### Delete an aspect

Click **Delete** next to an aspect to remove it immediately. Refresh **http://localhost:4200** to confirm it is no longer running.

> All aspect state is in-memory only. Restarting the container (`docker compose down && docker compose up`) restores the original empty state.

---

## Port Reference

| Port | Service |
|------|---------|
| **4200** | banking-platform shell — **open this in your browser** |
| **4200/playground** | Playground Manager UI — widget slots, aspects, branding |
| 4201 | greeting-widget (MF remote) |
| 4202 | messages-widget (MF remote) |
| 4205 | purchase-rewards-widget (MF remote) |
| 4209 | quick-actions-widget (MF remote) |
| 4210 | billpay-widget (MF remote) |
| 4216 | transfers-widget (MF remote) |
| 4219 | widget-stack (MF remote) |
| 4220 | widget1 / Widget 01 (MF remote — primary dev slot) |
| 4223 | fdic-widget (MF remote) |
| 4226 | my-accounts-widget (MF remote) |

---

## Troubleshooting

### Container exits immediately after `docker compose up`

Check the logs:

```bash
docker compose logs olb-playground
```

The internal BFF must start within 30 seconds. If it fails, the container exits. Try `docker compose up` again.

### OLB loads but shows blank / no widgets

The container needs a few seconds to fully initialise. Wait for `[playground] Playground ready` in the logs then refresh. Also check:

```bash
docker compose ps   # should show "running"
```

### My widget doesn't appear after mounting

1. Confirm your widget is serving (check the terminal where you ran `nx serve`)
3. Confirm the **name** and **entry** fields match your `module-federation.config.ts` exactly
4. Refresh **http://localhost:4200** after clicking Submit
5. Check the browser console errors




restart:

```bash
docker compose down && docker compose up
```

### Port already in use

Open Docker Desktop → check for other running containers using port 4200, or stop the conflicting process before starting the playground.

### Docker Desktop not running

Open Docker Desktop and wait for the whale icon in the menu bar to stop animating, then retry.

---

## Related

- [samples/web/README.md](../../samples/web/README.md) — building and serving web widgets
- [samples/web/aspects/README.md](../../samples/web/aspects/README.md) — sample JavaScript aspects
- [GHCR package page](https://github.com/orgs/candescent-dev/packages/container/package/olb-playground) — image versions and tags
- [docker-compose.yml](./docker-compose.yml) — compose file in this folder
