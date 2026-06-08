# @sightspool/react

React bindings for the [Sightspool](https://github.com/sightspool/sdk) in-product capture
SDK — a declarative `<SightspoolProvider>` plus hooks over the core
[`@sightspool/sdk`](https://www.npmjs.com/package/@sightspool/sdk) `init` / `identify` /
`consent`.

It adds **no new capture capability** — it's the idiomatic React install: init runs in an
effect (never on the server), `identify` tracks your auth state, consent wires to React
state, and it's StrictMode-safe.

> **Docs:** [sdk.sightspool.com](https://sdk.sightspool.com/) · [core SDK](https://www.npmjs.com/package/@sightspool/sdk)

---

## Install

```bash
npm install @sightspool/react @sightspool/sdk react
```

`@sightspool/sdk` and `react` are **peer dependencies** (so there's exactly one SDK
instance and your app's React is used).

## Quick start

Wrap your app once, near the root:

```tsx
import { SightspoolProvider } from '@sightspool/react'

export default function App({ user, children }) {
  return (
    <SightspoolProvider
      apiKey={process.env.NEXT_PUBLIC_SIGHTSPOOL_KEY!}
      identity={user && { userId: user.id, account: user.account, plan: user.plan }}
    >
      {children}
    </SightspoolProvider>
  )
}
```

That's it — capture boots on mount, and `identify` (re)fires whenever `identity` changes
(it stays quiet while `identity` is `null`/has no `userId`, so you never attach an
anonymous user).

### Next.js (App Router)

The provider is a client module (it ships a `"use client"` banner), so you can drop it
straight into your **server** root layout:

```tsx
// app/layout.tsx
import { SightspoolProvider } from '@sightspool/react'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SightspoolProvider apiKey={process.env.NEXT_PUBLIC_SIGHTSPOOL_KEY!}>
          {children}
        </SightspoolProvider>
      </body>
    </html>
  )
}
```

Resolve `identity` in a client component (e.g. after auth) and pass it down, or use the
`useSightspoolIdentify` hook there.

## Consent (cookie banners)

Pass a reactive `consent` boolean. When you do, capture starts **paused** and follows the
value — flip it from your banner:

```tsx
const [consent, setConsent] = useState(false)

<SightspoolProvider apiKey={KEY} consent={consent}>
  <App />
</SightspoolProvider>
// in your banner: onAccept={() => setConsent(true)}
```

## API

### `<SightspoolProvider>`

| prop | type | purpose |
|---|---|---|
| `apiKey` | `string` | **required.** Publishable key (`pk_test_…` / `pk_live_…`). |
| `identity` | `Identity \| null` | Reactive identity — `identify` fires on change; skipped while logged out. |
| `consent` | `boolean` | Reactive consent gate. When set, capture starts paused and follows it. |
| `options` | `Omit<SightspoolConfig, 'key' \| 'consent'>` | The rest of the SDK init options (`endpoint`, `boundaryAsk`, `redact`, `block`, `captureOnLocalhost`, `debug`). |

### Hooks

```ts
// Actions (identify / consent / start / stop) from any component under the provider:
const { identify, consent, start, stop } = useSightspool()

// Keep identity in sync without the provider prop (re-identifies on change):
useSightspoolIdentify(user && { userId: user.id, account: user.account, plan: user.plan })
```

## Notes

- **SSR-safe**: init runs in an effect, never on the server.
- **StrictMode-safe**: init runs once.
- The provider does **not** stop capture on unmount — the SDK is a page-lifetime
  singleton, so a root-provider unmount shouldn't tear it down.

For the full config / attribute reference, CSP directives, keys, and privacy posture, see
the core SDK docs at [sdk.sightspool.com](https://sdk.sightspool.com/).

## License

Apache-2.0
