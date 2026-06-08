// @sightspool/sdk — the in-product capture runtime (public surface).
//
// Ties the pieces together: passive capture + intent harvest feed a conservative
// trigger engine; on a friction moment or a session boundary we (fatigue
// permitting) show the one-tap prompt, then emit one Signal via batched sendBeacon.
// Every public method is wrapped — the SDK must never throw into the host (NFR-3).

import type { SightspoolConfig, Identity, CapturedSignal } from "./types";
import { createCapture, type CaptureHandle } from "./capture";
import { createHarvest, type HarvestHandle } from "./harvest";
import { createEgress, type EgressHandle } from "./egress";
import {
  detectFriction,
  canPrompt,
  DEFAULT_CAPS,
  type FatigueState,
} from "./triggers";
import {
  buildServeContext,
  fetchIntervention,
  submitResponse,
  getRespondentKey,
} from "./intervention";
import { isLocalhost } from "./env";

export type { SightspoolConfig, Identity } from "./types";

const DEFAULT_ENDPOINT = "https://app.sightspool.com";
const FRICTION_EMIT_COOLDOWN_MS = 30_000;
const EVENT_DEBOUNCE_MS = 600;
// Let the page settle before the first serve check (don't race the initial render).
const SERVE_SETTLE_MS = 2_500;
// Conservative client cap; the server also de-dups (answered) + targets + bounds by
// response_target, so this just stops a dismissed survey re-nagging within a session.
const MAX_INTERVENTIONS_PER_SESSION = 1;

type Controller = {
  config: Required<Pick<SightspoolConfig, "key" | "endpoint" | "boundaryAsk" | "debug">> &
    SightspoolConfig;
  capture: CaptureHandle;
  harvest: HarvestHandle;
  egress: EgressHandle;
  identity: Identity;
  sessionRef: string;
  fatigue: FatigueState;
  lastFrictionEmitAt: number;
  eventTimer: number | null;
  running: boolean;
  /** Environmental kill-switch: on localhost without `captureOnLocalhost`, never start. */
  suppressed: boolean;
  // --- interventions (slice B serve loop) ---
  interventionsEnabled: boolean;
  lastServeRoute: string | null; // re-check serve when the route changes
  surveyOnScreen: boolean;
  interventionsShown: number;
};

function currentHostname(): string {
  try {
    return typeof location !== "undefined" ? location.hostname : "";
  } catch {
    return "";
  }
}

let ctrl: Controller | null = null;

function uuid(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through */
  }
  return "s-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// Locally-derived candidate goals for State B (FR-5). v1 leans on harvested intent
// (a recent search) + the page label; server-LLM enrichment is a follow-up.
function deriveCandidates(c: Controller): string[] {
  const out: string[] = [];
  const hint = c.harvest.lastIntentHint();
  if (hint) out.push(`Searching for “${hint}”`);
  const label = c.capture.label();
  if (label) out.push(`Something on “${label.slice(0, 40)}”`);
  return out;
}

function buildSignal(
  c: Controller,
  trigger: "boundary" | "friction",
  extra: Partial<CapturedSignal> = {},
): CapturedSignal {
  const err = c.capture.error();
  return {
    captured_at: new Date().toISOString(),
    route: c.capture.route(),
    client_label: c.capture.label(),
    trail: c.capture.trail(),
    session_ref: c.sessionRef,
    trigger,
    intent_hint: c.harvest.lastIntentHint(),
    error: err,
    outcome: err || trigger === "friction" ? "failed" : "unknown",
    ...extra,
  };
}

async function maybePrompt(c: Controller, trigger: "boundary" | "friction") {
  const now = Date.now();
  if (canPrompt(c.fatigue, now, DEFAULT_CAPS)) {
    c.fatigue.promptsShown += 1;
    c.fatigue.lastPromptAt = now;
    try {
      const { showPrompt } = await import("./prompt");
      const result = await showPrompt({ candidates: deriveCandidates(c) });
      c.egress.enqueue(
        buildSignal(c, trigger, {
          answer: result.answer,
          verbatim: result.verbatim,
          intent_hint: result.intent ?? c.harvest.lastIntentHint(),
          outcome: result.answer === "yes" ? "achieved" : "failed",
        }),
      );
    } catch {
      // Prompt failed to load/show — still emit the passive Signal (FR-7).
      c.egress.enqueue(buildSignal(c, trigger));
    }
  } else {
    // Fatigued: keep the silent-capture property — emit without asking (FR-7).
    c.egress.enqueue(buildSignal(c, trigger));
  }
}

// Ask the serve endpoint whether there's a human-approved survey to show this user
// here, and if so render it + post the answer. Server-gated (targeting, approval,
// de-dup, response_target); the client guards are just "don't pester": one on
// screen at a time, a per-session cap, and the shared prompt cooldown so a survey
// and the passive ask never stack back-to-back.
async function maybeServeIntervention(c: Controller) {
  if (!c.running || !c.interventionsEnabled || c.suppressed) return;
  if (c.surveyOnScreen) return;
  if (c.interventionsShown >= MAX_INTERVENTIONS_PER_SESSION) return;
  const now = Date.now();
  if (c.fatigue.lastPromptAt !== null && now - c.fatigue.lastPromptAt < DEFAULT_CAPS.cooldownMs)
    return;

  const respondentKey = getRespondentKey(c.identity, c.sessionRef);
  const served = await fetchIntervention({
    endpoint: c.config.endpoint,
    key: c.config.key,
    ctx: buildServeContext(c.capture.route(), c.identity),
    respondentKey,
    debug: c.config.debug,
  });
  if (!served || !c.running) return;

  c.surveyOnScreen = true;
  c.interventionsShown += 1;
  c.fatigue.lastPromptAt = Date.now(); // share the cooldown with the passive prompt
  try {
    const { showSurvey } = await import("./survey");
    const result = await showSurvey(served.config);
    if (!result.dismissed && (result.choice || result.text)) {
      submitResponse({
        endpoint: c.config.endpoint,
        key: c.config.key,
        interventionId: served.id,
        response: { choice: result.choice, text: result.text },
        respondentKey,
      });
    }
  } catch {
    /* swallow — a render/import failure must not surface in the host */
  } finally {
    c.surveyOnScreen = false;
  }
}

function onCaptureEvent() {
  const c = ctrl;
  if (!c || !c.running) return;

  // Re-check for a servable intervention when the route changes (SPA navigation).
  try {
    const route = c.capture.route();
    if (route && route !== c.lastServeRoute) {
      c.lastServeRoute = route;
      void maybeServeIntervention(c);
    }
  } catch {
    /* swallow */
  }

  if (c.eventTimer !== null) return; // debounce a burst of events into one check
  c.eventTimer = (typeof window !== "undefined" ? window.setTimeout : setTimeout)(() => {
    c.eventTimer = null;
    try {
      const now = Date.now();
      if (now - c.lastFrictionEmitAt < FRICTION_EMIT_COOLDOWN_MS) return;
      const kind = detectFriction(c.capture.trail(), now);
      if (!kind) return;
      c.lastFrictionEmitAt = now;
      void maybePrompt(c, "friction");
    } catch {
      /* swallow */
    }
  }, EVENT_DEBOUNCE_MS) as unknown as number;
}

function onExitIntent(ev: MouseEvent) {
  const c = ctrl;
  if (!c || !c.running || !c.config.boundaryAsk) return;
  try {
    if (ev.clientY <= 0) void maybePrompt(c, "boundary");
  } catch {
    /* swallow */
  }
}

function startRuntime(c: Controller) {
  if (c.running) return;
  if (c.suppressed) {
    if (c.config.debug)
      console.debug(
        "[sightspool] capture suppressed on localhost (set captureOnLocalhost:true to override)",
      );
    return;
  }
  c.running = true;
  c.capture.start();
  c.harvest.start();
  c.egress.start();
  c.capture.onEvent(onCaptureEvent);
  try {
    document.addEventListener("mouseout", onExitIntent);
  } catch {
    /* swallow */
  }
  // First serve check once the page has settled (route-change checks happen in
  // onCaptureEvent thereafter).
  if (c.interventionsEnabled) {
    c.lastServeRoute = (() => {
      try {
        return c.capture.route();
      } catch {
        return null;
      }
    })();
    (typeof window !== "undefined" ? window.setTimeout : setTimeout)(() => {
      void maybeServeIntervention(c);
    }, SERVE_SETTLE_MS);
  }
  if (c.config.debug) console.debug("[sightspool] started", c.sessionRef);
}

// --- public API --------------------------------------------------------------

export function init(config: SightspoolConfig): void {
  try {
    if (!config || !config.key) {
      console.warn("[sightspool] init: a `key` is required");
      return;
    }
    if (ctrl) return; // already initialised
    const endpoint = config.endpoint || DEFAULT_ENDPOINT;
    const privacyOpts = { redact: config.redact, block: config.block };
    const capture = createCapture({ debug: !!config.debug, ...privacyOpts });
    const harvest = createHarvest(capture, { debug: !!config.debug, ...privacyOpts });
    const egress = createEgress({ key: config.key, endpoint, debug: !!config.debug });
    ctrl = {
      config: {
        ...config,
        key: config.key,
        endpoint,
        boundaryAsk: config.boundaryAsk !== false,
        debug: !!config.debug,
      },
      capture,
      harvest,
      egress,
      identity: {},
      sessionRef: uuid(),
      fatigue: { promptsShown: 0, lastPromptAt: null },
      lastFrictionEmitAt: 0,
      eventTimer: null,
      running: false,
      suppressed: isLocalhost(currentHostname()) && config.captureOnLocalhost !== true,
      interventionsEnabled: config.interventions !== false,
      lastServeRoute: null,
      surveyOnScreen: false,
      interventionsShown: 0,
    };
    if (config.consent !== false) startRuntime(ctrl);
  } catch (err) {
    // init itself must never throw into the host.
    try {
      console.warn("[sightspool] init failed", err);
    } catch {
      /* swallow */
    }
  }
}

export function identify(userId: string, traits?: { account?: string; plan?: string }): void {
  try {
    if (!ctrl) return;
    ctrl.identity = { userId, account: traits?.account, plan: traits?.plan };
    ctrl.egress.setIdentity(ctrl.identity);
  } catch {
    /* swallow */
  }
}

/** Begin capture if init was called with { consent: false }. */
export function start(): void {
  try {
    if (ctrl) startRuntime(ctrl);
  } catch {
    /* swallow */
  }
}

/**
 * Runtime consent gate (a clean toggle over start()/stop()) — wire it to your cookie
 * banner: `Sightspool.consent(true)` resumes capture, `Sightspool.consent(false)`
 * pauses and flushes. Pairs with init `{ consent: false }` to stay dark until granted.
 */
export function consent(granted: boolean): void {
  try {
    if (!ctrl) return;
    if (granted) startRuntime(ctrl);
    else stop();
  } catch {
    /* swallow */
  }
}

/** Pause capture and flush whatever's queued. */
export function stop(): void {
  try {
    if (!ctrl) return;
    ctrl.running = false;
    ctrl.capture.stop();
    ctrl.harvest.stop();
    ctrl.egress.stop();
    try {
      document.removeEventListener("mouseout", onExitIntent);
    } catch {
      /* swallow */
    }
  } catch {
    /* swallow */
  }
}

const api = { init, identify, start, stop, consent };
export default api;

// --- script-tag auto-init ----------------------------------------------------
// The standalone <script data-sightspool-key="pk_…"> install auto-boots from its
// own tag's data attributes. (No-op for the ESM build: module scripts have no
// document.currentScript, so bundler consumers always call init() themselves.)
try {
  if (typeof document !== "undefined") {
    // currentScript is null for async/defer/dynamically-injected scripts (e.g.
    // Next's <Script> component), so fall back to finding our tag by attribute.
    const el =
      (document.currentScript as HTMLScriptElement | null) ??
      document.querySelector<HTMLScriptElement>("script[data-sightspool-key]");
    const key = el?.getAttribute("data-sightspool-key");
    if (key) {
      // Default the ingest endpoint to where the bundle was served from — the app
      // serves /sdk.global.js, so a same-origin script install needs only the key.
      // An explicit data-sightspool-endpoint still wins (e.g. a CDN-hosted bundle).
      let endpoint = el?.getAttribute("data-sightspool-endpoint") || undefined;
      if (!endpoint && el?.src) {
        try {
          endpoint = new URL(el.src).origin;
        } catch {
          /* keep the built-in default */
        }
      }
      // Comma-separated CSS selectors → string[] (the script-tag equivalent of the
      // init() arrays; bundler users pass arrays directly).
      const list = (attr: string): string[] | undefined => {
        const raw = el?.getAttribute(attr);
        if (!raw) return undefined;
        const out = raw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        return out.length ? out : undefined;
      };
      init({
        key,
        endpoint,
        redact: list("data-sightspool-redact"),
        block: list("data-sightspool-block"),
        captureOnLocalhost: el?.hasAttribute("data-sightspool-capture-localhost") || undefined,
        interventions: el?.hasAttribute("data-sightspool-no-interventions") ? false : undefined,
        debug: el?.hasAttribute("data-sightspool-debug") || undefined,
      });
    }
  }
} catch {
  /* swallow */
}
