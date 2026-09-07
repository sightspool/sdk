# Research SDK transition — 7 September 2026

The owner confirmed the previous SDK installs were internal tests and asked to
make research the SDK's purpose. Version 0.4.0 intentionally replaces the default
capture API. Its browser and npm exports use the same research runtime; they do
not import the former capture, harvesting, egress, surveys or intervention engine.
Historical modules and tests remain in source. The old entry and documentation
are archived under docs/legacy and are not shipped in dist.

The research SDK supports anonymous visitors and signed-in users with explicit audience selection, approved-offer polling and the
launcher. Consent, recording, interviews, analysis and owner approval remain in
the existing Sightspool application. identify retains only a boolean; identifiers,
traits, DOM content, URLs and auth tokens are not sent. Polling is single-flight,
requests abort on identity changes/pause/destroy, and stale responses cannot restore UI.
Destroying the SDK stops recruitment but does not silently end an interview the
participant has already opened.

init accepts the Go live UUID widget key and requires audience all_visitors or signed_in.
Anonymous visitors need no identify call. Logout only disables signed-in-only
recruitment; all_visitors refreshes as a guest. This does not change the approved
cohort or prove participant eligibility. Old pk_live keys are rejected. The
separate capture-localhost, telemetry traits and cookie-consent controls are not
part of the new API. pause/resume control recruitment, never recording consent.
React 0.2.0 peers with SDK >=0.4.0 <0.5.0 and follows the same audience semantics, with
effect cleanup for unmount and Strict Mode. Use one provider per document.

The application serves sdk.global.js from this package. research-widget.js is
retained only as a byte-identical URL alias to the SDK bundle, with the small
SightspoolResearch API alias. Updated snippets must include the required audience attribute. This does not preserve
the old capture behavior or revive retired /api/sdk endpoints.

Release boundary: these version bumps are local until published. The application
may pin a locally packed tarball for reproducible pre-release verification. Publish
the SDK and React packages only after their independent release gates, then move
the app from the tarball to the published version before the hosted release.
No package publication or deployment is authorized by this implementation.

## Trust and release verification

The existing documentation domain is sdk.sightspool.com (site/CNAME, GitHub Pages).
Its published capture-era guide must be replaced as part of the authorized research
release. Keep the new guide, trust.html and demo.html together; do not present an
unpublished research build as an independently audited release.

Build generates dist/release.json, source.json, bundle digests and measured sizes.
The release artifact ID binds package version, bundle hash, source snapshot hash,
source commit and dirty state. Script paths use releases/VERSION/ARTIFACT_ID so a
source or metadata change cannot silently replace a reviewed artifact. Verify with
pnpm test:release; a tag release additionally rejects dirty source or mismatched tags.
The npm publish step uses the already verified build (--ignore-scripts) with OIDC
provenance. The existing npm trusted publisher configuration must be checked at
release time; local checks do not prove that service-side configuration.

pnpm build:site stages .site-build for local review and GitHub Pages. The app mirrors
the same packaged site and release files under /sdk for local review; the canonical
public documentation remains sdk.sightspool.com. Before subsequent public releases,
retain previous published release directories in site/releases (or an immutable
artifact store), verify those URLs still resolve, and keep old app-hosted artifacts
available too. Current staging contains the new unpublished release only; it does
not establish a historical CDN retention guarantee.

An independent review brief is in docs/security-review-brief.md. Regions, provider
logs/backups and full backend data handling need deployment-specific verification;
they are visibly separated from source-proven SDK behavior in the public guide.
