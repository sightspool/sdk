import api from "./index";
export * from "./index";
export default api;

try {
  const script = document.currentScript as HTMLScriptElement | null;
  const key = script?.dataset.sightspoolKey || script?.dataset.key;
  const audience = script?.dataset.sightspoolAudience;
  if (key && (audience === "all_visitors" || audience === "signed_in")) {
    api.init({ key, audience, endpoint: script?.dataset.sightspoolEndpoint || new URL(script!.src).origin });
    if (script?.dataset.userId) api.identify(script.dataset.userId);
  }
  // The old research-widget URL is an alias of this bundle, not another runtime.
  (window as Window & { SightspoolResearch?: typeof api }).SightspoolResearch = api;
  Promise.resolve().then(() => window.dispatchEvent(new Event("sightspool:ready")));
} catch { /* Browser auto-init must not interrupt the client app. */ }
