# CDX Aspects — Sample Scripts

**Aspects** are self-contained JavaScript snippets that the OLB shell executes at page load. They let you inject UI elements (banners, chatbots, notifications), analytics tags, or custom behaviour into the banking platform **without modifying any widget source code**.

> **Test aspects in the OLB Playground before submitting to the platform team.** See [Testing in the OLB Playground](#testing-in-the-olb-playground) below.

---

## Sample aspects in this folder

### `contextless_promo_banner.js`

Injects a **dismissible promotional banner** at the top of the OLB page.

- Configurable message, background color, and text color via `BANNER_CONFIG` at the top of the file
- Includes a close button (×) — users can dismiss the banner for the session
- No OLB session data required — works as a pure DOM injection

**Customise it:**

```js
var BANNER_CONFIG = {
  message: 'Welcome! Check out our new savings rates.',
  backgroundColor: '#1a73e8',  // change to your brand color
  textColor: '#ffffff',
};
```

---

### `context_aware_welcome_banner.js`

Injects a **personalised "Welcome back" banner** using the logged-in user's name from the OLB session.

- Reads `dbk.sessionInfo().userFullName` — requires the OLB platform context (not available standalone)
- Renders a green banner: *"Welcome back, John Doe!"*
- Executes after DOM is ready; safe to inject at any point in the page lifecycle

> **Note:** This aspect uses `window.dbk`, which is populated by the real OLB shell or the OLB Playground mock. It will not work if you open the file directly in a browser outside OLB.

---

### `contextless_chat_bubble.js`

Injects a **full-featured floating chat bubble** with a chat UI in the bottom-right corner of the OLB page.

- Fixed-position bubble (60×60 px, purple gradient) with open/close animation
- Full chat panel: message history, typing indicator, bot avatar, close button
- **Mock AI responses** — pre-scripted replies to simulate a chatbot. Replace the response logic with a real API call to connect a live AI backend
- Responsive: adapts to mobile viewports
- No external dependencies — fully self-contained
- No OLB session data required

**To connect a real AI backend**, find the `sendMessage` function and replace the `setTimeout` mock with a `fetch` call to your AI service.

---

## Integration

### On the real OLB

Aspects are registered in the **NextGen Admin Portal** by the Candescent platform team. To have an aspect deployed to production:

1. Finalise and test your aspect script (use the Playground first — see below)
2. Provide the script to the **Candescent platform team**
3. The team reviews and registers it in the Admin Portal under `shell.aspects`
4. The aspect executes on every post-login page load for the configured institution

### Testing in the OLB Playground

Test your aspects against the real OLB shell locally before submitting — no platform team involvement needed.

> **Full setup guide:** [playground/web/README.md](../../../playground/web/README.md)

#### Option A — Aspect Manager UI (recommended)

1. Start the playground: `docker compose pull && docker compose up`
2. Open **http://localhost:4200/playground** → click the **+** button in the top-right
3. Paste the script contents into the **"Add New"** tab, give it a name, click **Add & Reload**
4. The OLB page reloads and the aspect executes immediately

Refresh **http://localhost:4200** after injecting — the aspect runs on each page load.

---

## Writing your own aspect

Key constraints:

| Rule | Why |
|------|-----|
| Must be a self-contained IIFE `(function(){ ... })()` | Prevents variable leakage into the global scope |
| Use `var` not `let`/`const` for maximum browser compatibility | Aspects run in the host page's JS context |
| Do not `import` or `require` | No module bundler available — inline everything or load via `<script>` tag |
| Access user data via `window.dbk.sessionInfo()` | This is the platform's API for session context |
| Do not rely on widget internals | Widgets are loaded asynchronously via Module Federation — DOM order is not guaranteed |

**Available platform data (`window.dbk.sessionInfo()`):**

| Field | Example value |
|-------|--------------|
| `userFullName` | `"John Doe"` |
| `diId` | `"00516"` |
| `loginId` | `"customer1"` |
