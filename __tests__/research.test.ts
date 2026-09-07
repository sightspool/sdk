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
  const elements: any[] = [];
  const timers = new Map<number, () => void>();
  const visibility = new Set<() => void>();
  const storage = new Map<string, string>();
  const popups: string[] = [];
  let timerId = 0;
  const window: any = {
    setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout,
    setInterval(fn: () => void) { timers.set(++timerId, fn); return timerId; },
    clearInterval(id: number) { timers.delete(id); },
    open(url: string) { popups.push(url); return { closed: false, focus() {} }; },
  };
  const document: any = {
    visibilityState: "visible",
    createElement(tag: string) {
      assert.equal(tag, "button");
      const el: any = { style: {}, setAttribute() {}, remove() { const i = elements.indexOf(el); if (i >= 0) elements.splice(i, 1); } };
      return el;
    },
    body: { appendChild(el: any) { elements.push(el); } },
    addEventListener(name: string, listener: () => void) { assert.equal(name, "visibilitychange"); visibility.add(listener); },
    removeEventListener(_name: string, listener: () => void) { visibility.delete(listener); },
  };
  const fetch = (url: string, input: RequestInit) => new Promise((resolve, reject) => { requests.push({ url, input, resolve, reject }); });
  const sessionStorage = { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => storage.set(k, v) };
  const respond = async (i: number, result: unknown, ok = true) => { requests[i].resolve({ ok, json: async () => result }); await tick(); };
  return { window, document, fetch, sessionStorage, requests, elements, timers, visibility, storage, popups, respond };
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

test("one server-approved offer renders once and opens only on click with capability in fragment", async () => {
  await browserTest(async (env) => {
    sdk.init({ audience: "signed_in", key }); sdk.init({ audience: "signed_in", key }); sdk.identify("a-user"); sdk.resume();
    env.timers.forEach((fn) => fn());
    assert.equal(env.timers.size, 1); assert.equal(env.requests.length, 1);
    await env.respond(0, { available: true, offer: "signed-capability" });
    assert.equal(sdk.getStatus(), "available"); assert.equal(env.elements.length, 1); assert.equal(env.popups.length, 0);
    env.elements[0].onclick();
    const url = new URL(env.popups[0]);
    assert.equal(url.pathname, "/interview-widget"); assert.equal(url.search, "");
    assert.equal(new URLSearchParams(url.hash.slice(1)).get("offer"), "signed-capability");
    env.timers.forEach((fn) => fn());
    await env.respond(1, { available: true, offer: "new-capability" });
    assert.equal(env.elements.length, 1);
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
