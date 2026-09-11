export type SightspoolConfig = {
  /** Public workspace widget key from Go live (UUID, not an old pk_live key). */
  key: string;
  /** Match the approved research audience. No default that widens recruitment. */
  audience: "all_visitors" | "signed_in";
  /** Sightspool origin. Defaults to the hosted application. */
  endpoint?: string;
  /** Match the client site, or follow the visitor’s system preference. */
  theme?: "light" | "dark" | "auto";
};
export type ResearchStatus =
  | "not_initialized" | "signed_out" | "paused" | "checking"
  | "unavailable" | "available" | "error";

type Runtime = {
  theme: "light" | "dark" | "auto";
  key: string; endpoint: string; audience: SightspoolConfig["audience"]; identified: boolean; paused: boolean;
  disposed: boolean; generation: number; device: string; offer: string | null;
  button: HTMLButtonElement | null; panel: HTMLElement | null; frame: HTMLIFrameElement | null;
  attention: boolean; dismissed: boolean; completed: boolean; restoring: boolean; copy: {title:string;subtitle:string}; shell: HTMLElement | null; dismiss: HTMLButtonElement | null;
  expanded: boolean; message: ((event: MessageEvent) => void) | null;
  pending: AbortController | null; timer: number; visibility: () => void;
  status: ResearchStatus;
};
const slot = Symbol.for("sightspool.research.runtime.v1");
type Host = Window & { [slot]?: Runtime };
const host = (): Host | null => typeof window === "undefined" ? null : window as Host;
const current = () => host()?.[slot];
const markerKey = (r: Runtime) => "sightspool-widget-session:" + r.key;
function saveMarker(r: Runtime, value: string) { try { sessionStorage.setItem(markerKey(r), value); } catch {} }
const eligible = (r: Runtime) => r.audience === "all_visitors" || r.identified;

function remove(r: Runtime) {
  // An opened interview owns its lifetime. Recruitment changes cannot end it.
  if (r.frame || r.restoring) return;
  r.shell?.remove(); r.shell = null; r.dismiss = null; r.button = null; r.offer = null;
}
function invalidate(r: Runtime) {
  r.generation += 1; r.pending?.abort(); r.pending = null; remove(r);
}
function status(r: Runtime, value: ResearchStatus) { r.status = value; }

function renderLauncher(r: Runtime) {
  if (!r.button) return;
  const iconOnly = r.completed || (r.dismissed && !r.expanded);
  r.button.className = "ss-launcher" + (iconOnly ? " ss-iconOnly" : !r.frame && r.attention ? " ss-attention" : "");
  const fresh = r.button.children.length === 0;
  const mark = (r.button.children[0] as HTMLElement) ?? document.createElement("span"); mark.className = "ss-launcherMark";
  if (fresh) {const logo = document.createElement("img"); logo.src = r.endpoint + "/sightspool-monomark-dark-bg.svg"; logo.width = 29; logo.height = 29; logo.alt = ""; mark.appendChild(logo);}
  const copy = (r.button.children[1] as HTMLElement) ?? document.createElement("span"); copy.className = "ss-launcherCopy"; copy.setAttribute("aria-hidden", String(iconOnly));
  const title = (copy.children[0] as HTMLElement) ?? document.createElement("strong"); title.textContent = r.completed ? "Your thank-you" : r.expanded ? "Minimise conversation" : r.frame ? "Back to your conversation" : r.copy.title;
  const subtitle = (copy.children[1] as HTMLElement) ?? document.createElement("small"); subtitle.textContent = r.completed ? "Your accepted offer is saved here" : r.frame ? "Return to your interview" : r.copy.subtitle;
  if(fresh){copy.appendChild(title); copy.appendChild(subtitle);}
  const arrow = (r.button.children[2] as HTMLElement) ?? document.createElement("span"); arrow.className = "ss-launcherAction"; arrow.textContent = r.expanded ? "−" : "→"; arrow.setAttribute("aria-hidden", "true");
  if(fresh){r.button.appendChild(mark); r.button.appendChild(copy); r.button.appendChild(arrow);}
  r.button.setAttribute("aria-label", r.completed ? "View your accepted thank-you" : iconOnly ? "Show invitation message" : title.textContent + ". " + subtitle.textContent);
  if (r.completed && !r.button.children[3]) { const check = document.createElement("span"); check.className="ss-receiptCheck"; check.textContent="✓"; check.setAttribute("aria-hidden","true"); r.button.appendChild(check); }
  if (r.dismiss) { r.dismiss.disabled = Boolean(r.frame || r.dismissed); r.dismiss.setAttribute("data-visible", String(!r.frame && !r.dismissed)); }
}
function mountLauncher(r: Runtime) {
  if (r.button) { renderLauncher(r); return; }
  const shell = document.createElement("aside"); shell.className="ss-widgetPosition"; shell.setAttribute("data-theme",r.theme); shell.setAttribute("aria-label","Sightspool research");
  const style = document.createElement("style"); style.textContent = `.ss-widgetPosition { position: fixed; bottom: max(22px,env(safe-area-inset-bottom)); right: max(24px,env(safe-area-inset-right)); z-index: 60; width: min(366px,calc(100vw - 32px)); pointer-events: none; }
.ss-widgetPosition > section[data-open="true"], .ss-launcher, .ss-dismissInvitation[data-visible="true"] { pointer-events: auto; }
.ss-launcherRow { display: flex; align-items: center; justify-content: flex-end; margin-top: 12px; }
.ss-launcher { position: relative; width: max-content; max-width: 100%; interpolate-size: allow-keywords; height: 64px; min-height: 54px; display: grid; grid-template-columns: 44px minmax(0,1fr) 18px; align-items: center; gap: 12px; padding: 8px 19px 8px 9px; color: #fff; background: #18181b; border: 1px solid #ffffff20; border-radius: 999px; box-shadow: 0 8px 32px #18101d30,0 2px 6px #18101d18; text-align: left; transition: width 460ms cubic-bezier(.22,1,.36,1), height 360ms cubic-bezier(.22,1,.36,1), padding 460ms cubic-bezier(.22,1,.36,1), gap 460ms cubic-bezier(.22,1,.36,1), grid-template-columns 460ms cubic-bezier(.22,1,.36,1), transform 180ms, box-shadow 240ms; }
.ss-launcherGroup { position: relative; max-width: 100%; }
.ss-dismissInvitation { position: absolute; top: -12px; right: 0; width: 28px; height: 28px; display: grid; place-items: center; border: 1px solid #dfdbe0; border-radius: 50%; background: #fcfaf9; color: #6e6470; box-shadow: 0 2px 8px #18101d15; opacity: 0; transform: scale(.7); visibility: hidden; transition: opacity 140ms, transform 240ms, visibility 0s 240ms; }
.ss-dismissInvitation[data-visible="true"] { opacity: 1; transform: scale(1); visibility: visible; transition-delay: 220ms,220ms,0s; }
.ss-dismissInvitation:hover { color: #241e25; background: #eee8ed; }
.ss-launcher.ss-attention { animation: invitation-enter 450ms cubic-bezier(.2,.8,.2,1) both, invitation-glow 2400ms 450ms ease-in-out; }
@keyframes invitation-enter { from { opacity: 0; transform: translateY(12px) scale(.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
@keyframes invitation-glow { 0%,100% { box-shadow: 0 8px 32px #18101d30,0 0 0 0 #c6fa6400; } 25%,70% { box-shadow: 0 8px 32px #18101d30,0 0 0 5px #c6fa6440,0 0 28px #a8176830; } 48% { box-shadow: 0 8px 32px #18101d30,0 0 0 1px #c6fa6410; } }
.ss-launcher.ss-iconOnly { position: relative; min-height: 54px; width: 54px; height: 54px; padding: 4px; gap: 0; grid-template-columns: 44px minmax(0,0fr) 0px; box-shadow: 0 3px 14px #18101d20; }
.ss-compactActiveBadge { position: absolute; right: 1px; top: 1px; width: 10px; height: 10px; border: 2px solid #18181b; border-radius: 50%; background: #c6fa64; }
.ss-launcher::after { content: ""; position: absolute; inset: 0; border-radius: inherit; pointer-events: none; opacity: 0; box-shadow: -5px 0 20px #a8176830,5px 0 18px #c6fa641c,inset 0 0 0 1px #ffffff12; transition: opacity 280ms ease; }
@media (hover: hover) {
  .ss-launcher:not(.ss-iconOnly):hover::after { opacity: 1; animation: hover-halo 2200ms ease-in-out infinite; }
  .ss-launcher:not(.ss-iconOnly):hover .ss-launcherMark::before { animation: hover-logo-glow 2200ms ease-in-out infinite; }
}
.ss-launcher:focus-visible::after { opacity: 1; }
@keyframes hover-halo { 0%,100% { opacity: .4; } 50% { opacity: 1; } }
@keyframes hover-logo-glow { 0%,100% { opacity: .925; transform: scale(1); } 50% { opacity: 1; transform: scale(1.08); filter: brightness(1.18); } }
.ss-launcherMark { position: relative; isolation: isolate; display: grid; place-items: center; width: 44px; height: 44px; flex-shrink: 0; border-radius: 50%; }
.ss-launcherMark::before { content: ""; position: absolute; inset: -8px; border-radius: 50%; pointer-events: none; background: radial-gradient(ellipse at 30% 30%,rgb(168 23 104 / 87%),transparent 72%),radial-gradient(ellipse at 74% 68%,rgb(198 250 100 / 50%),transparent 70%); mask-image: radial-gradient(closest-side,#000 59%,transparent 100%); opacity: .925; }
.ss-launcherMark img { position: relative; }
.ss-launcherCopy { min-width: 0; overflow: hidden; white-space: nowrap; opacity: 1; transform: translateX(0); transition: opacity 200ms 100ms, transform 360ms cubic-bezier(.22,1,.36,1); }
.ss-iconOnly .ss-launcherCopy { opacity: 0; transform: translateX(12px); transition-delay: 0s; }
.ss-launcherAction { display: grid; place-items: center; overflow: hidden; color: #c6fa64; opacity: 1; transition: opacity 180ms 140ms, transform 360ms; }
.ss-iconOnly .ss-launcherAction { opacity: 0; transform: translateX(8px); transition-delay: 0s; }
.ss-launcherCopy strong { display: block; font-size: 13px; font-weight: 600; line-height: 1.4; }
.ss-launcherCopy small { display: block; margin-top: 4px; font-size: 12px; color: #d5d0d8; line-height: 1.4; }
.ss-launcher > svg { flex-shrink: 0; color: #c6fa64; }
.ss-activeBadge { flex-shrink: 0; width: 8px; height: 8px; background: #c6fa64; border-radius: 50%; box-shadow: 0 0 0 4px #c6fa6418; }

.ss-widgetPosition{z-index:2147483000;font:14px Arial,Helvetica,sans-serif;line-height:1.5}
.ss-widgetPosition *{box-sizing:border-box}
.ss-widgetPosition button{font:inherit;cursor:pointer;outline-offset:4px}
.ss-panel{position:absolute;bottom:calc(100% + 12px);right:0;width:100%;height:610px;max-height:calc(100dvh - max(22px,env(safe-area-inset-bottom)) - 104px);border:1px solid #e7e0e6;border-radius:20px;background:#fcfaf9;color:#241e25;box-shadow:0 16px 64px #18101d26;overflow:hidden;display:flex;flex-direction:column;transform-origin:bottom right;opacity:0;visibility:hidden;transform:translateY(18px) scale(.82,.2);transition:transform 340ms cubic-bezier(.4,0,.6,1),opacity 180ms,visibility 0s 340ms;pointer-events:none}
.ss-panel[data-open="true"]{opacity:1;visibility:visible;transform:translateY(0) scale(1);transition:transform 480ms cubic-bezier(.16,1,.3,1),opacity 200ms,visibility 0s;pointer-events:auto}
.ss-panel>div,.ss-panel>iframe{opacity:0;transition:opacity 120ms}
.ss-panel[data-open="true"]>div,.ss-panel[data-open="true"]>iframe{opacity:1;transition:opacity 240ms 170ms}
.ss-panel>div{display:flex;align-items:center;justify-content:space-between;padding:12px 18px;border-bottom:1px solid #e7e0e6}
.ss-panel>div>button{border:0;background:transparent;color:#554b58;padding:8px;border-radius:8px}
.ss-panel iframe{display:block;width:100%;flex:1;min-height:0;border:0;background:#fcfaf9}
[data-theme="dark"] .ss-panel{background:#18181b;color:#fff;border-color:#ffffff1c}
[data-theme="dark"] .ss-panel>div{border-color:#ffffff1c}
[data-theme="dark"] .ss-panel>div>button{color:#cbc5cd}
@media(prefers-color-scheme:dark){[data-theme="auto"] .ss-panel{background:#18181b;color:#fff;border-color:#ffffff1c}[data-theme="auto"] .ss-panel>div{border-color:#ffffff1c}[data-theme="auto"] .ss-panel>div>button{color:#cbc5cd}}
.ss-receiptCheck{position:absolute;right:0;top:0;display:grid;place-items:center;width:16px;height:16px;border:2px solid #18181b;border-radius:50%;background:#c6fa64;color:#18181b;font-size:10px}
@media(max-width:560px){.ss-widgetPosition{bottom:max(12px,env(safe-area-inset-bottom));right:auto;left:50%;transform:translateX(-50%);width:min(366px,calc(100vw - 24px))}.ss-panel{max-height:calc(100dvh - max(12px,env(safe-area-inset-bottom)) - 100px);transform-origin:bottom center}.ss-launcher{gap:10px;padding-right:15px;height:80px}.ss-launcherCopy{white-space:normal}.ss-launcherRow{justify-content:center}}
@media(prefers-reduced-motion:reduce){.ss-widgetPosition *,.ss-widgetPosition *::before,.ss-widgetPosition *::after{animation:none!important;transition:none!important}}
`;
  shell.appendChild(style);
  const row = document.createElement("div"); row.className="ss-launcherRow";
  const group = document.createElement("div"); group.className="ss-launcherGroup";
  const button = document.createElement("button"); button.type="button";
  const dismiss = document.createElement("button"); dismiss.type="button"; dismiss.className="ss-dismissInvitation"; dismiss.textContent="×";
  dismiss.setAttribute("aria-label","Dismiss invitation and keep a small button");
  dismiss.onclick=()=>{r.attention=false;r.dismissed=true;try{sessionStorage.setItem("sightspool-widget-dismissed:"+r.key,"1");}catch{}renderLauncher(r);button.focus();};
  button.onanimationend=(event)=>{if(event.animationName.includes("invitation-glow")){r.attention=false;renderLauncher(r);}};
  button.onclick=()=>{
    if(r.completed || r.frame || r.restoring){if(r.frame)expand(r,!r.expanded);else openPanel(r);return;}
    if(r.dismissed){r.attention=false;r.dismissed=false;try{sessionStorage.setItem("sightspool-widget-dismissed:"+r.key,"0");}catch{}renderLauncher(r);return;}
    if(!r.disposed&&!r.paused&&eligible(r))openPanel(r);
  };
  group.appendChild(button);group.appendChild(dismiss);row.appendChild(group);shell.appendChild(row);
  r.shell=shell;r.button=button;r.dismiss=dismiss;document.body.appendChild(shell);renderLauncher(r);
}
function expand(r: Runtime, expanded: boolean) {
  if (!r.panel || !r.frame || !r.button) return;
  if (r.expanded === expanded) return;
  const ownedFocus = r.panel.contains(document.activeElement);
  r.expanded = expanded;
  r.panel.setAttribute("data-open", String(expanded));
  r.panel.setAttribute("aria-hidden", String(!expanded));
  r.panel.inert = !expanded;
  r.button.setAttribute("aria-expanded", String(expanded));
  renderLauncher(r);
  if (expanded) r.panel.querySelector<HTMLButtonElement>("button")?.focus();
  else if (ownedFocus) r.button.focus();
}
function openPanel(r: Runtime) {
  if (r.frame) { expand(r, true); return; }
  if ((!r.offer && !r.restoring) || !r.button || !r.shell) return;
  const panel = document.createElement("section"); panel.className="ss-panel";
  panel.id="sightspool-interview-panel";panel.setAttribute("role","dialog");panel.setAttribute("aria-label","Sightspool interview");
  const header=document.createElement("div");const title=document.createElement("strong");title.textContent="Sightspool";
  const minimize=document.createElement("button");minimize.type="button";minimize.textContent="Minimise";
  const hide=()=>expand(r,false);minimize.onclick=hide;header.appendChild(title);header.appendChild(minimize);panel.appendChild(header);
  const frame=document.createElement("iframe");frame.title="Sightspool research conversation";frame.allow="microphone; autoplay; clipboard-write";
  frame.setAttribute("sandbox","allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox");frame.referrerPolicy="no-referrer";
  const url=new URL(r.endpoint+"/interview-widget");url.searchParams.set("key",r.key);url.searchParams.set("theme",r.theme);
  url.hash=new URLSearchParams(r.restoring ? {device:r.device,restore:"1"} : {offer:r.offer!,device:r.device}).toString();frame.src=url.href;
  panel.appendChild(frame);panel.onkeydown=(event)=>{if(event.key==="Escape"){event.preventDefault();hide();}};
  r.panel=panel;r.frame=frame;
  r.message=(event)=>{
    if(event.source!==frame.contentWindow||event.origin!==r.endpoint)return;
    if(event.data?.type==="sightspool:panel:minimize")hide();
    if(event.data?.type==="sightspool:interview:accepted"){saveMarker(r,"active");}
    if(event.data?.type==="sightspool:interview:ended"){r.completed=true;saveMarker(r,"ended");renderLauncher(r);}
  };
  window.addEventListener("message",r.message);r.button.setAttribute("aria-controls",panel.id);r.shell.appendChild(panel);expand(r,true);
}

async function check(r: Runtime) {
  if (r.frame || r.restoring || r.disposed || r.paused || !eligible(r) || r.pending || document.visibilityState !== "visible") return;
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
    if (result.invitation && typeof result.invitation.title === "string" && typeof result.invitation.subtitle === "string") {
      r.copy={title:result.invitation.title.slice(0,200),subtitle:result.invitation.subtitle.slice(0,240)};
    }
    mountLauncher(r);
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
    if (previous?.frame || previous?.restoring) return;
    if (previous) destroy();
    let device = "";
    try { device = sessionStorage.getItem("sightspool-widget-device:" + config.key) || ""; } catch {}
    if (!/^ss_fcd_[A-Za-z0-9_-]{43}$/.test(device)) {
      const bytes = crypto.getRandomValues(new Uint8Array(32));
      device = "ss_fcd_" + btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
      try { sessionStorage.setItem("sightspool-widget-device:" + config.key, device); } catch {}
    }
    const r: Runtime = {
      theme: config.theme === "light" || config.theme === "auto" ? config.theme : "dark",
      key: config.key, endpoint: url.origin, audience: config.audience, identified: false, paused: false,
      attention: true, dismissed: false, completed: false, restoring: false, copy:{title:"Share your experience",subtitle:"A research conversation"}, shell:null,dismiss:null,
      disposed: false, generation: 0, device, offer: null, button: null,
      panel: null, frame: null, expanded: false, message: null, pending: null, timer: 0, visibility: () => {}, status: "signed_out",
    };
    try {
      r.dismissed=sessionStorage.getItem("sightspool-widget-dismissed:"+r.key)==="1";
      const marker=sessionStorage.getItem(markerKey(r));
      r.restoring=marker==="active"||marker==="ended";r.completed=marker==="ended";
    } catch {}
    browser[slot] = r;
    if(r.restoring){mountLauncher(r);return;}

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
    if (!r.frame && !r.restoring) delete host()![slot];
  } catch {}
}
export function getStatus(): ResearchStatus {
  try { return current()?.status ?? "not_initialized"; } catch { return "error"; }
}
