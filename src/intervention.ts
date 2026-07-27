// Intervention serve/respond (Wave 0005 slice B — the client half). The two-way
// SDK: besides emitting Signals, the SDK asks "is there anything to show this user
// here?" (/api/sdk/serve) and posts the answer (/api/sdk/respond). Both halves are
// wrapped — a serve/respond failure must never surface in the host app (NFR-3); the
// worst case is simply no survey shown.
//
// Pure helpers (buildServeContext / normalizeServed / pickRespondentKey) are split
// out so the contract is unit-testable without a DOM, like triggers.ts.

import type { Identity } from "./types";
import type { SurveyConfig } from "./survey";
import type { ProbeConfig } from "./probe";

export type ServeContext = { route?: string; account?: string; plan?: string };

export type ServedIntervention =
  | { id: string; type: "survey"; config: SurveyConfig }
  | { id: string; type: "demand_probe"; config: ProbeConfig };

export type InterventionAnswer = { choice?: string; text?: string };

// Types the SDK can actually render. Mirrors the server's RENDERABLE_TYPES; if the
// server ever serves an un-renderable type we drop it rather than show a blank.
const RENDERABLE = new Set(["survey", "demand_probe"]);

function str(v: unknown, max: number): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t ? t.slice(0, max) : undefined;
}

/** The serve context from the current route + the identified account/plan. Only
 *  defined fields are included (an absent field = unconstrained on the server). */
export function buildServeContext(
  route: string | undefined,
  identity: Identity | undefined,
): ServeContext {
  const ctx: ServeContext = {};
  const r = str(route, 500);
  if (r) ctx.route = r;
  const account = str(identity?.account, 200);
  if (account) ctx.account = account;
  const plan = str(identity?.plan, 80);
  if (plan) ctx.plan = plan;
  return ctx;
}

/** Validate + normalise what /serve returned — never trust the wire blindly. Returns
 *  a clean ServedIntervention or null (unknown shape / un-renderable type /
 *  incomplete config). */
export function normalizeServed(raw: unknown): ServedIntervention | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = str(r.id, 64);
  const type = str(r.type, 40);
  if (!id || !type || !RENDERABLE.has(type)) return null;

  const cfg =
    r.config && typeof r.config === "object" ? (r.config as Record<string, unknown>) : {};

  if (type === "demand_probe") {
    // The honest painted door: label = the feature as the user would want it;
    // disclosure = the fixed "this doesn't exist yet" copy the server always
    // injects. If the disclosure is missing we DROP the probe rather than
    // render an undisclosed fake door — the client-side belt to the server's
    // braces.
    const label = str(cfg.label, 200);
    const disclosure = str(cfg.disclosure, 300);
    if (!label || !disclosure) return null;
    return { id, type, config: { label, disclosure } };
  }

  const question = str(cfg.question, 500);
  if (!question) return null;

  const options = Array.isArray(cfg.options)
    ? (cfg.options as unknown[])
        .map((o) => str(o, 200))
        .filter((o): o is string => !!o)
        .slice(0, 6)
    : undefined;

  const config: SurveyConfig = {
    question,
    ...(options && options.length ? { options } : {}),
    allow_text: cfg.allow_text === true,
  };
  return { id, type: "survey", config };
}

/** Stable id for serve-time de-dup (so a tapped survey doesn't reappear). The
 *  identified user wins; else a persisted anon id; else the per-session ref. Pure
 *  so it's testable — the localStorage read lives in getRespondentKey. */
export function pickRespondentKey(
  userId: string | undefined,
  persisted: string | null,
  sessionRef: string,
): string {
  const uid = str(userId, 200);
  if (uid) return uid;
  const p = str(persisted, 200);
  if (p) return p;
  return sessionRef;
}

const RK_STORAGE_KEY = "sightspool_rk";

/** Resolve the respondent key, persisting an anonymous one in localStorage so
 *  de-dup survives reloads. Falls back to the session ref if storage is blocked. */
export function getRespondentKey(
  identity: Identity | undefined,
  sessionRef: string,
): string {
  const uid = str(identity?.userId, 200);
  if (uid) return uid;
  try {
    let v = localStorage.getItem(RK_STORAGE_KEY);
    if (!v) {
      v = "anon-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(RK_STORAGE_KEY, v);
    }
    return pickRespondentKey(undefined, v, sessionRef);
  } catch {
    return sessionRef;
  }
}

function serveUrl(endpoint: string, path: string): string {
  return `${endpoint.replace(/\/+$/, "")}/api/sdk/${path}`;
}

/** Ask the serve endpoint for an intervention to show, or null. Uses a text/plain
 *  POST (CORS-safelisted → no preflight) and reads the JSON response (the serve
 *  route sets Access-Control-Allow-Origin). */
export async function fetchIntervention(opts: {
  endpoint: string;
  key: string;
  ctx: ServeContext;
  respondentKey: string;
  debug?: boolean;
}): Promise<ServedIntervention | null> {
  try {
    if (typeof fetch !== "function") return null;
    const res = await fetch(serveUrl(opts.endpoint, "serve"), {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({
        key: opts.key,
        context: opts.ctx,
        respondent_key: opts.respondentKey,
      }),
      mode: "cors",
      credentials: "omit",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { intervention?: unknown };
    const served = normalizeServed(data?.intervention);
    if (opts.debug) console.debug("[sightspool] serve", served?.id ?? "(none)");
    return served;
  } catch {
    return null;
  }
}

/** Post a user's answer. Fire-and-forget (sendBeacon, fetch+keepalive fallback) —
 *  the response is a 204 we don't need to read. */
export function submitResponse(opts: {
  endpoint: string;
  key: string;
  interventionId: string;
  response: InterventionAnswer;
  respondentKey: string;
}): void {
  try {
    const url = serveUrl(opts.endpoint, "respond");
    const json = JSON.stringify({
      key: opts.key,
      intervention_id: opts.interventionId,
      response: opts.response,
      respondent_key: opts.respondentKey,
    });
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([json], { type: "text/plain" });
      if (navigator.sendBeacon(url, blob)) return;
    }
    if (typeof fetch === "function") {
      void fetch(url, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: json,
        keepalive: true,
        mode: "cors",
        credentials: "omit",
      }).catch(() => {
        /* swallow */
      });
    }
  } catch {
    /* swallow */
  }
}
