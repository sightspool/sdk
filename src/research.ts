export type SightspoolConfig = {
  /** Public workspace widget key from Go live (UUID, not an old pk_live key). */
  key: string;
  /** Match the approved research audience. No default that widens recruitment. */
  audience: "all_visitors" | "signed_in";
  /** Sightspool origin. Defaults to the hosted application. */
  endpoint?: string;
};
export type ResearchStatus =
  | "not_initialized" | "signed_out" | "paused" | "checking"
  | "unavailable" | "available" | "error";

type Runtime = {
  key: string; endpoint: string; audience: SightspoolConfig["audience"]; identified: boolean; paused: boolean;
  disposed: boolean; generation: number; device: string; offer: string | null;
  button: HTMLButtonElement | null; panel: HTMLElement | null; frame: HTMLIFrameElement | null;
  expanded: boolean; message: ((event: MessageEvent) => void) | null;
  pending: AbortController | null; timer: number; visibility: () => void;
  status: ResearchStatus;
};
const slot = Symbol.for("sightspool.research.runtime.v1");
type Host = Window & { [slot]?: Runtime };
const host = (): Host | null => typeof window === "undefined" ? null : window as Host;
const current = () => host()?.[slot];
const eligible = (r: Runtime) => r.audience === "all_visitors" || r.identified;

function remove(r: Runtime) {
  // An opened interview owns its lifetime. Recruitment changes cannot end it.
  if (r.frame) return;
  r.button?.remove(); r.button = null; r.offer = null;
}
function invalidate(r: Runtime) {
  r.generation += 1; r.pending?.abort(); r.pending = null; remove(r);
}
function status(r: Runtime, value: ResearchStatus) { r.status = value; }

function expand(r: Runtime, expanded: boolean) {
  if (!r.panel || !r.frame || !r.button) return;
  r.expanded = expanded;
  r.panel.hidden = !expanded;
  r.panel.style.display = expanded ? "flex" : "none";
  r.button.hidden = expanded;
  r.button.setAttribute("aria-expanded", String(expanded));
  if (expanded) {
    r.panel.querySelector<HTMLButtonElement>("button")?.focus();
  } else r.button.focus();
}
function openPanel(r: Runtime) {
  if (r.frame) { expand(r, true); return; }
  if (!r.offer || !r.button) return;
  const panel = document.createElement("section");
  panel.id = "sightspool-interview-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Sightspool interview");
  panel.style.cssText = "position:fixed;bottom:16px;right:16px;z-index:2147483001;width:420px;max-width:calc(100vw - 32px);height:680px;max-height:calc(100dvh - 32px);border:1px solid #e6dfe3;border-radius:20px;background:#fff;color:#262024;box-shadow:0 12px 50px #0003;overflow:hidden;font:14px system-ui;display:flex;flex-direction:column";
  const header = document.createElement("div");
  header.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border-bottom:1px solid #eee;flex-shrink:0";
  const title = document.createElement("strong"); title.textContent = "Sightspool";
  const minimize = document.createElement("button");
  minimize.type = "button"; minimize.textContent = "Minimize";
  minimize.style.cssText = "font:inherit;color:inherit;background:#fff;border:1px solid #d6cbd1;border-radius:8px;padding:8px 12px;cursor:pointer";
  const hide = () => { expand(r, false); };
  minimize.onclick = hide;
  header.appendChild(title); header.appendChild(minimize); panel.appendChild(header);
  const frame = document.createElement("iframe");
  frame.title = "Sightspool research conversation";
  frame.allow = "microphone; autoplay";
  frame.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms");
  frame.referrerPolicy = "no-referrer";
  frame.style.cssText = "display:block;width:100%;flex:1;min-height:0;border:0;background:#fff";
  const url = new URL(r.endpoint + "/interview-widget");
  url.searchParams.set("key", r.key);
  url.hash = new URLSearchParams({ offer: r.offer, device: r.device }).toString();
  frame.src = url.href;
  panel.appendChild(frame);
  panel.onkeydown = (event) => { if (event.key === "Escape") { event.preventDefault(); hide(); } };
  r.panel = panel; r.frame = frame;
  r.message = (event) => {
    // Only this exact embedded document may control its presentation. No interview
    // content, capabilities or account data cross the parent messaging boundary.
    if (event.source !== frame.contentWindow || event.origin !== r.endpoint || event.data?.type !== "sightspool:panel:minimize") return;
    hide();
  };
  window.addEventListener("message", r.message);
  r.button.textContent = "Return to interview";
  r.button.setAttribute("aria-label", "Sightspool: return to your interview");
  r.button.setAttribute("aria-controls", panel.id);
  r.button.onclick = () => { expand(r, true); };
  document.body.appendChild(panel);
  expand(r, true);
}

async function check(r: Runtime) {
  if (r.frame || r.disposed || r.paused || !eligible(r) || r.pending || document.visibilityState !== "visible") return;
  const generation = r.generation;
  const request = new AbortController();
  r.pending = request;
  const timeout = window.setTimeout(() => request.abort(), 10_000);
  if (!r.button) status(r, "checking");
  try {
    const response = await fetch(r.endpoint + "/widget-offer", {
      method: "POST", credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operation: "offer", key: r.key, device: r.device }),
      signal: request.signal,
    });
    if (!response.ok) throw Error("offer unavailable");
    const result = await response.json();
    if (r.disposed || generation !== r.generation || r.paused || !eligible(r)) return;
    if (result.available !== true || typeof result.offer !== "string" || !result.offer) {
      remove(r); status(r, "unavailable"); return;
    }
    r.offer = result.offer;
    status(r, "available");
    if (r.button) return;
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Share your experience · 5 min";
    button.setAttribute("aria-label", "Sightspool: join a five-minute user interview");
    button.style.cssText = "position:fixed;bottom:20px;right:20px;z-index:2147483000;padding:14px 18px;border:0;border-radius:999px;background:#ad1668;color:white;font:500 14px system-ui;box-shadow:0 8px 30px #0003;cursor:pointer;max-width:calc(100vw - 40px)";
    button.onclick = () => {
      try {
        if (r.disposed || r.paused || !eligible(r) || !r.offer) return;
        openPanel(r);
      } catch { /* Host pages remain usable if embedding is blocked. */ }
    };
    r.button = button;
    document.body.appendChild(button);
  } catch {
    if (!r.disposed && generation === r.generation) { remove(r); status(r, "error"); }
  } finally {
    window.clearTimeout(timeout);
    if (r.pending === request) r.pending = null;
  }
}

/** Start research for the chosen audience. Signed-in-only waits for identify(). */
export function init(config: SightspoolConfig): void {
  try {
    const browser = host();
    if (!browser || !config || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(config.key)) return;
    if (config.audience !== "all_visitors" && config.audience !== "signed_in") return;
    const url = new URL(config.endpoint || "https://www.sightspool.com");
    if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))) return;
    if (url.username || url.password) return;
    const previous = current();
    if (previous && previous.key === config.key && previous.endpoint === url.origin && previous.audience === config.audience) return;
    // A second loader/workspace must not replace a participant's open interview.
    if (previous?.frame) return;
    if (previous) destroy();
    let device = "";
    try { device = sessionStorage.getItem("sightspool-widget-device:" + config.key) || ""; } catch {}
    if (!/^ss_fcd_[A-Za-z0-9_-]{43}$/.test(device)) {
      const bytes = crypto.getRandomValues(new Uint8Array(32));
      device = "ss_fcd_" + btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
      try { sessionStorage.setItem("sightspool-widget-device:" + config.key, device); } catch {}
    }
    const r: Runtime = {
      key: config.key, endpoint: url.origin, audience: config.audience, identified: false, paused: false,
      disposed: false, generation: 0, device, offer: null, button: null,
      panel: null, frame: null, expanded: false, message: null, pending: null, timer: 0, visibility: () => {}, status: "signed_out",
    };
    browser[slot] = r;
    r.visibility = () => {
      try {
        if (document.visibilityState === "visible") void check(r);
        else { invalidate(r); status(r, r.paused ? "paused" : eligible(r) ? "unavailable" : "signed_out"); }
      } catch {}
    };
    document.addEventListener("visibilitychange", r.visibility);
    r.timer = window.setInterval(() => { void check(r); }, 15_000);
    if (eligible(r)) void check(r);
  } catch { /* Never throw into the host application. */ }
}

/** Only the presence of an ID is retained. The ID itself is never stored or sent. */
export function identify(userId: string | null | undefined): void {
  try {
    const r = current();
    if (!r) return;
    const identified = typeof userId === "string" && userId.trim().length > 0;
    if (!identified && !r.identified) { if (!r.paused && eligible(r)) void check(r); return; }
    invalidate(r);
    r.identified = identified;
    status(r, r.paused ? "paused" : eligible(r) ? "unavailable" : "signed_out");
    if (eligible(r) && !r.paused) void check(r);
  } catch {}
}
export function pause(): void {
  try { const r = current(); if (r) { r.paused = true; invalidate(r); status(r, "paused"); } } catch {}
}
export function resume(): void {
  try { const r = current(); if (r) { r.paused = false; if (!eligible(r)) status(r, "signed_out"); void check(r); } } catch {}
}
/** Stop recruitment and remove listeners/UI. Does not end an already opened interview. */
export function destroy(): void {
  try {
    const r = current();
    if (!r) return;
    r.disposed = true; invalidate(r);
    window.clearInterval(r.timer);
    document.removeEventListener("visibilitychange", r.visibility);
    // Keep the session panel and its launcher reachable until the page is left.
    // Minimize is presentation only; end/withdraw remain explicit inside the frame.
    if (!r.frame) delete host()![slot];
  } catch {}
}
export function getStatus(): ResearchStatus {
  try { return current()?.status ?? "not_initialized"; } catch { return "error"; }
}
