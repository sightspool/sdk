// Passive context capture (FR-2) — the buffer of route/click/error events the
// rest of the runtime reads. All DOM access is guarded and wrapped: this module
// must never throw into the host app (NFR-3).

import type { TrailEvent, TrailEventType } from "./types";
import { redactText, isIgnoredElement, matchesRedactSelector, REDACTED } from "./privacy";

const TRAIL_MAX = 30;
const DEAD_CLICK_MS = 700; // a click with no DOM/route change after this = dead-click
const RAGE_WINDOW_MS = 1_000;
const RAGE_COUNT = 3;

export type CaptureHandle = {
  start(): void;
  stop(): void;
  trail(): TrailEvent[];
  route(): string;
  label(): string;
  error(): string | undefined;
  /** Subscribe to "a meaningful event happened" (the trigger engine polls off this). */
  onEvent(cb: () => void): void;
  /** Called by harvest.ts when a search/filter query is typed. */
  recordSearch(query: string, zeroResult?: boolean): void;
};

function hasDom(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

export function createCapture(opts: {
  debug: boolean;
  redact?: readonly string[];
  block?: readonly string[];
}): CaptureHandle {
  const redactSelectors = opts.redact ?? [];
  const blockSelectors = opts.block ?? [];
  let buf: TrailEvent[] = [];
  let lastError: string | undefined;
  let started = false;
  const subs: Array<() => void> = [];
  const cleanups: Array<() => void> = [];
  let recentClicks: number[] = []; // timestamps, for rage detection

  function notify() {
    for (const cb of subs) {
      try {
        cb();
      } catch {
        /* a subscriber must never break capture */
      }
    }
  }

  function push(type: TrailEventType, label?: string) {
    try {
      buf.push({ t: Date.now(), type, label: label ? redactText(label) : undefined });
      if (buf.length > TRAIL_MAX) buf = buf.slice(-TRAIL_MAX);
      if (opts.debug) console.debug("[sightspool] event", type, label);
      notify();
    } catch {
      /* swallow */
    }
  }

  function currentRoute(): string {
    try {
      return location.pathname + location.search;
    } catch {
      return "";
    }
  }

  function currentLabel(): string {
    try {
      return document.title || "";
    } catch {
      return "";
    }
  }

  function onClick(ev: MouseEvent) {
    try {
      const target = ev.target as Element | null;
      // Hard opt-out: a click inside [data-sightspool-ignore] or a `block` selector is
      // never recorded — not even as an unlabelled event (GOV-3).
      if (isIgnoredElement(target, blockSelectors)) return;
      const text =
        (target && (target.getAttribute?.("aria-label") || target.textContent)) || "";
      // `redact` selectors mask the label wholesale; emails/digits in any label are
      // also masked by push() → redactText.
      const label = matchesRedactSelector(target, redactSelectors)
        ? REDACTED
        : text.trim().slice(0, 60);
      const t = Date.now();

      recentClicks = recentClicks.filter((ts) => t - ts <= RAGE_WINDOW_MS);
      recentClicks.push(t);
      const isRage = recentClicks.length >= RAGE_COUNT;
      push(isRage ? "rage_click" : "click", label);

      // dead-click: did anything change shortly after? watch for a DOM mutation or
      // a route change; if neither, record a dead_click.
      const routeBefore = currentRoute();
      let mutated = false;
      let observer: MutationObserver | null = null;
      try {
        observer = new MutationObserver(() => {
          mutated = true;
        });
        observer.observe(document.body, { childList: true, subtree: true, attributes: true });
      } catch {
        /* no MutationObserver — skip dead-click detection */
      }
      window.setTimeout(() => {
        try {
          observer?.disconnect();
          if (!mutated && currentRoute() === routeBefore && label) {
            push("dead_click", label);
          }
        } catch {
          /* swallow */
        }
      }, DEAD_CLICK_MS);
    } catch {
      /* swallow */
    }
  }

  function onError(ev: ErrorEvent) {
    try {
      lastError = String(ev.message || "error");
      push("error", lastError);
    } catch {
      /* swallow */
    }
  }

  function onRejection(ev: PromiseRejectionEvent) {
    try {
      const reason = ev.reason;
      lastError = reason instanceof Error ? reason.message : String(reason);
      push("error", lastError);
    } catch {
      /* swallow */
    }
  }

  // Route changes: patch history.pushState/replaceState + listen for popstate.
  function installRouteTracking() {
    try {
      const fire = () => push("route", currentRoute());
      const origPush = history.pushState;
      const origReplace = history.replaceState;
      history.pushState = function (this: History, ...args: Parameters<History["pushState"]>) {
        const r = origPush.apply(this, args);
        fire();
        return r;
      };
      history.replaceState = function (
        this: History,
        ...args: Parameters<History["replaceState"]>
      ) {
        const r = origReplace.apply(this, args);
        fire();
        return r;
      };
      window.addEventListener("popstate", fire);
      cleanups.push(() => {
        history.pushState = origPush;
        history.replaceState = origReplace;
        window.removeEventListener("popstate", fire);
      });
      push("route", currentRoute()); // seed with the entry route
    } catch {
      /* swallow */
    }
  }

  // Light fetch wrapper to catch failed/4xx-5xx requests as request_error events.
  function installFetchTracking() {
    try {
      if (typeof window.fetch !== "function") return;
      const orig = window.fetch.bind(window);
      window.fetch = async (...args: Parameters<typeof fetch>) => {
        try {
          const res = await orig(...args);
          if (!res.ok) push("request_error", `HTTP ${res.status}`);
          return res;
        } catch (err) {
          push("request_error", err instanceof Error ? err.message : "network error");
          throw err;
        }
      };
      cleanups.push(() => {
        window.fetch = orig;
      });
    } catch {
      /* swallow */
    }
  }

  return {
    start() {
      if (started || !hasDom()) return;
      started = true;
      try {
        document.addEventListener("click", onClick, true);
        window.addEventListener("error", onError);
        window.addEventListener("unhandledrejection", onRejection);
        cleanups.push(() => {
          document.removeEventListener("click", onClick, true);
          window.removeEventListener("error", onError);
          window.removeEventListener("unhandledrejection", onRejection);
        });
        installRouteTracking();
        installFetchTracking();
      } catch {
        /* swallow */
      }
    },
    stop() {
      started = false;
      for (const c of cleanups.splice(0)) {
        try {
          c();
        } catch {
          /* swallow */
        }
      }
    },
    trail() {
      return buf.slice();
    },
    route: currentRoute,
    label: currentLabel,
    error() {
      return lastError;
    },
    onEvent(cb) {
      subs.push(cb);
    },
    recordSearch(query, zeroResult) {
      const q = query.trim();
      if (!q) return;
      push(zeroResult ? "zero_result" : "search", q);
    },
  };
}
