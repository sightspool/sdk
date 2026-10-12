export type JustusabilityConfig = {
  /** Public workspace widget key from Go live (UUID, not an old pk_live key). */
  key: string;
  /** automatic follows the server-approved question after identify(userId or null). Legacy modes retain their local restriction. */
  audience: "automatic" | "all_visitors" | "signed_in";
  /** Justusability origin. Defaults to the hosted application. */
  endpoint?: string;
  /** Match the client site, or follow the visitor’s system preference. */
  theme?: "light" | "dark" | "auto";
};
export type ResearchStatus =
  | "not_initialized" | "signed_out" | "paused" | "checking"
  | "unavailable" | "available" | "error";

type Runtime = {
  theme: "light" | "dark" | "auto";
  key: string; endpoint: string; audience: JustusabilityConfig["audience"]; identity: string | null; identityReady: boolean; paused: boolean;
  disposed: boolean; generation: number; device: string; offer: string | null;
  button: HTMLButtonElement | null; panel: HTMLElement | null; frame: HTMLIFrameElement | null;
  attention: boolean; dismissed: boolean; completed: boolean; restoring: boolean; copy: {title:string;subtitle:string}; shell: HTMLElement | null; dismiss: HTMLButtonElement | null;
  expanded: boolean; accepted: boolean; message: ((event: MessageEvent) => void) | null;
  pending: AbortController | null; timer: number; visibility: () => void;
  analyticsId: string | null; analytics: boolean; tracked: Set<string>; impression: IntersectionObserver | null; impressionTimer: number;
  status: ResearchStatus;
};
// The server accepts a trimmed, non-empty id of at most this length
// (apps/web/lib/cohortIdentity.ts). Trimming before the bound is applied keeps
// both sides agreeing on exactly which ids are valid.
const MAX_IDENTITY_LENGTH = 200;
const slot = Symbol.for("justusability.research.runtime.v1");
type Host = Window & { [slot]?: Runtime };
const host = (): Host | null => typeof window === "undefined" ? null : window as Host;
const current = () => host()?.[slot];
const markerKey = (r: Runtime) => "justusability-widget-session:" + r.key;
function saveMarker(r: Runtime, value: string) { try { sessionStorage.setItem(markerKey(r), value); } catch {} }
const eligible = (r: Runtime) => r.audience === "automatic" ? r.identityReady : r.audience === "all_visitors" || r.identity !== null;

function analyticsOptOut(): boolean {
  return window.navigator?.doNotTrack === "1" || (window.navigator as Navigator & {globalPrivacyControl?:boolean})?.globalPrivacyControl === true;
}
function track(r: Runtime, event: string, surface = r.frame ? "panel" : r.dismissed ? "compact" : "invitation") {
  if (!r.analytics || !r.offer || analyticsOptOut() || r.tracked.has(event)) return;
  if (event === "widget_interacted" && document.visibilityState === "visible") track(r,"widget_shown",surface);
  r.tracked.add(event);
  void fetch(r.endpoint + "/widget-offer", {
    method: "POST", credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer", keepalive: true,
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({operation:"track",offer:r.offer,device:r.device,event,surface}),
  }).catch(()=>{});
}
function observeInvitation(r: Runtime) {
  if (!r.analytics || !r.button || r.impression || typeof IntersectionObserver === "undefined") return;
  // A server offer is not an impression. Require half the launcher in a visible
  // viewport continuously for one second; this does not prove human attention.
  r.impression = new IntersectionObserver(entries=>{
    window.clearTimeout(r.impressionTimer);
    if (entries.some(entry=>entry.isIntersecting && entry.intersectionRatio>=0.5) && document.visibilityState==="visible")
      r.impressionTimer=window.setTimeout(()=>{if(document.visibilityState==="visible" && r.button?.isConnected) track(r,"widget_shown");},1000);
  },{threshold:[0,0.5]});
  r.impression.observe(r.button);
}
function remove(r: Runtime) {
  // An opened interview owns its lifetime. Recruitment changes cannot end it.
  if (r.frame || r.restoring) return;
  r.impression?.disconnect(); r.impression=null; window.clearTimeout(r.impressionTimer); r.tracked.clear();
  r.shell?.remove(); r.shell = null; r.dismiss = null; r.button = null; r.offer = null;
}
function invalidate(r: Runtime) {
  r.generation += 1; r.pending?.abort(); r.pending = null; remove(r);
}
function status(r: Runtime, value: ResearchStatus) { r.status = value; }

function renderLauncher(r: Runtime) {
  if (!r.button) return;
  const iconOnly = r.completed || r.expanded || (r.dismissed && !r.expanded);
  r.button.className = "ju-launcher" + (iconOnly ? " ju-iconOnly" : !r.frame && r.attention ? " ju-attention" : "");
  const fresh = r.button.children.length === 0;
  const mark = (r.button.children[0] as HTMLElement) ?? document.createElement("span"); mark.className = "ju-launcherMark";
  if (fresh) {const logo = document.createElement("img"); logo.src = r.endpoint + "/brand/justusability-mark.svg"; logo.width = 29; logo.height = 29; logo.alt = ""; mark.appendChild(logo);}
  const copy = (r.button.children[1] as HTMLElement) ?? document.createElement("span"); copy.className = "ju-launcherCopy"; copy.setAttribute("aria-hidden", String(iconOnly));
  const title = (copy.children[0] as HTMLElement) ?? document.createElement("strong"); title.textContent = r.completed ? "Your thank-you" : r.expanded ? "Minimise conversation" : r.frame ? "Back to your conversation" : r.copy.title;
  const subtitle = (copy.children[1] as HTMLElement) ?? document.createElement("small"); subtitle.textContent = r.completed ? "Your accepted offer is saved here" : r.frame ? "Return to your interview" : r.copy.subtitle;
  if(fresh){copy.appendChild(title); copy.appendChild(subtitle);}
  const arrow = (r.button.children[2] as HTMLElement) ?? document.createElement("span"); arrow.className = "ju-launcherAction"; arrow.textContent = r.expanded ? "−" : "→"; arrow.setAttribute("aria-hidden", "true");
  if(fresh){r.button.appendChild(mark); r.button.appendChild(copy); r.button.appendChild(arrow);}
  r.button.setAttribute("aria-label", r.completed ? "View your accepted thank-you" : r.expanded ? "Minimise conversation" : iconOnly ? "Show invitation message" : title.textContent + ". " + subtitle.textContent);
  if (r.completed && !r.button.children[3]) { const check = document.createElement("span"); check.className="ju-receiptCheck"; check.textContent="✓"; check.setAttribute("aria-hidden","true"); r.button.appendChild(check); }
  if (r.dismiss) { r.dismiss.disabled = Boolean(r.frame || r.dismissed); r.dismiss.setAttribute("data-visible", String(!r.frame && !r.dismissed)); }
}
function mountLauncher(r: Runtime) {
  if (r.button) { renderLauncher(r); observeInvitation(r); return; }
  const shell = document.createElement("aside"); shell.className="ju-widgetPosition"; shell.setAttribute("data-theme",r.theme); shell.setAttribute("aria-label","Justusability research");
  const style = document.createElement("style"); style.textContent = `@font-face{font-family:"Justusability Inter";src:url("${r.endpoint}/brand/fonts/Inter-Regular.ttf") format("truetype");font-weight:400;font-display:swap}
@font-face{font-family:"Justusability Inter";src:url("${r.endpoint}/brand/fonts/Inter-SemiBold.ttf") format("truetype");font-weight:600;font-display:swap}
@font-face{font-family:"Justusability Space Grotesk";src:url("${r.endpoint}/brand/fonts/SpaceGrotesk-Medium.ttf") format("truetype");font-weight:500;font-display:swap}
.ju-widgetPosition{position:fixed;bottom:max(22px,env(safe-area-inset-bottom));right:max(24px,env(safe-area-inset-right));z-index:2147483000;width:min(366px,calc(100vw - 32px));pointer-events:none;font:14px "Justusability Inter",Inter,Arial,sans-serif;line-height:1.5;color-scheme:light}
.ju-widgetPosition *{box-sizing:border-box}
.ju-widgetPosition button{font:inherit;cursor:pointer;outline-offset:4px}
.ju-widgetPosition button:focus-visible{outline:3px solid #B6A9FF}
.ju-widgetPosition>section[data-open="true"],.ju-launcher,.ju-dismissInvitation[data-visible="true"]{pointer-events:auto}
.ju-launcherRow{display:flex;align-items:center;justify-content:flex-end;margin-top:12px}
.ju-launcherGroup{position:relative;max-width:100%}
.ju-launcher{position:relative;width:max-content;max-width:100%;height:72px;min-height:54px;display:grid;grid-template-columns:44px minmax(0,1fr) 18px;align-items:center;gap:12px;padding:8px 19px 8px 9px;color:#fff;background:#082F20;border:1px solid #206347;border-radius:999px;text-align:left;transition:width 300ms cubic-bezier(.2,0,0,1),height 300ms,padding 300ms,gap 300ms,grid-template-columns 300ms}
.ju-launcher:hover{border-color:#68DBAA}
.ju-launcher.ju-attention{animation:invitation-enter 450ms cubic-bezier(0,0,.2,1) both}
@keyframes invitation-enter{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
.ju-launcher.ju-iconOnly{min-height:54px;width:54px;height:54px;padding:4px;gap:0;grid-template-columns:44px minmax(0,0fr) 0px}
.ju-launcherMark{display:grid;place-items:center;width:44px;height:44px;flex-shrink:0;border-radius:50%}
.ju-launcherMark img{display:block;width:40px;height:40px}
.ju-launcherCopy{min-width:0;overflow:hidden;white-space:nowrap;opacity:1;transition:opacity 150ms}
.ju-iconOnly .ju-launcherCopy,.ju-iconOnly .ju-launcherAction{opacity:0}
.ju-launcherCopy strong{display:block;font-size:13px;font-weight:600;line-height:1.4}
.ju-launcherCopy small{display:block;margin-top:4px;font-size:12px;color:#D8F2E4;line-height:1.4}
.ju-launcherAction{display:grid;place-items:center;overflow:hidden;color:#68DBAA;opacity:1;transition:opacity 150ms}
.ju-dismissInvitation{position:absolute;top:-18px;right:-4px;width:44px;height:44px;display:grid;place-items:center;border:1px solid #206347;border-radius:50%;background:#E8F6EE;color:#082F20;opacity:0;visibility:hidden;transition:opacity 150ms,visibility 0s 150ms}
.ju-dismissInvitation[data-visible="true"]{opacity:1;visibility:visible;transition-delay:0s}
.ju-dismissInvitation:hover{background:#D8F2E4}
.ju-panel{position:absolute;bottom:calc(100% + 12px);right:0;width:100%;height:610px;max-height:calc(100dvh - max(22px,env(safe-area-inset-bottom)) - 104px);border:1px solid #206347;border-radius:18px;background:#E8F6EE;color:#082F20;overflow:hidden;display:flex;flex-direction:column;transform-origin:bottom right;opacity:0;visibility:hidden;transform:translateY(12px);transition:transform 200ms cubic-bezier(.4,0,1,1),opacity 150ms,visibility 0s 200ms;pointer-events:none}
.ju-panel[data-open="true"]{opacity:1;visibility:visible;transform:translateY(0);transition:transform 300ms cubic-bezier(0,0,.2,1),opacity 200ms,visibility 0s;pointer-events:auto}
.ju-panel>div{display:flex;align-items:center;justify-content:space-between;min-height:72px;flex-shrink:0;padding:14px 20px;border-bottom:1px solid #B6EBD1}
.ju-panelBrand{display:flex;align-items:center;gap:10px;font-family:"Justusability Space Grotesk",Inter,sans-serif;font-size:17px;letter-spacing:-.4px}
.ju-panelBrand strong{font-weight:500}
.ju-panelBrand img{display:block;width:36px;height:36px;border-radius:50%}
.ju-panel>div>button{border:0;background:transparent;color:inherit;min-height:44px;padding:10px;border-radius:999px;font-size:12px}
.ju-panel>div>button:hover{background:#B6EBD1;color:#082F20}
.ju-panel iframe{display:block;width:100%;flex:1;min-height:0;border:0;background:inherit}
.ju-widgetPosition[data-theme="dark"] .ju-panel{background:#082F20;color:#fff;color-scheme:dark}
.ju-widgetPosition[data-theme="dark"] .ju-panel>div{border-color:#206347}
@media(prefers-color-scheme:dark){.ju-widgetPosition[data-theme="auto"] .ju-panel{background:#082F20;color:#fff;color-scheme:dark}.ju-widgetPosition[data-theme="auto"] .ju-panel>div{border-color:#206347}}
.ju-activeBadge,.ju-compactActiveBadge{width:8px;height:8px;background:#68DBAA;border-radius:50%}
.ju-compactActiveBadge{position:absolute;right:1px;top:1px;width:10px;height:10px;border:2px solid #082F20}
.ju-receiptCheck{position:absolute;right:0;top:0;display:grid;place-items:center;width:16px;height:16px;border:2px solid #082F20;border-radius:50%;background:#68DBAA;color:#082F20;font-size:10px}
@media(max-width:560px){.ju-widgetPosition{bottom:max(12px,env(safe-area-inset-bottom));right:auto;left:50%;transform:translateX(-50%);width:min(366px,calc(100vw - 24px))}.ju-panel{max-height:calc(100dvh - max(12px,env(safe-area-inset-bottom)) - 100px);transform-origin:bottom center}.ju-launcher{gap:10px;padding-right:15px;height:80px}.ju-launcherCopy{white-space:normal}.ju-launcherRow{justify-content:center}}
@media(prefers-reduced-motion:reduce){.ju-widgetPosition *,.ju-widgetPosition *::before,.ju-widgetPosition *::after{animation:none!important;transition:none!important}}
`;
  shell.appendChild(style);
  const row = document.createElement("div"); row.className="ju-launcherRow";
  const group = document.createElement("div"); group.className="ju-launcherGroup";
  const button = document.createElement("button"); button.type="button";
  const dismiss = document.createElement("button"); dismiss.type="button"; dismiss.className="ju-dismissInvitation"; dismiss.textContent="×";
  dismiss.setAttribute("aria-label","Dismiss invitation and keep a small button");
  dismiss.onclick=()=>{track(r,"widget_interacted");track(r,"widget_dismissed");r.attention=false;r.dismissed=true;try{sessionStorage.setItem("justusability-widget-dismissed:"+r.key,"1");}catch{}renderLauncher(r);button.focus();};
  button.onanimationend=(event)=>{if(event.animationName.includes("invitation-enter")){r.attention=false;renderLauncher(r);}};
  button.onclick=()=>{
    if(!r.accepted&&!r.restoring&&!r.completed)track(r,"widget_interacted");
    if(r.completed || r.frame || r.restoring){if(r.frame)expand(r,!r.expanded);else openPanel(r);return;}
    if(r.dismissed){r.attention=false;r.dismissed=false;try{sessionStorage.setItem("justusability-widget-dismissed:"+r.key,"0");}catch{}renderLauncher(r);return;}
    if(!r.disposed&&!r.paused&&eligible(r))openPanel(r);
  };
  group.appendChild(button);group.appendChild(dismiss);row.appendChild(group);shell.appendChild(row);
  r.shell=shell;r.button=button;r.dismiss=dismiss;document.body.appendChild(shell);renderLauncher(r);observeInvitation(r);
}
function expand(r: Runtime, expanded: boolean) {
  if (!r.panel || !r.frame || !r.button) return;
  if (r.expanded === expanded) return;
  const ownedFocus = r.panel.contains(document.activeElement);
  if (!r.accepted && !r.restoring && !r.completed) track(r, expanded ? "widget_opened" : "widget_minimized", "panel");
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
  const panel = document.createElement("section"); panel.className="ju-panel";
  panel.id="justusability-interview-panel";panel.setAttribute("role","dialog");panel.setAttribute("aria-label","Justusability interview");
  const header=document.createElement("div");const brand=document.createElement("span");brand.className="ju-panelBrand";
  const logo=document.createElement("img");logo.src=r.endpoint+"/brand/justusability-mark.svg";logo.width=34;logo.height=34;logo.alt="";
  const title=document.createElement("strong");title.textContent="Justusability";brand.appendChild(logo);brand.appendChild(title);
  const minimize=document.createElement("button");minimize.type="button";minimize.textContent="Minimise";
  const hide=()=>expand(r,false);minimize.onclick=hide;header.appendChild(brand);header.appendChild(minimize);panel.appendChild(header);
  const frame=document.createElement("iframe");frame.title="Justusability research conversation";frame.allow="microphone; autoplay; clipboard-write";
  frame.setAttribute("sandbox","allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox");frame.referrerPolicy="no-referrer";
  const url=new URL(r.endpoint+"/interview-widget");url.searchParams.set("key",r.key);url.searchParams.set("theme",r.theme);
  url.hash=new URLSearchParams(r.restoring ? {device:r.device,restore:"1"} : {offer:r.offer!,device:r.device}).toString();frame.src=url.href;
  panel.appendChild(frame);panel.onkeydown=(event)=>{if(event.key==="Escape"){event.preventDefault();hide();}};
  r.panel=panel;r.frame=frame;
  r.message=(event)=>{
    if(event.source!==frame.contentWindow||event.origin!==r.endpoint)return;
    if(event.data?.type==="justusability:panel:resize"){
      const height=event.data.height;
      if(typeof height==="number"&&Number.isFinite(height)&&height>0&&height<=10000)
        panel.style.height=`${Math.ceil(height)+header.offsetHeight+2}px`;
    }
    if(event.data?.type==="justusability:panel:minimize")hide();
    if(event.data?.type==="justusability:interview:accepted"){r.accepted=true;saveMarker(r,"active");}
    if(event.data?.type==="justusability:interview:ended"){r.completed=true;saveMarker(r,"ended");renderLauncher(r);}
    if(event.data?.type==="justusability:invitation:refresh"&&!r.accepted&&!r.restoring&&!r.completed){
      // Recheck the current host identity/cohort, not the expired signed claim.
      void check(r,true).then(fresh=>{
        if(r.frame!==frame||r.accepted||r.restoring||r.completed)return;
        if(fresh){url.searchParams.set("refresh",String(Date.now()));url.hash=new URLSearchParams({offer:r.offer!,device:r.device}).toString();frame.src=url.href;}
        else frame.contentWindow?.postMessage({type:"justusability:invitation:refresh-failed"},r.endpoint);
      });
    }
  };
  window.addEventListener("message",r.message);r.button.setAttribute("aria-controls",panel.id);r.shell.appendChild(panel);expand(r,true);
}

async function check(r: Runtime, refresh = false): Promise<boolean> {
  if ((r.frame && !refresh) || r.restoring || r.disposed || r.paused || !eligible(r) || r.pending || document.visibilityState !== "visible") return false;
  const generation = r.generation;
  const request = new AbortController();
  r.pending = request;
  const timeout = window.setTimeout(() => request.abort(), 10_000);
  if (!r.button) status(r, "checking");
  // Only the offer call carries the identity. The interview page is served by
  // Justusability itself and is handed nothing but the offer and device, so the
  // cohort decision is frozen into the signed offer instead (SIG-122 §10).
  const payload: { operation: string; key: string; device: string; identity?: string; installation?: "automatic-v1"; funnel: "v1"; previousOffer?:string; analyticsOptOut?:boolean } =
    { operation: "offer", key: r.key, device: r.device, funnel: "v1" };
  if (r.analytics && r.offer) payload.previousOffer=r.offer;
  if (analyticsOptOut()) payload.analyticsOptOut=true;
  if (r.identity) payload.identity = r.identity;
  if (r.audience === "automatic") payload.installation = "automatic-v1";
  try {
    const response = await fetch(r.endpoint + "/widget-offer", {
      method: "POST", credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: request.signal,
    });
    if (!response.ok) throw Error("offer unavailable");
    const result = await response.json();
    if (r.disposed || generation !== r.generation || r.paused || !eligible(r)) return false;
    // Older endpoints do not understand automatic targeting. Do not display
    // their offers until the endpoint explicitly reports the approved audience.
    if (r.audience === "automatic" && (
      !["signed_in", "all_visitors"].includes(result.audience) ||
      (result.audience === "signed_in" && !r.identity)
    )) { remove(r); status(r, "unavailable"); return false; }
    if (result.available !== true || typeof result.offer !== "string" || !result.offer) {
      remove(r); status(r, "unavailable"); return false;
    }
    if (r.analyticsId !== (result.invitationId ?? null)) {
      r.tracked.clear();r.impression?.disconnect();r.impression=null;window.clearTimeout(r.impressionTimer);
      r.analyticsId=result.invitationId ?? null;
    }
    r.analytics = result.analytics === true && !analyticsOptOut();
    r.offer = result.offer;
    status(r, "available");
    if (result.invitation && typeof result.invitation.title === "string" && typeof result.invitation.subtitle === "string") {
      r.copy={title:result.invitation.title.slice(0,200),subtitle:result.invitation.subtitle.slice(0,240)};
    }
    mountLauncher(r);
    return true;
  } catch {
    if (!r.disposed && generation === r.generation) { remove(r); status(r, "error"); }
    return false;
  } finally {
    window.clearTimeout(timeout);
    if (r.pending === request) r.pending = null;
  }
}

/** Start research for the chosen audience. Signed-in-only waits for identify(). */
export function init(config: JustusabilityConfig): void {
  try {
    const browser = host();
    if (!browser || !config || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(config.key)) return;
    if (config.audience !== "automatic" && config.audience !== "all_visitors" && config.audience !== "signed_in") return;
    const url = new URL(config.endpoint || "https://research.justusability.com");
    if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))) return;
    if (url.username || url.password) return;
    const previous = current();
    if (previous && previous.key === config.key && previous.endpoint === url.origin && previous.audience === config.audience) return;
    // A second loader/workspace must not replace a participant's open interview.
    if (previous?.frame || previous?.restoring) return;
    if (previous) destroy();
    let device = "";
    try { device = sessionStorage.getItem("justusability-widget-device:" + config.key) || ""; } catch {}
    if (!/^ss_fcd_[A-Za-z0-9_-]{43}$/.test(device)) {
      const bytes = crypto.getRandomValues(new Uint8Array(32));
      device = "ss_fcd_" + btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
      try { sessionStorage.setItem("justusability-widget-device:" + config.key, device); } catch {}
    }
    const r: Runtime = {
      theme: config.theme === "light" || config.theme === "auto" ? config.theme : "dark",
      key: config.key, endpoint: url.origin, audience: config.audience, identity: null, identityReady: false, paused: false,
      attention: true, dismissed: false, completed: false, restoring: false, copy:{title:"Share your experience",subtitle:"A research conversation"}, shell:null,dismiss:null,
      analyticsId:null,analytics:false,tracked:new Set(),impression:null,impressionTimer:0,
      disposed: false, generation: 0, device, offer: null, button: null,
      panel: null, frame: null, expanded: false, accepted: false, message: null, pending: null, timer: 0, visibility: () => {}, status: "signed_out",
    };
    try {
      r.dismissed=sessionStorage.getItem("justusability-widget-dismissed:"+r.key)==="1";
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

/**
 * Identify the signed-in user, and carry that id to the offer request so a
 * cohort-gated research card can tell whether this person is in its cohort.
 *
 * The id is held in memory for the page's lifetime and sent, over TLS, only to
 * this workspace's own Justusability endpoint, only on `operation: "offer"`. It is
 * hashed workspace-scoped on arrival and never stored raw in any table, log or
 * payload. The SDK never writes it to sessionStorage, localStorage, a cookie, a
 * URL, a fragment or a log.
 *
 * `null` clears it, as does any value that is not a non-empty string of at most
 * 200 characters after trimming. An over-length id is never truncated: a
 * truncated id is a different person, and on a gated card that invites the
 * wrong one. Failing as unidentified is the safe direction.
 */
export function identify(userId: string | null | undefined): void {
  try {
    const r = current();
    if (!r) return;
    const trimmed = typeof userId === "string" ? userId.trim() : "";
    const identity = trimmed.length > 0 && trimmed.length <= MAX_IDENTITY_LENGTH ? trimmed : null;
    // null is an explicit signed-out result; undefined/invalid values mean auth
    // is unresolved. Never treat a loading/error state as an anonymous visitor.
    const ready = userId === null || identity !== null;
    const readinessChanged = r.identityReady !== ready;
    r.identityReady = ready;
    // Re-stating the same person leaves their live invitation alone. Any change,
    // including to unidentified, takes the previous person's pending check and
    // minted offer with it, so an account switch never inherits an invitation.
    if (identity === r.identity && !readinessChanged) { if (!r.paused && eligible(r)) void check(r); return; }
    invalidate(r);
    r.identity = identity;
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
