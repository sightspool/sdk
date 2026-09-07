# Independent review brief — research SDK 0.4.0

Prepared 7 September 2026. This is a brief for a future reviewer, not a completed
review, certification or authorization to send source/customer data to a vendor.

## Review scope

- The public research runtime (src/research.ts, browser.ts, index.ts), npm/IIFE
  builds and React wrapper. Confirm old capture modules are absent from dist.
- Actual request fields, storage, identity handling and referrer/cookie behavior;
  include hostile host configuration and repeated script loads.
- Origin/workspace binding, signed invitation replay/expiry, eligibility, consent,
  admission and tenant separation in the Sightspool app's widget-offer and interview
  routes. Client signed_in configuration is not an authentication boundary.
- Late responses, aborts, pause/logout, hidden pages, remounting, blocked storage,
  timeouts, popup behavior, host-page availability and restrictive CSPs.
- Build/release trust: npm OIDC publisher settings, tag/version checks, source
  snapshots, digest validation, SRI and CORS, dependency/build-chain permissions,
  immutability, release archive availability and rollback.
- Backend data processing: access, recordings/transcripts/derived findings,
  deletion queues, backup and provider-log retention, processing regions, enabled
  subprocessors and AI data-use settings. These cannot be established from SDK
  source alone; review actual hosted configuration with authorized access.

## Required outputs

A dated report tied to source commits and deployment/configuration identifiers,
methods and tests, findings with severity and concrete reproduction, remediation
and retest results, and explicit exclusions. Only publish an audit claim after
reviewer permission and an actual completed report. No compliance certification
or production acceptance is implied by local synthetic tests.
