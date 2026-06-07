// Egress — batch captured Signals and ship them to /api/sdk/ingest, preferring
// navigator.sendBeacon (survives page unload) with a fetch+keepalive fallback.
// Every path is wrapped: a failed send must never surface in the host app (NFR-3),
// and a Signal already records its why/cost passively, so a dropped beacon just
// loses enrichment, not the capture's value (FR-7).

import type { CapturedSignal, Identity, IngestBody } from "./types";

const FLUSH_BATCH = 10; // flush when this many Signals are queued
const FLUSH_INTERVAL_MS = 15_000;

export type EgressHandle = {
  start(): void;
  stop(): void;
  enqueue(signal: CapturedSignal): void;
  flush(): void;
  setIdentity(identity: Identity): void;
};

export function createEgress(opts: {
  key: string;
  endpoint: string;
  debug: boolean;
}): EgressHandle {
  let queue: CapturedSignal[] = [];
  let identity: Identity | undefined;
  let interval: number | null = null;
  let started = false;

  const url = `${opts.endpoint.replace(/\/+$/, "")}/api/sdk/ingest`;

  function send(signals: CapturedSignal[]) {
    if (signals.length === 0) return;
    const body: IngestBody = { key: opts.key, identity, signals };
    const json = JSON.stringify(body);
    try {
      // text/plain is a CORS-safelisted content type, so a cross-origin beacon
      // skips the preflight entirely (the host app's domain ≠ ours). The server
      // parses the text as JSON regardless.
      if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
        const blob = new Blob([json], { type: "text/plain" });
        const ok = navigator.sendBeacon(url, blob);
        if (ok) {
          if (opts.debug) console.debug("[sightspool] beacon", signals.length);
          return;
        }
      }
      // Fallback: fetch with keepalive so it can outlive the page.
      void fetch(url, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: json,
        keepalive: true,
        mode: "cors",
        credentials: "omit",
      }).catch(() => {
        /* swallow — drop on failure */
      });
    } catch {
      /* swallow */
    }
  }

  function onVisibility() {
    try {
      if (document.visibilityState === "hidden") flush();
    } catch {
      /* swallow */
    }
  }

  function flush() {
    if (queue.length === 0) return;
    const batch = queue;
    queue = [];
    send(batch);
  }

  return {
    start() {
      if (started || typeof window === "undefined") return;
      started = true;
      try {
        document.addEventListener("visibilitychange", onVisibility);
        window.addEventListener("pagehide", flush);
        interval = window.setInterval(flush, FLUSH_INTERVAL_MS);
      } catch {
        /* swallow */
      }
    },
    stop() {
      started = false;
      try {
        document.removeEventListener("visibilitychange", onVisibility);
        window.removeEventListener("pagehide", flush);
        if (interval !== null) window.clearInterval(interval);
      } catch {
        /* swallow */
      }
      flush();
    },
    enqueue(signal) {
      queue.push(signal);
      if (queue.length >= FLUSH_BATCH) flush();
    },
    flush,
    setIdentity(next) {
      identity = next;
    },
  };
}
