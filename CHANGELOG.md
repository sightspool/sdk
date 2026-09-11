## 0.5.0 — prepared, unpublished

- **The privacy promise is narrowed, deliberately.** Through 0.4.2 `identify(userId)`
  retained only the presence of an ID and never transmitted it. **From 0.5.0 the id is
  sent**, over TLS, to your own workspace's Sightspool endpoint and only on the
  `operation: "offer"` request, so a journey-linked research card can tell whether a
  visitor is in the cohort its question is about (SIG-122). Sightspool hashes it
  workspace-scoped on arrival and never stores it raw in any table, log or payload.
- The SDK holds the id in memory for the page's lifetime only — never sessionStorage,
  localStorage, a cookie, a URL, a fragment or a log. The interview page is handed
  nothing but the offer and device, as before.
- `identify()` treats any value that is not a non-empty string of at most 200
  characters after trimming as unidentified, exactly like `identify(null)`. Over-length
  ids are never truncated: a truncated id is a different person, and on a gated card
  that invites the wrong one.
- A changed id invalidates any pending check and any minted offer, so switching
  accounts never inherits the previous person's invitation. Re-stating the same id
  leaves a live invitation alone.
- `all_visitors` with no `identify()` call sends exactly the payload it sent before.
- **Integration requirement.** Your product must call `posthog.identify()` with the
  same id it passes Sightspool. An email on one side and an internal UUID on the other
  never meet, and the result is a flat zero match rate that reads as an empty cohort.
- API contract change, so this is a minor bump. `@sightspool/react` peers widened to
  `>=0.4.0 <0.6.0`.

## 0.4.1 — unpublished local candidate

- Replace popup interview delivery with one persistent corner panel.
- Keep open sessions mounted across minimize and recruitment cleanup.
- Restrict iframe permissions and validate parent message origin/source.

# Changelog

## 0.4.0 — prepared, unpublished

- Replace the public capture entry with research invitation delivery.
- Require an explicit all_visitors or signed_in audience; no fabricated visitor identity.
- Retain only local presence of identity, with no user IDs in offer payloads.
- Omit cookies and Referer from offer requests; pause, logout and cleanup reject late responses.
- Add versioned content-addressed browser files, SHA-384 integrity, source snapshots,
  measured bundle sizes and manifest checks before publication.
- Add data/security documentation and an actual-SDK demo with simulated transport.

The app/backend handles participant consent, recording, transcription and analysis
separately. No independent security audit or new hosted acceptance is claimed.
Earlier capture API documentation is archived in docs/legacy.
