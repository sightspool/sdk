# @sightspool/sdk

In-product capture for [Sightspool](https://github.com/sightspool). Drop it into your web app and
it captures, **at the moment of friction**, what a user was trying to do (*intent*),
how hard it was (*effort*), and the account behind it — emitting one linked **Signal**
into your Sightspool workspace.

It's the one source of data that exists nowhere else: the *silent failures* (the user
who calmly couldn't do the thing, hit no error, filed no ticket, and left) and the
*unmet demand* (goals your product has no path for, so no funnel or error ever records
them).

> **Status:** v0.1, collect-side. The SDK *senses* — it captures and analyses. It does
> **not** act on your surface (surveys/nudges/experiments are Wave 0005, and every one
> is human-gated). Trigger sensitivity and intent inference calibrate with live traffic.

**Docs:** [full reference + CSP & framework guides](https://sdk.sightspool.com/) ·
[llms.txt](https://sdk.sightspool.com/llms.txt) (the machine-readable install/CSP/config
doc for agents) · [npm](https://www.npmjs.com/package/@sightspool/sdk)

---

## Install — two lines

### npm / bundler

```bash
npm install @sightspool/sdk
```

```js
import Sightspool from '@sightspool/sdk'

Sightspool.init({ key: 'pk_live_…' })

// once you know who the user is:
Sightspool.identify(currentUser.id, { account: 'Vertex Logistics', plan: 'growth' })
```

`init` boots passive capture immediately. `identify` attaches the user to an **account**
and **plan** — the only required wiring, and it's what lets Sightspool rank by customer
(and, with a connected billing source, by MRR). Most apps already make an equivalent
call for their analytics/support tools.

### Script tag (no build step)

```html
<script
  async
  src="https://app.sightspool.com/sdk.global.js"
  data-sightspool-key="pk_live_…"
></script>
```

The tag auto-`init`s from its `data-sightspool-key`. Call `identify` once the user is
known:

```html
<script>
  window.Sightspool && window.Sightspool.identify(userId, { account, plan })
</script>
```

(Loading the script before `Sightspool` is defined? Calls are safe to make against
`window.Sightspool` once the script has loaded; until then, guard with `&&` as above.)

The script tag also reads these optional attributes (the no-build equivalent of the
`init` options — comma-separate selector lists):

```html
<script
  async
  src="https://app.sightspool.com/sdk.global.js"
  data-sightspool-key="pk_live_…"
  data-sightspool-block=".billing-panel, [data-private]"
  data-sightspool-redact=".customer-name"
  data-sightspool-debug
  data-sightspool-capture-localhost
></script>
```

---

## Configuration

`init(config)` — all optional except `key`:

| option | type | default | purpose |
|---|---|---|---|
| `key` | `string` | — | **required.** Your publishable key (`pk_test_…` / `pk_live_…`), from the Connections → In-product SDK card. Publishable — safe to ship in client JS. See [Keys & environments](#keys--environments). |
| `endpoint` | `string` | the bundle's origin (script tag) / `https://app.sightspool.com` (npm) | Ingest base URL. The `<script>` install auto-resolves it to wherever `sdk.global.js` was served from (your app), so the key alone is enough; override for a CDN-hosted bundle or dev. |
| `boundaryAsk` | `boolean` | `true` | Show the one-tap "did you do what you came to do?" ask at session boundaries. |
| `consent` | `boolean` | `true` | Start capturing immediately. Set `false` to stay paused until you call `Sightspool.consent(true)` (or `start()`) after obtaining consent. |
| `redact` | `string[]` | `[]` | CSS selectors whose captured text is **masked** (replaced with `‹redacted›`) before anything leaves the page. The event is still recorded — only its label is masked. |
| `block` | `string[]` | `[]` | CSS selectors whose events are **dropped entirely** (the hard opt-out). Equivalent to putting `data-sightspool-ignore` on the element. |
| `captureOnLocalhost` | `boolean` | `false` | By default the SDK **no-ops on localhost** (`localhost`, `127.0.0.1`, `*.local`, `*.localhost`) so your `npm run dev` traffic never pollutes analytics. Set `true` to capture locally (e.g. to test the install). |
| `debug` | `boolean` | `false` | Log every capture decision to the console (`[sightspool] …`) so you can watch it work. |

Server-side config (allowed CORS origins, additional redaction rules) lives on the
Connections card and is enforced at ingest — the key alone can't post from an
un-allowlisted origin.

### Privacy controls at a glance

| You want to… | Use |
|---|---|
| Never capture a subtree (e.g. a billing panel) | `data-sightspool-ignore` on the element, or a `block` selector |
| Mask a field's text but still log the interaction | a `redact` selector (text → `‹redacted›`) |
| Wait for cookie-banner consent | init `{ consent: false }` then `Sightspool.consent(true)` |
| Keep dev traffic out of analytics | nothing — localhost is suppressed by default |

---

## Keys & environments

Your key is **publishable** — safe to ship in client JS (the Stripe `pk_` model). Two
prefixes, one per environment:

| prefix | use it for |
|---|---|
| `pk_test_…` | development / staging / preview deploys |
| `pk_live_…` | production |

The SDK treats both prefixes **identically** — there's no client-side special-casing; the
prefix tells *Sightspool* (at ingest) which environment a Signal belongs to, so test traffic
never mixes into production analytics. Issue both from **Connections → In-product SDK**.

> The SDK also **no-ops on localhost** by default (see `captureOnLocalhost`), so even a
> `pk_live_` key won't capture from `npm run dev`. Test keys are for *deployed* non-prod
> environments (staging, previews).

Keep the key in an environment variable rather than hardcoding it, and pick test vs live by
environment. The key is exposed to the browser, so use your framework's **client** env-var
prefix (`NEXT_PUBLIC_`, `VITE_`, `PUBLIC_`, …) — it's publishable, so that's expected:

```js
Sightspool.init({ key: process.env.NEXT_PUBLIC_SIGHTSPOOL_KEY })
```

```bash
# .env.development / preview
NEXT_PUBLIC_SIGHTSPOOL_KEY=pk_test_…
# .env.production
NEXT_PUBLIC_SIGHTSPOOL_KEY=pk_live_…
```

---

## Framework integration

### Next.js (App Router) — `next/script`

The idiomatic install is `next/script`, not a raw `<script>`. Add it once in your root
layout — the tag auto-`init`s from `data-sightspool-key`:

```tsx
// app/layout.tsx
import Script from 'next/script'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Script
          src="https://app.sightspool.com/sdk.global.js"
          data-sightspool-key={process.env.NEXT_PUBLIC_SIGHTSPOOL_KEY}
          strategy="afterInteractive"
        />
      </body>
    </html>
  )
}
```

Then `identify` the user once known (e.g. a client component after auth):

```tsx
'use client'
useEffect(() => {
  window.Sightspool?.identify(user.id, { account: user.account, plan: user.plan })
}, [user])
```

> `data-sightspool-key` is inlined at build time, so `NEXT_PUBLIC_SIGHTSPOOL_KEY` must be set
> in the environment Next builds in. `strategy="afterInteractive"` keeps it off the critical
> path.

### React (bundler install)

Install the package and call `init` once at app start (a top-level effect or your entry
module):

```tsx
import { useEffect } from 'react'
import Sightspool from '@sightspool/sdk'

export function SightspoolBoot({ userId, account, plan }) {
  useEffect(() => {
    Sightspool.init({ key: import.meta.env.VITE_SIGHTSPOOL_KEY })
  }, [])
  useEffect(() => {
    if (userId) Sightspool.identify(userId, { account, plan })
  }, [userId, account, plan])
  return null
}
```

> A first-class **`@sightspool/react`** wrapper (a `<SightspoolProvider>` + a `useSightspool`
> hook over `init`/`identify`) is planned —
> [issue #3](https://github.com/sightspool/sdk/issues/3).

---

## Content-Security-Policy

If your app sets a CSP, allow the SDK's two footprints — the **script load** and the
**ingest beacon**. With the standard install they're the *same host* (the bundle is served
from the app it ingests to), so it's one host in two directives:

**Script-tag install**

```
script-src  https://app.sightspool.com;
connect-src https://app.sightspool.com;
```

**npm / bundler install** — the SDK is bundled into your own first-party JS, so no
`script-src` host is needed; only the ingest origin:

```
connect-src https://app.sightspool.com;
```

If you pass a custom `endpoint`, use *that* origin in `connect-src`. The beacon goes via
`navigator.sendBeacon` with a `fetch(keepalive)` fallback — both governed by `connect-src`.

- **`strict-dynamic` / nonce.** Under `script-src 'strict-dynamic'`, host allowlists are
  ignored for scripts — give the `<script>` tag your per-request nonce (`nonce={nonce}` in
  Next) so it's trusted. `connect-src` still needs the ingest host.
- **Prompt styles.** The one-tap prompt renders into a **shadow root** and injects its own
  `<style>`. Under a strict `style-src` without `'unsafe-inline'`, those styles may not apply
  — the prompt stays **fully functional but unstyled** (the SDK never throws into your page).
  Add `'unsafe-inline'` to `style-src` if you want it styled.

---

## What it captures

- **Passively, no wiring** — route/screen sequence, clicks, **dead-clicks** and
  **rage-clicks**, client-side errors and failed requests, and a rolling trail of the
  last meaningful events.
- **Stated intent** — typed queries in search / filter / command-palette / empty-state
  inputs, especially **zero-result** searches (the highest-signal intent, no question).
- **The one-tap ask** (at a session boundary or after detected friction, rate-limited
  and fatigue-aware): *"Were you able to do what you came here to do today?"* → on "Not
  really," a short shortlist of likely goals + an always-present "Something else."

Each capture emits one **Signal** (`intent + path + account + effort`). Intent and
effort are *constructed* server-side with calibrated confidence — the SDK ships the
raw trace and the answer; it never guesses.

---

## Safety & privacy

Privacy-conscious **by default** — these are on without any config:

- **PII is masked before it leaves the page.** Emails and long digit runs (card /
  account-number-ish) in any captured label are replaced with `‹email›` / `‹num›`.
  Password, email, `tel`, and credit-card inputs are dropped entirely — their values
  are **never** captured.
- **No cookies, no `localStorage`, no raw keystrokes.** The SDK reads none of them. It
  captures *debounced* search-input values (stated intent) and interaction events — not
  a keylog.
- **You control the rest.** Drop any subtree with `data-sightspool-ignore` or a `block`
  selector; mask a field's text with a `redact` selector; gate everything behind
  `Sightspool.consent(false)` until your cookie banner says otherwise.
- **Suppressed on localhost** so dev traffic never pollutes analytics (opt back in with
  `captureOnLocalhost`).

And the engineering guarantees:

- **Never throws into your app.** Every path is wrapped; capture degrades silently
  (no Signal is worth a broken host UI).
- **Tiny + non-blocking.** The prompt UI lazy-loads into a shadow root, so it can't be
  styled-broken by your CSS and adds ~nothing to your bundle until it's needed.
- **Processor posture.** Sightspool processes on your behalf; the prompt discloses that
  diagnostic context is attached.

---

## API

```ts
Sightspool.init(config: SightspoolConfig): void
Sightspool.identify(userId: string, traits?: { account?: string; plan?: string }): void
Sightspool.consent(granted: boolean): void  // runtime consent toggle (wire to your cookie banner)
Sightspool.start(): void   // begin capture if init'd with { consent: false } (alias of consent(true))
Sightspool.stop(): void    // pause capture and flush (alias of consent(false))
```

---

## Roadmap (not yet built)

Deliberately deferred from the v1 collect side. Most are **data-gated** — they need real
traffic to calibrate, so they wait for the first production installs.

- **Server-LLM State-B candidates** (`/api/sdk/candidates`). Today the prompt's candidate goals
  are derived **locally** (recent search query + page label) — instant and free, but shallow. A
  server endpoint would generate sharper candidates in the app's own feature vocabulary, at the
  cost of a per-prompt round-trip; it must fall back to the local/generic ask within a tight
  latency budget.
- **Adaptive micro-interview** on high-value / high-MRR friction — a short, session-grounded,
  agent-authored follow-up beyond the one-tap default, under the same fatigue caps.
- **Reliable zero-result detection.** v1 harvests the typed query; flagging it as *zero-result*
  (the highest-signal intent) is best-effort and needs per-app empty-state hints.
- **Server-to-server signed (HMAC) ingest** — for non-browser / backend Signal sources (the
  publishable-key + origin-allowlist posture is browser-only).
- **Mobile / native SDK** — web-first for now.

## Develop

```bash
pnpm install
pnpm build        # tsup → dist/ (ESM + CJS + types + dist/sdk.global.js)
pnpm type-check
pnpm test         # node --test over the pure cores
```
