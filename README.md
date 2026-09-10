# @sightspool/sdk

Embed Sightspool research in your product. The SDK invites website visitors and signed-in users into
owner-approved research during User Hours, then opens Sightspool for consent and
the interview. It does not capture page content, behavior, form values or analytics.

This is the **0.4.0 research API**, a deliberate change from the old capture SDK.
Install the exact version below and review upgrades before deploying them.
Old capture code and documentation are archived in `docs/legacy`.

Read the [data and security guide](https://www.sightspool.com/sdk/data-security),
inspect the [public source](https://github.com/sightspool/sdk), or try the
[isolated SDK demo](https://www.sightspool.com/sdk/demo).

## npm

```sh
npm install --save-exact @sightspool/sdk@0.4.1
```

```ts
import Sightspool from '@sightspool/sdk'

Sightspool.init({ key: 'YOUR_GO_LIVE_WIDGET_UUID', audience: 'all_visitors' })
// Optional when a visitor signs in:
Sightspool.identify(currentUser.id)

// On logout (anonymous visitors remain eligible in all_visitors mode):
Sightspool.identify(null)

// When leaving the pages included in your research:
Sightspool.destroy()
```

Choose an explicit `audience` matching the approved interview plan:

- `all_visitors`: anonymous website visitors and signed-in users. Initialize once on the relevant website pages. No identity or login is required; logout continues recruitment as a visitor.
- `signed_in`: only users with a real signed-in session. Initialize in your authenticated app shell and call `identify(actualUserId)` after authentication resolves. Until then, no request or invitation is made. `identify(null)` immediately removes invitations on logout.

There is no default audience. Missing or invalid audience configuration stays idle.
`identify` retains only whether an ID is present; the ID itself is not stored or
transmitted. Do not invent IDs for visitors. This client setting controls display;
it does not authenticate a participant or change the server-approved research cohort.

## Script tag

For visitors, no authentication integration is needed:

```html
<script async src="https://www.sightspool.com/sdk.global.js"
  data-sightspool-key="YOUR_GO_LIVE_WIDGET_UUID"
  data-sightspool-audience="all_visitors"></script>
```

For signed-in-only research, listen for readiness before loading the SDK, then
synchronize your actual session:

```html
<script>
  let sightspoolUserId = null;
  function syncSightspoolUser(userId) {
    sightspoolUserId = userId;
    window.Sightspool?.identify(userId);
  }
  window.addEventListener('sightspool:ready', () => {
    window.Sightspool.identify(sightspoolUserId);
  });
  // Call syncSightspoolUser(actualUser.id) when authentication resolves.
  // Call syncSightspoolUser(null) on logout.
</script>
<script async src="https://www.sightspool.com/sdk.global.js"
  data-sightspool-key="YOUR_GO_LIVE_WIDGET_UUID"
  data-sightspool-audience="signed_in"></script>
```

Go live supplies the correct key and endpoint. Local keys belong to the local
Sightspool database and cannot be paired with production. Script installs default
to the origin serving the bundle; `data-sightspool-endpoint` overrides that for a
CDN or self-hosted install. npm defaults to `https://www.sightspool.com`.

## API

| Method | Behavior |
| --- | --- |
| `init({ key, audience, endpoint? })` | Start research for the explicit audience; UUID key required. Repeating the same configuration is idempotent. Changing it tears down the previous runtime. |
| `identify(userId)` | Enable signed-in eligibility; only its boolean presence stays locally. `null` clears it; signed-in-only invitations disappear, all-visitors recruitment continues. |
| `pause()` | Pause recruitment, abort the current request and remove the launcher. |
| `resume()` | Resume recruitment for the configured audience. Does not bypass approval or hours. |
| `destroy()` | Remove the launcher, listeners and polling. An already opened interview is not silently ended. |
| `getStatus()` | `not_initialized`, `signed_out`, `paused`, `checking`, `unavailable`, `available` or `error`. |

`pause` and `resume` are recruitment controls, not consent to record. Participants
still review the offer, eligibility and recording consent in Sightspool. Owners
approve the research setup separately. The backend remains authoritative for
availability, capacity, signed offers and interview admission.

## React / Next.js

Use a client component on the pages included in your research. Identity is optional for all visitors:

```tsx
'use client'
import { useEffect } from 'react'
import Sightspool from '@sightspool/sdk'

export function Research({ userId = null }: { userId?: string | null }) {
  useEffect(() => {
    Sightspool.init({ key: 'YOUR_GO_LIVE_WIDGET_UUID', audience: 'all_visitors' })
    Sightspool.identify(userId)
    return () => Sightspool.destroy()
  }, [userId])
  return null
}
```

Optional `@sightspool/react` 0.2.0 provides `SightspoolProvider` and research hooks.
It requires SDK 0.4.x; see `packages/react/README.md`. Use one instance per document.

## Privacy and verification

The offer request contains only the public workspace key, a random per-workspace
browser-session device token, and the operation name. No user ID, traits, auth
secrets, DOM text or page URL is included. Requests use `credentials: 'omit'`.
Offer requests explicitly suppress the Referer header; Origin and ordinary network metadata still reach the service.
No microphone or recording starts on initialization or launcher display.

Polling occurs at most once per 15-second interval while visible and eligible for the configured audience,
plus explicit identity/resume/visibility changes. Only one request is in flight;
requests time out after 10 seconds. Identity changes, pause, hidden tabs and destruction invalidate stale responses.
Logout removes signed-in-only invitations; all-visitors mode refreshes as a visitor.

A connection receipt proves that the SDK contacted the configured server. It does
not certify your app's complete login/logout flow or a successful interview. Test
anonymous visits, login, navigation, logout, slow loading and unmounting in both modes. Use Go live
for server connection checks. A closed User Hours window can connect without an
invitation. Do not fabricate approval or weaken an origin/CSP policy to make it show.

## Verified script releases

Go live generates a versioned, content-addressed script URL with SHA-384 integrity,
`crossorigin="anonymous"` and `referrerpolicy="no-referrer"`. Use those values together.
The unversioned script examples above are a convenience URL whose contents can change.
To pin a reviewed release, use Go live or the manifest linked from the data and security guide.

For self-hosting, copy the reviewed bundle and preserve its integrity value. Set
`data-sightspool-endpoint` to the workspace Sightspool origin explicitly, because
script auto-init otherwise defaults to the bundle host. Keep your own CSP and nonce
requirements; allow only the required script host and Sightspool connection origin.

## Maintainers

```sh
pnpm install --frozen-lockfile
pnpm -r --include-workspace-root build
pnpm -r --include-workspace-root test
npm publish --dry-run
```

The npm and browser builds share `src/research.ts`. The Sightspool app copies
`sdk.global.js` from this package and serves `research-widget.js` as a byte-identical
alias for recent internal snippets. Neither build imports the former capture engine.
See `docs/research-sdk-transition.md` for release sequencing. Apache-2.0.

## Embedded interview panel (0.4.1, local candidate)

An available invitation opens one bottom-right panel on the product page. Consent,
waiting, supported founder audio or Sightspool text conversation, and completion
remain inside its isolated Sightspool iframe. Minimize or Escape hides the panel;
Return to interview reopens the same session. Minimize does not mute, end or withdraw.
Use the explicit in-panel controls to stop audio or delete interview evidence.

Allow the configured Sightspool origin in your site's `frame-src` policy and
permit microphone delegation to that origin if founder audio is used. Preserve
other CSP and Permissions Policy restrictions; a host policy may intentionally
block audio. The iframe requests a microphone only after explicit participant action.
The frame is restricted to the workspace's saved product origin and exchanges only
a minimize message with its parent, never interview text or audio. There is no popup.

Once opened, the panel stays mounted across visibility changes, pause, identity
changes and SDK destroy/remount, so recruitment cleanup cannot silently end a call.
Destroy stops further recruitment. The active panel remains reachable until the
page is left; a full page navigation may interrupt audio. Minimize preserves the
session only within the current document.
