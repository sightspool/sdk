# Justusability SDK release candidate — 13 October 2026

The owner authorized replacing the public SDK and participant identity with
Justusability, without maintaining the former package or browser API.

## Candidate

- Core: `@justusability/sdk@0.1.0`; browser API `Justusability`; `JustusabilityConfig`.
- React: `@justusability/react@0.1.0`; `JustusabilityProvider`,
  `useJustusability`, `useJustusabilityIdentify`.
- Scripts: `data-justusability-*`, `justusability:ready` and matching iframe messages.
- Intended service origin: `https://research.justusability.com`. This is a proposed
  release destination, not a verified live deployment. Override `endpoint` locally.
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

## Release still required

The npm session returned E401 on 13 October. Neither new package is published and
neither former package has been removed. Confirm ownership of the new scope after
login; publish the new core before the React companion. Set up trusted publishing
for the new package names before relying on OIDC/provenance. The existing repository
identifier in workflow configuration is the real source repository, not a new brand
repository claim.

New tags are `justusability-v0.1.0` and `justusability-react-v0.1.0`; historical
`v0.1.0` and `react-v0.1.0` already exist and must not be overwritten. Tags are not
created by this local implementation. GitHub Pages auto-deployment is disabled;
the participant app will serve the SDK docs. Retire old Pages/domain hosting during
the approved domain cutover.

Build from clean committed source, verify the matching branded tag, then pack.
The app pins that exact archive and its immutable URL/SRI. Publication does not
configure the research origin, apply app migrations or move research data.

After the new service and registry packages are verified, remove `@sightspool/react`
then `@sightspool/sdk` using authenticated npm owner operations. Recheck npm's live
unpublish eligibility and dependent packages first. If npm refuses removal, report
that restriction; do not claim deletion or silently substitute a retained package.
The owner does not require backward compatibility. Registry removal cannot recall
copies already downloaded or hosted elsewhere.
