// The demand-probe widget — the honest painted door, client half. Renders a
// human-approved probe served by /api/sdk/serve: a dashed-border button
// standing in for a feature that DOESN'T exist yet. Clicking is a vote; the
// card then shows the server's fixed disclosure ("this doesn't exist yet —
// your click was counted as a vote"), so the pattern is never a deceptive
// fake door. Same shadow-root + lazy-import discipline as survey.ts.
//
//   [ ⋯ dashed: {label} ⋯ ]      (click → vote → disclosure, then auto-close)

export type ProbeConfig = {
  /** The feature as the user would want it — the dashed button's copy. */
  label: string;
  /** The fixed post-vote honesty line, injected server-side. Required: the
   *  widget refuses to render without it (see normalizeServed). */
  disclosure: string;
};

export type ProbeResult = {
  voted?: boolean;
  dismissed?: boolean;
};

const STYLE = `
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

const DISCLOSURE_MS = 3200; // long enough to read the honesty line, then close

export function showProbe(config: ProbeConfig): Promise<ProbeResult> {
  return new Promise((resolve) => {
    if (typeof document === "undefined") {
      resolve({ dismissed: true });
      return;
    }

    let settled = false;
    const host = document.createElement("div");
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
    style.textContent = STYLE;
    shadow.appendChild(style);

    const wrap = document.createElement("div");
    wrap.className = "wrap";
    shadow.appendChild(wrap);

    function card(): HTMLElement {
      wrap.innerHTML = "";
      const c = document.createElement("div");
      c.className = "card";
      wrap.appendChild(c);
      return c;
    }

    function probe() {
      const c = card();
      const x = document.createElement("button");
      x.className = "x";
      x.textContent = "×";
      x.setAttribute("aria-label", "Dismiss");
      x.onclick = () => finish({ dismissed: true }, false);
      c.appendChild(x);

      const b = document.createElement("button");
      b.className = "probe";
      b.textContent = config.label;
      b.onclick = () => finish({ voted: true }, true);
      c.appendChild(b);
    }

    // The truth-telling moment — the only thing separating this from a fake
    // door. Always the server's fixed copy, shown after every vote.
    function disclosure() {
      const c = card();
      const p = document.createElement("p");
      p.className = "done";
      p.textContent = config.disclosure;
      c.appendChild(p);
    }

    try {
      document.body.appendChild(host);
      probe();
    } catch {
      finish({ dismissed: true }, false);
    }
  });
}
