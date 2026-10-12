# @justusability/react

React bindings for `@justusability/sdk@0.1.0`. Use the matching 0.1.x core SDK.

```tsx
import { JustusabilityProvider } from '@justusability/react'

<JustusabilityProvider apiKey="YOUR_WORKSPACE_WIDGET_UUID" audience="automatic"
  identity={loading ? undefined : user ? { userId: user.id } : null}>
  {children}
</JustusabilityProvider>
```

Mount once per document. `undefined` means authentication is loading; `null` means signed out. Keep identity in sync with account changes and logout. Set `endpoint` for a local or self-hosted research service. `enabled` controls recruitment, not recording consent.

Exports: `JustusabilityProvider`, `useJustusability`, `useJustusabilityIdentify`, `JustusabilityConfig`, and `Identity`. No former-brand aliases are provided. The underlying SDK preserves an already accepted conversation when recruitment stops.

Read the SDK README and participant privacy notice before installation.
