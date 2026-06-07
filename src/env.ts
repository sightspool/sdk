// Environment guards. Kept pure (a hostname string in, a boolean out) so the
// no-op-on-localhost decision is unit-testable without a DOM.

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", ""]);

/**
 * Is this a local-development hostname? Capture is suppressed on these by default so
 * a client's `npm run dev` traffic never pollutes their Sightspool workspace (override
 * with `captureOnLocalhost: true`). Covers the common dev hosts + the `.local` /
 * `.localhost` TLDs (e.g. `myapp.local`, `app.localhost`).
 */
export function isLocalhost(hostname: string | null | undefined): boolean {
  const h = (hostname ?? "").trim().toLowerCase();
  if (LOCAL_HOSTS.has(h)) return true;
  return h.endsWith(".local") || h.endsWith(".localhost");
}
