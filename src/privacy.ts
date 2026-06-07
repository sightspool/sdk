// Redaction — mask sensitive text before it ever leaves the page (GOV-3). The
// pure string helpers are unit-tested; the DOM-querying part (selector masking)
// lives in capture.ts and calls in here.

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const LONG_DIGITS_RE = /\d{6,}/g; // card / account-number-ish runs

export const MAX_LABEL_LEN = 280;

/**
 * Mask PII-ish substrings in a captured label/verbatim and clamp length.
 * Conservative: emails and long digit runs become placeholders. Never throws.
 */
export function redactText(input: string | null | undefined): string {
  if (!input) return "";
  try {
    return String(input)
      .replace(EMAIL_RE, "‹email›")
      .replace(LONG_DIGITS_RE, "‹num›")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, MAX_LABEL_LEN);
  } catch {
    return "";
  }
}

/** Should a captured element's value be dropped entirely (not just masked)? */
export function isSensitiveInput(type: string | null | undefined): boolean {
  const t = (type ?? "").toLowerCase();
  return t === "password" || t === "email" || t === "tel" || t === "creditcard";
}

export const ATTACH_DISCLOSURE = "Session and account attached automatically.";

/** Placeholder substituted for the text of a `redact`-matched element (GOV-3). */
export const REDACTED = "‹redacted›";

/** The per-element opt-out attribute: a click/input inside `[data-sightspool-ignore]` is dropped entirely. */
export const IGNORE_ATTR = "data-sightspool-ignore";

/** Anything with a `.closest(selector)` — the bit of Element we depend on (kept DOM-free for unit tests). */
type Closeable = { closest?: (selectors: string) => unknown };

function safeClosest(el: Closeable, selector: string): boolean {
  try {
    return typeof el.closest === "function" && el.closest(selector) != null;
  } catch {
    // An invalid selector (host misconfig) must never throw into capture — and must
    // never *accidentally capture* what was meant to be excluded: treat as no-match
    // for that one selector and let the others decide.
    return false;
  }
}

/**
 * Should this element's events be dropped entirely (not just masked)? True when the
 * element — or any ancestor — carries `data-sightspool-ignore` or matches one of the
 * configured `block` selectors. The host's hard privacy opt-out (GOV-3).
 */
export function isIgnoredElement(
  el: Closeable | null | undefined,
  blockSelectors: readonly string[] = [],
): boolean {
  if (!el || typeof el.closest !== "function") return false;
  if (safeClosest(el, `[${IGNORE_ATTR}]`)) return true;
  for (const sel of blockSelectors) {
    if (sel && safeClosest(el, sel)) return true;
  }
  return false;
}

/**
 * Should this element's captured text be masked wholesale? True when the element —
 * or any ancestor — matches one of the configured `redact` selectors. (The event is
 * still recorded; only its label becomes {@link REDACTED}.)
 */
export function matchesRedactSelector(
  el: Closeable | null | undefined,
  redactSelectors: readonly string[] = [],
): boolean {
  if (!el || typeof el.closest !== "function") return false;
  for (const sel of redactSelectors) {
    if (sel && safeClosest(el, sel)) return true;
  }
  return false;
}
