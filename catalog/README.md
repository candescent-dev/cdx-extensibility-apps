# Extension template catalog

**Published catalog:** `[extension-templates.json](extension-templates.json)` — synced automatically from platform dev sources. **Do not edit by hand.**

At **generate time**, the extension generator fetches the catalog from a **remote public URL** (not this local file). FIs with a frozen repo copy still receive updated template metadata without `git pull`.

---

## Generate mobile extensions

Template overlays are downloaded from **public npm** when you run the generator.

### What you get from remote vs npm


| Source             | What                                                      | How                                        |
| ------------------ | --------------------------------------------------------- | ------------------------------------------ |
| **Public raw URL** | `catalog/extension-templates.json`                        | Fetched automatically when you generate    |
| **npm**            | `@cdx-extensions/extension-template-mobile-<id>` overlays | Downloaded automatically when you generate |




### Setup

1. **Configure registry** in root `.npmrc` (see `[.npmrc.example](../.npmrc.example)`):
  ```ini
   @cdx-extensions:registry=https://registry.npmjs.org/
  ```
   The same `.npmrc` used for `npm install` of `@cdx-extensions/*` also applies to generator overlay downloads and optional `npm pack`.

2. **Internal Candescent devs (JFrog)** — use the same `.npmrc` pattern as other `@cdx-extensions` packages (in repo `.npmrc` or `~/.npmrc`; do not commit secrets):
  ```ini
   @cdx-extensions:registry=https://candescent.jfrog.io/artifactory/api/npm/digitalbanking-npm-group/
   //candescent.jfrog.io/artifactory/api/npm/digitalbanking-npm-group/:_authToken=${JFROG_NPM_AUTH_TOKEN}
  ```

3. **Generator** — `@cdx-extensions/extension-generator-mobile` (see root `package.json`)

**Troubleshooting:** If generate fails with 401/403, verify `@cdx-extensions:registry` and the matching `//{host}{path}/:_authToken` line in your `.npmrc`.



### Generate


| Command | Why |
| ------- | --- |
| `npx nx run generate-mobile-extensions` | Interactive: type (from catalog) → category → template → fiId → name |
| `npx nx run generate-mobile-widget` | Widgets only |
| `npx nx run generate-mobile-feature` | Features only |
| `npx nx run generate-mobile-widget -- --template=investment-portfolio --fiId=0123 --name=my-widget` | Skip prompts (4-digit FI id) |
| `npx nx run generate-mobile-widget -- --template=investment-portfolio --fiId=03100 --name=my-widget` | Skip prompts (5-digit FI id) |
| `npx nx run generate-mobile-feature -- --template=agent-chat --fiId=0123 --name=my-feature` | Skip prompts |

Output: `widgets/mobile/<name>/` or `features/mobile/<name>/` depending on template type.

**FI Id:** digits only (`0-9`). Accepts **4 or 5 digits** (e.g. `0123`, `03100`). Values shorter than 4 digits are zero-padded (`123` → `0123`). Leading zeros are preserved when you pass `--fiId` on the command line.

`generate-mobile-extensions` lists only extension types present in the catalog.

Re-fetch catalog and overlays after platform publishes:

```bash
npx nx run generate-mobile-widget -- --template=investment-portfolio --fiId=0123 --name=my-widget --noCache
```

The catalog is cached locally for ~5 minutes; use `--noCache` right after editing the remote JSON on GitHub. If the remote URL is unreachable, the generator falls back to **stale cache**, then local `catalog/extension-templates.json`.

Override catalog URL (optional):

```bash
export CDX_EXTENSION_CATALOG_URL="https://raw.githubusercontent.com/..."
# or --catalogUrl=... on nx g
```



### WireMock stub for `credit-score`

The `credit-score` template defaults to `GET https://cdx-extensions.wiremockapi.cloud/credit-score`. Deploy the stub mapping before running generator API validation without `--skipApiValidation`:

```bash
wiremock import tools/wiremock/credit-score.mapping.json --to=cdx-extensions
```

Mapping file: [`tools/wiremock/credit-score.mapping.json`](../tools/wiremock/credit-score.mapping.json)

### Manual prefetch (optional)

```bash
npm pack @cdx-extensions/extension-template-mobile-investment-portfolio@1.0.0
```

