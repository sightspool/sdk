// The demand-probe widget — the honest painted door, client half. Renders a
// human-approved probe served by /api/sdk/serve: a dashed-border button
// standing in for a feature that DOESN'T exist yet. Clicking is a vote; the
// widget then shows the server's fixed disclosure ("this doesn't exist yet —
// your click was counted as a vote"), so the pattern is never a deceptive
// fake door. Same shadow-root + lazy-import discipline as survey.ts.
//
// Two placements:
//   floating (default) — the survey-style card, bottom-right; zero integration.
//   slot — the button mounts INSIDE the client's own UI, but only where the
//     client explicitly invited it: an element carrying
//     data-sightspool-slot="<slot>". We only ever append into that anchor
//     (own host node + shadow root — no sibling injection, no layout edits);
//     if the anchor isn't on the page, we mount NOTHING and report it, so the
//     caller can restore its fatigue counters.

export type ProbeConfig = {
  /** The feature as the user would want it — the dashed button's copy. */
  label: string;
  /** The fixed post-vote honesty line, injected server-side. Required: the
   *  widget refuses to render without it (see normalizeServed). */
  disclosure: string;
  /** Optional inline anchor: mount inside [data-sightspool-slot="<slot>"]. */
  slot?: string;
};

export type ProbeResult = {
  voted?: boolean;
  dismissed?: boolean;
  /** false = the declared slot wasn't on this page, nothing rendered. */
  mounted: boolean;
};

const FLOATING_STYLE = `
:host { all: initial; }
.wrap { position: fixed; bottom: 20px; right: 20px; z-index: 2147483000;
  width: 340px; max-width: calc(100vw - 32px); font-family: system-ui, -apple-system, sans-serif; }
.card { position: relative; background: #fff; color: #18181b; border: 1px solid #e4e4e7;
  border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,.12); padding: 16px; }
.probe { font: inherit; font-size: 13px; cursor: pointer; display: block; width: 100%;
  text-align: left; border: 1px dashed #a1a1aa; border-radius: 8px; padding: 10px 12px;
  background: #fafafa; color: #3f3f46; }
.probe:hover { border-color: #18181b; color: #18181b; }
.x { position: absolute; top: 8px; right: 10px; border: none; background: none; font-size: 16px;
  color: #a1a1aa; padding: 2px 6px; cursor: pointer; }
.done { font-size: 13px; color: #18181b; margin: 0; line-height: 1.4; }
`;

// Inline: no fixed positioning, no card chrome — just the dashed affordance,
// sized by its content, so the host layout stays the host's.
const INLINE_STYLE = `
:host { all: initial; display: inline-block; max-width: 100%; }
.probe { font: inherit; font-family: system-ui, -apple-system, sans-serif; font-size: 13px;
  cursor: pointer; display: inline-block; text-align: left; border: 1px dashed #a1a1aa;
  border-radius: 8px; padding: 8px 12px; background: transparent; color: #52525b; }
.probe:hover { border-color: #18181b; color: #18181b; }
.done { font-family: system-ui, -apple-system, sans-serif; font-size: 13px; color: #52525b;
  margin: 0; line-height: 1.4; border: 1px dashed #d4d4d8; border-radius: 8px; padding: 8px 12px; }
`;

const DISCLOSURE_MS = 3200; // long enough to read the honesty line, then close

function findSlot(slot: string): Element | null {
  try {
    // The slot token is validated upstream ([a-z0-9_-]), so it's quote-safe.
    return document.querySelector(`[data-sightspool-slot="${slot}"]`);
  } catch {
    return null;
  }
}

export function showProbe(config: ProbeConfig): Promise<ProbeResult> {
  return new Promise((resolve) => {
    if (typeof document === "undefined") {
      resolve({ dismissed: true, mounted: false });
      return;
    }

    const anchor = config.slot ? findSlot(config.slot) : null;
    if (config.slot && !anchor) {
      // The client declared a placement and this page doesn't have it —
      // render nothing (never fall back to floating: the probe shows where
      // the client intended, or nowhere).
      resolve({ mounted: false });
      return;
    }

    let settled = false;
    const inline = !!anchor;
    const host = document.createElement(inline ? "span" : "div");
    const shadow = host.attachShadow({ mode: "open" });

    function teardown() {
      try {
        host.remove();
      } catch {
        /* swallow */
      }
    }

    function finish(result: ProbeResult, disclose: boolean) {
      if (settled) return;
      settled = true;
      resolve(result);
      if (disclose) {
        disclosure();
        setTimeout(teardown, DISCLOSURE_MS);
      } else {
        teardown();
      }
    }

    const style = document.createElement("style");
    style.textContent = inline ? INLINE_STYLE : FLOATING_STYLE;
    shadow.appendChild(style);

    const wrap = document.createElement(inline ? "span" : "div");
    if (!inline) wrap.className = "wrap";
    shadow.appendChild(wrap);

    function container(): HTMLElement {
      wrap.innerHTML = "";
      if (inline) return wrap as HTMLElement;
      const c = document.createElement("div");
      c.className = "card";
      wrap.appendChild(c);
      return c;
    }

    function probe() {
      const c = container();
      if (!inline) {
        const x = document.createElement("button");
        x.className = "x";
        x.textContent = "×";
        x.setAttribute("aria-label", "Dismiss");
        x.onclick = () => finish({ dismissed: true, mounted: true }, false);
        c.appendChild(x);
      }
      const b = document.createElement("button");
      b.className = "probe";
      b.textContent = config.label;
      b.onclick = () => finish({ voted: true, mounted: true }, true);
      c.appendChild(b);
    }

    // The truth-telling moment — the only thing separating this from a fake
    // door. Always the server's fixed copy, shown after every vote.
    function disclosure() {
      const c = container();
      const p = document.createElement("p");
      p.className = "done";
      p.textContent = config.disclosure;
      c.appendChild(p);
    }

    try {
      (anchor ?? document.body).appendChild(host);
      probe();
    } catch {
      finish({ dismissed: true, mounted: false }, false);
    }
  });
}
