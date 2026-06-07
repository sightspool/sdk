// Trigger + fatigue logic (FR-4, NFR-2) — the make-or-break craft surface.
//
// Kept PURE (no DOM) so it unit-tests cleanly under `node --test` and so the
// heuristics can be tuned against real traffic later without touching the capture
// wiring. Detection quality is the primary failure mode (false positives that
// pester users), so the defaults are deliberately conservative.

import type { TrailEvent } from "./types";

export const RAGE_CLICK_COUNT = 3; // clicks…
export const RAGE_WINDOW_MS = 1_000; // …within this window form a rage cluster
export const FRICTION_RETRY_COUNT = 3; // repeated identical actions = retry frustration
export const FRICTION_WINDOW_MS = 8_000; // how far back a friction scan looks

export type FrictionKind = "error" | "rage" | "dead_end" | "retry";

/**
 * Scan the recent trail for a friction moment. Returns the strongest kind found,
 * or null. Order = severity: a real error beats a rage cluster beats a dead-end
 * beats repeated retries.
 */
export function detectFriction(
  trail: TrailEvent[],
  now: number,
  windowMs = FRICTION_WINDOW_MS,
): FrictionKind | null {
  const recent = trail.filter((e) => now - e.t <= windowMs);

  if (recent.some((e) => e.type === "error" || e.type === "request_error")) return "error";

  const clicks = recent.filter((e) => e.type === "click" || e.type === "rage_click");
  for (let i = 0; i < clicks.length; i++) {
    const burst = clicks.filter(
      (e) => e.t >= clicks[i].t && e.t - clicks[i].t <= RAGE_WINDOW_MS,
    );
    if (burst.length >= RAGE_CLICK_COUNT) return "rage";
  }

  if (recent.some((e) => e.type === "dead_click")) return "dead_end";

  const byLabel = new Map<string, number>();
  for (const e of clicks) {
    if (!e.label) continue;
    const n = (byLabel.get(e.label) ?? 0) + 1;
    byLabel.set(e.label, n);
    if (n >= FRICTION_RETRY_COUNT) return "retry";
  }

  return null;
}

// --- Fatigue caps (NFR-2): never pester. Conservative by default. ------------

export type FatigueCaps = {
  maxPromptsPerSession: number;
  cooldownMs: number; // min gap between prompts
};

export const DEFAULT_CAPS: FatigueCaps = {
  maxPromptsPerSession: 1,
  cooldownMs: 5 * 60_000,
};

export type FatigueState = {
  promptsShown: number;
  lastPromptAt: number | null;
};

/** May we show a prompt right now, given how many we've shown and when? */
export function canPrompt(
  state: FatigueState,
  now: number,
  caps: FatigueCaps = DEFAULT_CAPS,
): boolean {
  if (state.promptsShown >= caps.maxPromptsPerSession) return false;
  if (state.lastPromptAt !== null && now - state.lastPromptAt < caps.cooldownMs) return false;
  return true;
}
