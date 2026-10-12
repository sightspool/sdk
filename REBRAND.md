# Justusability SDK release — 13 October 2026

The owner authorized replacing the public SDK and participant identity with
Justusability, without maintaining the former package or browser API.

## Released

- Core: `@justusability/sdk@0.1.0`; browser API `Justusability`; `JustusabilityConfig`.
- React: `@justusability/react@0.1.0`; `JustusabilityProvider`,
  `useJustusability`, `useJustusabilityIdentify`.
- Scripts: `data-justusability-*`, `justusability:ready` and matching iframe messages.
- Service origin: `https://research.justusability.com`, verified live on 13 October.
  Override `endpoint` locally.
- Approved Justusability logos, local Inter/Space Grotesk fonts, green palette,
  rounded controls and reduced-motion behavior. Font licenses are included.
- The package excludes historical `site/releases`; source history and legally
  required original attribution remain. No former global or attribute aliases ship.

The paired app implementation is in `/Users/ak/workspace/sightspool` and documented
in `docs/justusability-sdk-rebrand-2026-10-13.md`. The iframe protocol must be released
with this SDK. The backend's token/consent formats and database schema are retained.

## Verified locally

Core 53 tests/typecheck, React 2 tests/typecheck, workspace build, release integrity
verification and 4 tamper/version tests pass. The real packaged SDK and app also
pass synthetic consent-to-completion in Chromium and WebKit at 1440, 390 and 320px.
No real participant or microphone was used. See the paired app receipt for commands.

## Publication and deployment

Both packages 0.1.0 were published from clean SDK commit `ca2cf27` through the
existing maintainer account after browser security-key authentication. The free
`justusability` organization owns the scope. Downloaded registry tarballs match
the uploaded artifacts byte for byte. The initial release does not claim npm
provenance; configure trusted publishing before future automated npm releases.

Tags `justusability-v0.1.0` and `justusability-react-v0.1.0` point to that source
commit and are pushed. The two publish workflows were temporarily disabled while
pushing these already-published initial tags, then both were re-enabled. Historical
`v0.1.0` and `react-v0.1.0` tags were preserved. SDK CI passed on the published source.

The app pins the exact registry package. Scoped app `a1674b9` is deployed from
production `f9abed7`, excluding local prototypes and migrations 0166/0167. The
new domain serves the matching immutable artifact, source snapshot, docs and
branded participant screens. Public Sightspool marketing redirects to Justusability.
Existing operator authentication and signed provider callbacks retain their host.

Verification and retirement receipts are maintained in the paired app's
`docs/justusability-release-2026-10-13.md`. Optional invitation analytics remains
inactive on this production server. No research data or schema was migrated,
no study was enabled, and no real participant audio was recorded for this release.

Both former packages were unpublished on 13 October 2026 after separate maintainer
security-key checks: `@sightspool/react` 0.1.0 and all eight `@sightspool/sdk`
versions through 0.5.0. The registry has no available former versions and both
`/latest` endpoints return 404; the new Justusability packages still resolve to
0.1.0. The paired app's `npm-retirement.json` records the read-back evidence.
Old GitHub Pages hosting is removed, and `sdk.sightspool.com` redirects through
Vercel to the research host. Registry removal cannot recall copies already
downloaded or hosted elsewhere.
