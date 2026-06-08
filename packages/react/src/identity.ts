// Pure identity helper — kept DOM/React-free so it unit-tests under `node --test`.
// Encapsulates the one rule that's easy to get wrong by hand: don't call identify
// until there's an identifiable user (so you never attach an anonymous/empty user).

import type { Identity } from "@sightspool/sdk";

/**
 * Map a reactive identity to SDK `identify(userId, traits)` args, or `null` when there's
 * no identifiable user yet (logged out / no id) — in which case identify should NOT fire.
 */
export function toIdentifyArgs(
  identity: Identity | null | undefined,
): { userId: string; traits: { account?: string; plan?: string } } | null {
  if (!identity || !identity.userId) return null;
  return {
    userId: identity.userId,
    traits: { account: identity.account, plan: identity.plan },
  };
}
