// Intent harvest (FR-3) — treat typed queries in search / filter / command-palette
// / empty-state inputs as STATED intent (the highest-signal intent, no question
// needed). Harvesting precedes any inference. Defensive throughout (NFR-3).
//
// Zero-result detection is genuinely cross-app-specific and best-effort in v1: we
// capture the query as a search event; flagging it as zero-result reliably is a
// follow-up (it needs per-app empty-state hints). The query itself is the value.

import type { CaptureHandle } from "./capture";
import { isIgnoredElement, matchesRedactSelector } from "./privacy";

const SEARCH_HINT_RE = /search|filter|find|query|command|lookup/i;
const DEBOUNCE_MS = 800;

export type HarvestHandle = {
  start(): void;
  stop(): void;
  /** The most recent stated intent (last search/filter query), for State-B candidates. */
  lastIntentHint(): string | undefined;
};

function looksLikeSearch(el: Element): boolean {
  try {
    const input = el as HTMLInputElement;
    if (input.type === "search") return true;
    const role = el.getAttribute("role") || "";
    if (role === "searchbox" || role === "combobox") return true;
    const hay = [
      input.name,
      input.placeholder,
      el.getAttribute("aria-label"),
      el.id,
      el.className,
    ]
      .filter(Boolean)
      .join(" ");
    return SEARCH_HINT_RE.test(hay);
  } catch {
    return false;
  }
}

export function createHarvest(
  capture: CaptureHandle,
  opts: { debug: boolean; redact?: readonly string[]; block?: readonly string[] },
): HarvestHandle {
  let hint: string | undefined;
  let timer: number | null = null;
  let started = false;
  const redactSelectors = opts.redact ?? [];
  const blockSelectors = opts.block ?? [];

  function onInput(ev: Event) {
    try {
      const target = ev.target as HTMLInputElement | null;
      if (!target || (target.tagName !== "INPUT" && target.tagName !== "TEXTAREA")) return;
      if (!looksLikeSearch(target)) return;
      // A masked query is useless intent, so a `redact`-matched search box is treated
      // as a hard opt-out here (same as `block`/ignore): don't harvest the value at all.
      if (isIgnoredElement(target, blockSelectors) || matchesRedactSelector(target, redactSelectors))
        return;
      const value = (target.value || "").trim();
      if (value.length < 2) return;

      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        hint = value;
        capture.recordSearch(value);
        if (opts.debug) console.debug("[sightspool] harvested intent", value);
      }, DEBOUNCE_MS);
    } catch {
      /* swallow */
    }
  }

  return {
    start() {
      if (started || typeof document === "undefined") return;
      started = true;
      try {
        document.addEventListener("input", onInput, true);
      } catch {
        /* swallow */
      }
    },
    stop() {
      started = false;
      try {
        document.removeEventListener("input", onInput, true);
        if (timer !== null) window.clearTimeout(timer);
      } catch {
        /* swallow */
      }
    },
    lastIntentHint() {
      return hint;
    },
  };
}
