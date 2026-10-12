# Justusability research SDK

Invite website visitors and signed-in users into approved research with Justusability. The widget opens a consented conversation, a voice-note option or a booking link, according to the research team's approved plan. Participants do not need an account.

Version **0.1.0** uses `https://research.justusability.com` as its research service. Use an explicit local endpoint for development. This release does not provide the former brand's package, browser globals or installation attributes.

## npm

Install the exact reviewed release:

```sh
npm install --save-exact @justusability/sdk@0.1.0
```

```ts
import Justusability from '@justusability/sdk'

Justusability.init({ key: 'YOUR_WORKSPACE_WIDGET_UUID', audience: 'automatic' })
Justusability.identify(undefined) // Authentication is loading.
Justusability.identify(currentUser?.id ?? null) // After authentication resolves.
// Keep this in sync on login, account changes and logout.
// Websites without accounts can call identify(null) immediately.
```

## Script tag

Use the exact versioned URL and matching integrity hash supplied by your research setup. This unversioned example shows the attribute names:

```html
<script async src="https://research.justusability.com/sdk.global.js"
  data-justusability-key="YOUR_WORKSPACE_WIDGET_UUID"
  data-justusability-audience="all_visitors"
  data-justusability-theme="light"
  crossorigin="anonymous" referrerpolicy="no-referrer"></script>
```

`window.Justusability` is the browser API. Listen for `justusability:ready` before calling it from a script integration. Use `data-justusability-endpoint` when the bundle is served from a CDN or a different origin. Script installs otherwise use the bundle's origin; npm defaults to `https://research.justusability.com`.

## Audience and identity

- `automatic` follows the approved research question. Call `identify(undefined)` while authentication is loading, `identify(actualUserId)` after sign-in, and `identify(null)` for a confirmed signed-out visitor.
- `all_visitors` supports visitors without authentication integration.
- `signed_in` waits for a valid signed-in user ID. Invitations disappear on logout.

There is no default audience. Missing or invalid configuration stays idle. Identity controls eligibility, not participant authentication or recording consent. When cohort matching uses PostHog, supply the same opaque user ID used in that product's PostHog integration. Do not invent visitor IDs or send email addresses unnecessarily.

## API

| Method | Behaviour |
| --- | --- |
| `init({ key, audience, endpoint?, theme? })` | Initialise one runtime. The key is a workspace UUID. Theme is `light`, `dark` or `auto`. |
| `identify(userId)` | Synchronise eligibility. A non-empty ID up to 200 characters is sent only on the offer request, held in memory and hashed per workspace by the service. `null` means signed out; `undefined` means loading in automatic mode. |
| `pause()` / `resume()` | Control recruitment. They do not bypass approved availability, capacity or consent. |
| `destroy()` | Remove recruitment and listeners. An already opened conversation is not silently ended. |
| `getStatus()` | Read `not_initialized`, `signed_out`, `paused`, `checking`, `unavailable`, `available` or `error`. |

## React

Use the optional `@justusability/react@0.1.0` companion:

```tsx
import { JustusabilityProvider } from '@justusability/react'

<JustusabilityProvider apiKey="YOUR_WORKSPACE_WIDGET_UUID"
  audience="automatic" identity={user ? { userId: user.id } : null}>
  {children}
</JustusabilityProvider>
```

Pass `undefined` while authentication is loading. Mount one provider per document on the pages included in the research. The companion exports `useJustusability` and `useJustusabilityIdentify`.

## Data and controls

The SDK does not capture host-page content, form values, keystrokes or browsing history. It sends a public workspace key, a random browser-session device token and, when supplied, an ID for cohort eligibility. Device and restoration markers use session storage; identity stays in memory. Requests omit cookies and referrers. Hosting infrastructure still receives ordinary network metadata.

Where supported by the service, bounded invitation events record visibility, first interaction, panel opening, dismissal, minimisation and participation controls. DNT/GPC disables optional reports without preventing participation. Polling is not an impression, invitation counts are not unique people, and booking clicks are not confirmed bookings. The service links outcomes using random invitation IDs without participant profiles or raw capability/device tokens in analytics.

The participant separately agrees to research and recording. New interviews are human-led; AI interviewing remains disabled. Minimise keeps an accepted conversation running. Stop and withdrawal controls belong to the conversation, not the recruitment API.

Read the [data guide](https://research.justusability.com/sdk/data-security) and [participant privacy notice](https://research.justusability.com/i/privacy).

## Verification and self-hosting

Inspect `dist/release.json` for the source commit, SHA-256, SHA-384 integrity and matching source snapshot. `dist/sdk.global.js` is the browser bundle. Serve the packaged `site/brand/` files at `/brand/` on the selected endpoint alongside the participant service. The service must implement the research protocol; serving the JavaScript alone is insufficient.

Test consent, origin restrictions, login/logout, keyboard controls, mobile layouts, recording recovery and DNT/GPC before enabling a study. No independent security audit is claimed. License and historical attribution notices remain in the package.

## Maintainers

Run `pnpm install --frozen-lockfile`, `pnpm test`, `pnpm build`, `pnpm test:release`, and the companion package checks. Build a clean committed source before producing the final release archive. Release tags are `justusability-v0.1.0` and `justusability-react-v0.1.0`; historical unprefixed tags are not reused. Only the current Justusability artifacts are distributed; historical releases remain in source history for provenance.
