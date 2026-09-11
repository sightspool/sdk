import { test } from "node:test";
import assert from "node:assert/strict";
import * as sdk from "../src/research.ts";

const key = "11111111-1111-4111-8111-111111111111";
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

async function browserTest(run: (env: ReturnType<typeof browser>) => Promise<void>) {
  const env = browser();
  const originals = new Map<string, PropertyDescriptor | undefined>();
  for (const name of ["window", "document", "sessionStorage", "fetch"]) {
    originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: env[name as keyof typeof env] });
  }
  try { await run(env); } finally {
    sdk.destroy();
    for (const [name, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete (globalThis as any)[name];
    }
  }
}
function browser() {
  const requests: { url: string; input: RequestInit; resolve: (response: any) => void; reject: (error: Error) => void }[] = [];
  const roots: any[] = [];
  function flatten(nodes: any[]): any[] {return nodes.flatMap(node=>[node,...flatten(node.children)]);}
  const elements = new Proxy([] as any[], {get(_target,prop){
    const values=flatten(roots).filter(el=>el.className?.split(" ").includes("ss-launcher") || el.className === "ss-panel");
    return Reflect.get(values,prop);
  }});
  const timers = new Map<number, () => void>();
  const visibility = new Set<() => void>();
  const storage = new Map<string, string>();
  const popups: string[] = [];
  const messages = new Set<(event: any) => void>();
  let timerId = 0;
  const window: any = {
    setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout,
    setInterval(fn: () => void) { timers.set(++timerId, fn); return timerId; },
    clearInterval(id: number) { timers.delete(id); },
    addEventListener(name: string, fn: (event: any) => void) { assert.equal(name, "message"); messages.add(fn); },
    removeEventListener(_name: string, fn: (event: any) => void) { messages.delete(fn); },
    open(url: string) { popups.push(url); return { closed: false, focus() {} }; },
  };
  const document: any = {
    visibilityState: "visible",
    createElement(tag: string) {
      const el: any = { tag, children: [], attributes: {}, style: {}, hidden: false, contentWindow: {},
        appendChild(child: any) { this.children.push(child); },
        replaceChildren() { this.children=[]; },
        contains(node: any) {return flatten([el]).includes(node);},
        focus() { document.activeElement = el; },
        querySelector() { return this.children[0]?.children.find((c: any) => c.tag === "button"); },
        setAttribute(k: string, v: string) { this.attributes[k] = v; },
        remove() { const i = roots.indexOf(el); if (i >= 0) roots.splice(i, 1); } };
      return el;
    },
    body: { appendChild(el: any) { roots.push(el); } },
    addEventListener(name: string, listener: () => void) { assert.equal(name, "visibilitychange"); visibility.add(listener); },
    removeEventListener(_name: string, listener: () => void) { visibility.delete(listener); },
  };
  const fetch = (url: string, input: RequestInit) => new Promise((resolve, reject) => { requests.push({ url, input, resolve, reject }); });
  const sessionStorage = { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => storage.set(k, v) };
  const respond = async (i: number, result: unknown, ok = true) => { requests[i].resolve({ ok, json: async () => result }); await tick(); };
  return { window, document, fetch, sessionStorage, requests, elements, timers, visibility, storage, popups, messages, respond };
}

test("research is idle before sign-in and sends no user identity, page data or capture requests", async () => {
  await browserTest(async (env) => {
    sdk.init({ audience: "signed_in", key, endpoint: "https://research.example" });
    assert.equal(sdk.getStatus(), "signed_out");
    env.timers.forEach((fn) => fn());
    assert.equal(env.requests.length, 0);
    sdk.identify("private-user@example.com");
    assert.equal(env.requests.length, 1);
    assert.equal(env.requests[0].url, "https://research.example/widget-offer");
    const body = JSON.parse(env.requests[0].input.body as string);
    assert.deepEqual(Object.keys(body).sort(), ["device", "key", "operation"]);
    assert.match(body.device, /^ss_fcd_[A-Za-z0-9_-]{43}$/);
    assert.equal(env.requests[0].input.credentials, "omit");
    assert.equal(env.requests[0].input.referrerPolicy, "no-referrer");
    assert.equal(JSON.stringify([...env.storage]).includes("private-user"), false);
    await env.respond(0, { available: false, offer: null });
    assert.equal(sdk.getStatus(), "unavailable");
    assert.equal(env.elements.length, 0);
  });
});

test("one approved offer opens an embedded session; minimize and recruitment changes preserve it", async () => {
  await browserTest(async (env) => {
    sdk.init({ audience: "signed_in", key }); sdk.init({ audience: "signed_in", key }); sdk.identify("a-user"); sdk.resume();
    env.timers.forEach((fn) => fn());
    assert.equal(env.timers.size, 1); assert.equal(env.requests.length, 1);
    await env.respond(0, { available: true, offer: "signed-capability" });
    const launcher = env.elements[0]; launcher.onclick();
    assert.equal(env.popups.length, 0);
    const panel = env.elements[1], frame = panel.children[1];
    const url = new URL(frame.src);
    assert.equal(url.pathname, "/interview-widget");
    assert.equal(url.searchParams.get("key"), key);
    assert.equal(url.search.includes("signed-capability"), false);
    assert.equal(new URLSearchParams(url.hash.slice(1)).get("offer"), "signed-capability");
    assert.equal(frame.allow, "microphone; autoplay; clipboard-write");
    assert.equal(frame.attributes.sandbox.includes("allow-popups-to-escape-sandbox"), true);
    env.timers.forEach((fn) => fn()); assert.equal(env.requests.length, 1);
    panel.children[0].children[1].onclick();
    assert.equal(panel.inert, true); assert.equal(launcher.hidden, false);
    assert.equal(env.document.activeElement, launcher);
    launcher.onclick(); assert.equal(panel.inert, false);
    for (const fn of env.messages) {
      fn({origin:"https://evil.example",source:frame.contentWindow,data:{type:"sightspool:panel:minimize"}});
      fn({origin:"https://www.sightspool.com",source:{},data:{type:"sightspool:panel:minimize"}});
    }
    assert.equal(panel.inert, false);
    for (const fn of env.messages) fn({origin:"https://www.sightspool.com",source:frame.contentWindow,data:{type:"sightspool:panel:minimize"}});
    assert.equal(panel.inert, true);
    sdk.identify(null); sdk.pause(); sdk.destroy();
    env.document.visibilityState = "hidden"; env.visibility.forEach((fn) => fn());
    sdk.init({ audience: "all_visitors", key: "22222222-2222-4222-8222-222222222222" });
    assert.equal(env.elements.length, 2); assert.equal(panel.children[1], frame);
    launcher.onclick(); assert.equal(panel.inert, false);
    assert.equal(frame.src, url.href); assert.equal(env.requests.length, 1);
  });
});

test("logout, pause, hidden pages and destruction reject late offer responses", async () => {
  await browserTest(async (env) => {
    sdk.init({ audience: "signed_in", key }); sdk.identify("user-one");
    sdk.identify(null);
    assert.equal(env.requests[0].input.signal?.aborted, true);
    await env.respond(0, { available: true, offer: "stale" });
    assert.equal(env.elements.length, 0); assert.equal(sdk.getStatus(), "signed_out");
    sdk.identify("user-two"); sdk.pause();
    await env.respond(1, { available: true, offer: "stale" });
    assert.equal(env.elements.length, 0); assert.equal(sdk.getStatus(), "paused");
    sdk.resume();
    env.document.visibilityState = "hidden"; env.visibility.forEach((fn) => fn());
    await env.respond(2, { available: true, offer: "stale" });
    assert.equal(env.elements.length, 0);
    env.document.visibilityState = "visible"; env.visibility.forEach((fn) => fn());
    sdk.destroy();
    await env.respond(3, { available: true, offer: "stale" });
    assert.equal(env.elements.length, 0); assert.equal(env.timers.size, 0); assert.equal(env.visibility.size, 0);
    assert.equal(sdk.getStatus(), "not_initialized");
  });
});

test("invalid configuration stays idle; failed requests and revoked offers remove invitations", async () => {
  await browserTest(async (env) => {
    for (const config of [{ key: "pk_live_old" }, { key, endpoint: "http://unsafe.example" }, { key, endpoint: "javascript:alert(1)" }]) sdk.init({ audience: "signed_in", ...config });
    assert.equal(env.timers.size, 0);
    sdk.init({ audience: "signed_in", key }); sdk.identify("user");
    await env.respond(0, { available: true, offer: "ok" });
    env.timers.forEach((fn) => fn());
    await env.respond(1, {}, false);
    assert.equal(env.elements.length, 0); assert.equal(sdk.getStatus(), "error");
    env.timers.forEach((fn) => fn());
    await env.respond(2, { available: true, offer: "ok" });
    env.timers.forEach((fn) => fn());
    await env.respond(3, { available: false });
    assert.equal(env.elements.length, 0);
    sdk.destroy(); sdk.init({ audience: "signed_in", key }); sdk.identify("another-user");
    assert.equal(env.storage.size, 1);
    await env.respond(4, { available: false });
  });
});

test("public API is safe in a non-browser context", () => {
  sdk.init({ audience: "signed_in", key }); sdk.identify("user"); sdk.pause(); sdk.resume(); sdk.destroy();
  assert.equal(sdk.getStatus(), "not_initialized");
});

test("all-visitors research works anonymously and remains eligible after logout", async () => {
  await browserTest(async (env) => {
    sdk.init({ key, audience: "all_visitors" });
    assert.equal(env.requests.length, 1);
    await env.respond(0, { available: true, offer: "guest-offer" });
    assert.equal(env.elements.length, 1);
    sdk.identify("signed-in-user");
    await env.respond(1, { available: true, offer: "signed-in-offer" });
    sdk.identify(null);
    await env.respond(2, { available: true, offer: "guest-again" });
    assert.equal(env.elements.length, 1); assert.equal(sdk.getStatus(), "available");
    sdk.pause();
    assert.equal(env.elements.length, 0);
    sdk.resume();
    await env.respond(3, { available: true, offer: "guest-resumed" });
    assert.equal(env.elements.length, 1);
    sdk.init({ key, audience: "signed_in" });
    assert.equal(env.elements.length, 0); assert.equal(sdk.getStatus(), "signed_out");
    assert.equal(env.timers.size, 1);
    for (const request of env.requests) assert.deepEqual(Object.keys(JSON.parse(request.input.body as string)).sort(), ["device", "key", "operation"]);
  });
});

test("missing or unknown audience does not silently enable visitors", async () => {
  await browserTest(async (env) => {
    sdk.init({ key } as any);
    sdk.init({ key, audience: "unknown" } as any);
    assert.equal(env.requests.length, 0); assert.equal(env.timers.size, 0);
  });
});


test("invitation copy is text, dismissal restores before opening and receipt messages are origin bound", async () => {
  await browserTest(async env=>{
    sdk.init({key,audience:"all_visitors"});
    await env.respond(0,{available:true,offer:"capability",invitation:{title:"<script>private offer</script>",subtitle:"For a 10-minute feedback chat"}});
    const launcher=env.elements[0];
    assert.equal(launcher.children[1].children[0].textContent,"<script>private offer</script>");
    env.storage.set("sightspool-widget-dismissed:"+key,"1");
    sdk.destroy(); sdk.init({key,audience:"all_visitors"});
    await env.respond(1,{available:true,offer:"capability"});
    const restored=env.elements[0];
    assert.match(restored.className,/ss-iconOnly/);
    restored.onclick();assert.equal(env.elements.length,1);assert.doesNotMatch(restored.className,/ss-iconOnly/);
    restored.onclick();const panel=env.elements[1],frame=panel.children[1];
    for(const listener of env.messages)listener({origin:"https://evil.example",source:frame.contentWindow,data:{type:"sightspool:interview:ended"}});
    assert.equal(env.storage.get("sightspool-widget-session:"+key),undefined);
    for(const listener of env.messages)listener({origin:"https://www.sightspool.com",source:frame.contentWindow,data:{type:"sightspool:interview:ended"}});
    assert.equal(env.storage.get("sightspool-widget-session:"+key),"ended");
    assert.equal(restored.attributes["aria-label"],"View your accepted thank-you");
  });
});

test("reload restores an admitted session without a new offer or microphone activation",async()=>{
 await browserTest(async env=>{
  env.storage.set("sightspool-widget-session:"+key,"active");
  sdk.init({key,audience:"signed_in"});
  assert.equal(env.requests.length,0);assert.equal(env.elements.length,1);
  sdk.identify('returning-user');sdk.pause();sdk.resume();
  assert.equal(env.elements.length,1);assert.equal(env.requests.length,0);
  env.elements[0].onclick();
  const url=new URL(env.elements[1].children[1].src);
  assert.equal(new URLSearchParams(url.hash.slice(1)).get("restore"),"1");
  assert.equal(new URLSearchParams(url.hash.slice(1)).has("offer"),false);
  assert.equal(env.requests.length,0);
 });
});
