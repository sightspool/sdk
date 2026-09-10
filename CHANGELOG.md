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
