import { test } from "node:test";
import assert from "node:assert/strict";
import {
  detectFriction,
  canPrompt,
  DEFAULT_CAPS,
  RAGE_CLICK_COUNT,
} from "../src/triggers.ts";
import type { TrailEvent } from "../src/types.ts";

// The make-or-break craft surface (FR-4/NFR-2): friction detection severity order
// + the conservative fatigue caps. Pure, so it's unit-testable ahead of any live
// traffic — the heuristics themselves calibrate later.

const at = (t: number, type: TrailEvent["type"], label?: string): TrailEvent => ({ t, type, label });

test("an error in the window beats everything", () => {
  const now = 10_000;
  const trail = [at(now - 500, "click", "Save"), at(now - 200, "error", "boom")];
  assert.equal(detectFriction(trail, now), "error");
});

test("a rage cluster fires when enough clicks land in the window", () => {
  const now = 10_000;
  const trail: TrailEvent[] = [];
  for (let i = 0; i < RAGE_CLICK_COUNT; i++) trail.push(at(now - 300 + i * 50, "click", "Confirm"));
  assert.equal(detectFriction(trail, now), "rage");
});

test("a dead-click is detected below the rage threshold", () => {
  const now = 10_000;
  const trail = [at(now - 400, "dead_click", "Export")];
  assert.equal(detectFriction(trail, now), "dead_end");
});

test("repeated identical clicks read as retry frustration", () => {
  const now = 10_000;
  // Spread out so they don't form a rage cluster, but repeat the same label.
  const trail = [
    at(now - 6000, "click", "Add seat"),
    at(now - 4000, "click", "Add seat"),
    at(now - 1000, "click", "Add seat"),
  ];
  assert.equal(detectFriction(trail, now), "retry");
});

test("nothing fires on a calm trail", () => {
  const now = 10_000;
  const trail = [at(now - 5000, "route", "/home"), at(now - 1000, "click", "Open")];
  assert.equal(detectFriction(trail, now), null);
});

test("events outside the window are ignored", () => {
  const now = 100_000;
  const trail = [at(1000, "error", "old")]; // way out of window
  assert.equal(detectFriction(trail, now), null);
});

test("fatigue caps: one prompt per session by default, then suppressed", () => {
  const now = 1_000_000;
  assert.equal(canPrompt({ promptsShown: 0, lastPromptAt: null }, now), true);
  assert.equal(canPrompt({ promptsShown: 1, lastPromptAt: now - 1000 }, now), false);
});

test("fatigue caps: cooldown blocks a too-soon second prompt", () => {
  const now = 1_000_000;
  const caps = { ...DEFAULT_CAPS, maxPromptsPerSession: 5 };
  // within cooldown
  assert.equal(canPrompt({ promptsShown: 1, lastPromptAt: now - 1000 }, now, caps), false);
  // past cooldown
  assert.equal(
    canPrompt({ promptsShown: 1, lastPromptAt: now - caps.cooldownMs - 1 }, now, caps),
    true,
  );
});
