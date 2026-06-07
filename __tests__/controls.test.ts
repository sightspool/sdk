import { test } from "node:test";
import assert from "node:assert/strict";
import { isIgnoredElement, matchesRedactSelector, REDACTED } from "../src/privacy.ts";
import { isLocalhost } from "../src/env.ts";

// The privacy controls (block / data-sightspool-ignore / redact) and the
// no-op-on-localhost guard are the host's opt-outs — they must be conservative and
// never throw. They depend only on Element.closest, so a tiny fake exercises them.

/** A fake element whose closest() matches any of the given selectors. */
function fakeEl(matching: string[] = []): { closest: (sel: string) => unknown } {
  return { closest: (sel: string) => (matching.includes(sel) ? {} : null) };
}

test("data-sightspool-ignore opts an element (or its subtree) out entirely", () => {
  assert.equal(isIgnoredElement(fakeEl(["[data-sightspool-ignore]"])), true);
  assert.equal(isIgnoredElement(fakeEl([])), false);
});

test("block selectors drop matching elements", () => {
  assert.equal(isIgnoredElement(fakeEl([".pii"]), [".pii", ".secret"]), true);
  assert.equal(isIgnoredElement(fakeEl([".other"]), [".pii"]), false);
});

test("empty / null targets and empty selectors are safe", () => {
  assert.equal(isIgnoredElement(null), false);
  assert.equal(isIgnoredElement(undefined, [".pii"]), false);
  assert.equal(isIgnoredElement(fakeEl([".pii"]), ["", ".pii"]), true); // empty selector skipped
  assert.equal(isIgnoredElement({}, [".pii"]), false); // no closest() → not ignored
});

test("a selector that throws (host misconfig) never throws and never accidentally captures", () => {
  const throwingEl = {
    closest: (sel: string) => {
      if (sel === "::bad::") throw new SyntaxError("bad selector");
      return null;
    },
  };
  // The bad selector is treated as no-match; the ignore attribute still wins.
  assert.equal(isIgnoredElement(throwingEl, ["::bad::"]), false);
  assert.equal(
    isIgnoredElement(
      { closest: (sel: string) => (sel === `[data-sightspool-ignore]` ? {} : (() => { throw new Error("x"); })()) },
      ["::bad::"],
    ),
    true,
  );
});

test("redact selectors flag an element for wholesale masking", () => {
  assert.equal(matchesRedactSelector(fakeEl([".customer-name"]), [".customer-name"]), true);
  assert.equal(matchesRedactSelector(fakeEl([]), [".customer-name"]), false);
  assert.equal(matchesRedactSelector(null, [".x"]), false);
  assert.equal(REDACTED, "‹redacted›");
});

test("localhost hosts are suppressed by default", () => {
  for (const h of ["localhost", "127.0.0.1", "0.0.0.0", "::1", "", "app.localhost", "myapp.local"]) {
    assert.equal(isLocalhost(h), true, `${h} should be local`);
  }
});

test("real hosts are not treated as localhost", () => {
  for (const h of ["guidebeam.com", "app.sightspool.com", "192.168.1.10", "localhost.evil.com"]) {
    assert.equal(isLocalhost(h), false, `${h} should not be local`);
  }
});

test("isLocalhost is case-insensitive and trims", () => {
  assert.equal(isLocalhost("  LOCALHOST "), true);
  assert.equal(isLocalhost(null), true); // missing hostname (non-browser) → treat as local/no-op
});
