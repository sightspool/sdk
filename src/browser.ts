import api from "./index";
export * from "./index";
export default api;

try {
  const script = document.currentScript as HTMLScriptElement | null;
  const key = script?.dataset.justusabilityKey;
  const audience = script?.dataset.justusabilityAudience;
  if (key && (audience === "automatic" || audience === "all_visitors" || audience === "signed_in")) {
    const theme = script?.dataset.justusabilityTheme;
    api.init({ key, audience, theme: theme === "light" || theme === "auto" ? theme : "dark", endpoint: script?.dataset.justusabilityEndpoint || new URL(script!.src).origin });
    if (script?.dataset.userId) api.identify(script.dataset.userId);
  }
  Promise.resolve().then(() => window.dispatchEvent(new Event("justusability:ready")));
} catch { /* Browser auto-init must not interrupt the client app. */ }
