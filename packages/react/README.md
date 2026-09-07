# @sightspool/react

React bindings for the Sightspool research SDK. Version 0.2.0 requires
`@sightspool/sdk` 0.4.x; these changes are prepared locally and not yet published.

```tsx
'use client'
import { SightspoolProvider } from '@sightspool/react'

// On the pages included in your research:
<SightspoolProvider
  apiKey="YOUR_GO_LIVE_WIDGET_UUID"
  audience="all_visitors"
  identity={user ? { userId: user.id } : null}
>
  {children}
</SightspoolProvider>
```

Use one provider per document. Its `endpoint` prop can target your matching local
or self-hosted Sightspool workspace. `enabled={false}` pauses recruitment; it does
not grant or revoke recording consent. Identity changes clear stale eligibility,
logout hides signed-in-only invitations; all-visitors recruitment continues, and unmount removes listeners, polling and the launcher.
Effects support SSR and React Strict Mode.

`useSightspool()` exposes init, identify, pause, resume, destroy and getStatus.
`useSightspoolIdentify(identity)` synchronizes an identity held deeper in the tree;
use one authoritative identity source to avoid competing updates.

Old capture traits and the cookie-consent API are no longer part of this package.
The browser retains only whether a user ID is present; the user ID is not sent.
Consent and interviews remain in Sightspool's approved research flow.

`audience` is required: `all_visitors` includes anonymous visitors without an identity;
`signed_in` waits for a real session. This display setting must match the approved
research plan and does not itself verify participant eligibility.
