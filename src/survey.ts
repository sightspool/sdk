// The intervention survey widget (Wave 0005 slice B — the client half). Renders a
// human-approved one-tap survey served by /api/sdk/serve, in a shadow root so the
// host app's CSS can't style-break it and it leaks zero styles back. Dynamically
// imported by index.ts only when the serve endpoint actually returns something, so
// it splits into its own lazily-loaded chunk and adds nothing to the host bundle
// until a survey is shown. Mirrors prompt.ts (the passive ask) deliberately.
//
//   question + [option] [option] …        (tap an option → choice)
//   + "Something else…" → free text        (only when allow_text)

export type SurveyConfig = {
  question: string;
  options?: string[];
  allow_text?: boolean;
};

export type SurveyResult = {
  choice?: string;
  text?: string;
  dismissed?: boolean;
};

const STYLE = `
:host { all: initial; }
.wrap { position: fixed; bottom: 20px; right: 20px; z-index: 2147483000;
  width: 340px; max-width: calc(100vw - 32px); font-family: system-ui, -apple-system, sans-serif; }
.card { position: relative; background: #fff; color: #18181b; border: 1px solid #e4e4e7;
  border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,.12); padding: 16px; }
.q { font-size: 14px; font-weight: 600; margin: 0 0 12px; line-height: 1.35; padding-right: 16px; }
.row { display: flex; gap: 8px; flex-wrap: wrap; }
button { font: inherit; font-size: 13px; cursor: pointer; border-radius: 8px; padding: 8px 12px;
  border: 1px solid #e4e4e7; background: #fafafa; color: #18181b; }
button:hover { background: #f4f4f5; }
button.primary { background: #18181b; color: #fff; border-color: #18181b; }
.opt { display: block; width: 100%; text-align: left; margin-bottom: 6px; }
.x { position: absolute; top: 8px; right: 10px; border: none; background: none; font-size: 16px;
  color: #a1a1aa; padding: 2px 6px; cursor: pointer; }
.done { font-size: 13px; color: #18181b; margin: 0; }
input { font: inherit; font-size: 13px; width: 100%; box-sizing: border-box; padding: 8px 10px;
  border: 1px solid #e4e4e7; border-radius: 8px; margin-bottom: 8px; }
`;

const THANKS_MS = 1100; // brief acknowledgement, then auto-close

export function showSurvey(config: SurveyConfig): Promise<SurveyResult> {
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

    // Resolve immediately (so the answer is sent without delay) but leave a short
    // "Thanks" on screen before removing the node.
    function finish(result: SurveyResult, thank: boolean) {
      if (settled) return;
      settled = true;
      resolve(result);
      if (thank) {
        thankYou();
        setTimeout(teardown, THANKS_MS);
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

    function withClose(c: HTMLElement) {
      const x = document.createElement("button");
      x.className = "x";
      x.textContent = "×";
      x.setAttribute("aria-label", "Dismiss");
      x.onclick = () => finish({ dismissed: true }, false);
      c.appendChild(x);
    }

    function question() {
      const c = card();
      withClose(c);
      const q = document.createElement("p");
      q.className = "q";
      q.textContent = config.question;
      c.appendChild(q);

      for (const opt of (config.options ?? []).slice(0, 6)) {
        const b = document.createElement("button");
        b.className = "opt";
        b.textContent = opt;
        b.onclick = () => finish({ choice: opt }, true);
        c.appendChild(b);
      }

      if (config.allow_text) {
        const se = document.createElement("button");
        se.className = "opt";
        // If there were no options, this is the only path — label it plainly.
        se.textContent = (config.options?.length ?? 0) > 0 ? "Something else…" : "Answer…";
        se.onclick = freeText;
        c.appendChild(se);
      }
    }

    function freeText() {
      const c = card();
      withClose(c);
      const q = document.createElement("p");
      q.className = "q";
      q.textContent = config.question;
      c.appendChild(q);
      const input = document.createElement("input");
      input.type = "text";
      input.placeholder = "In your own words…";
      c.appendChild(input);
      const row = document.createElement("div");
      row.className = "row";
      const send = document.createElement("button");
      send.className = "primary";
      send.textContent = "Send";
      const submit = () => {
        const text = input.value.trim();
        if (!text) {
          finish({ dismissed: true }, false);
          return;
        }
        finish({ text }, true);
      };
      send.onclick = submit;
      input.onkeydown = (e) => {
        if ((e as KeyboardEvent).key === "Enter") submit();
      };
      row.appendChild(send);
      c.appendChild(row);
      try {
        input.focus();
      } catch {
        /* swallow */
      }
    }

    function thankYou() {
      const c = card();
      const p = document.createElement("p");
      p.className = "done";
      p.textContent = "Thanks — that helps.";
      c.appendChild(p);
    }

    try {
      document.body.appendChild(host);
      question();
    } catch {
      finish({ dismissed: true }, false);
    }
  });
}
