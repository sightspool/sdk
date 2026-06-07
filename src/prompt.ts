// The prompt UI (FR-5/6, the §16.2 blend) — rendered in a shadow root so the host
// app's CSS can't style-break it and it leaks zero styles back. This module is
// dynamically imported by index.ts only when a trigger fires, so it splits into a
// lazily-loaded chunk and adds nothing to the host bundle until needed.
//
//   State A — "Were you able to do what you came here to do today?" [Yes][Not really]
//   State B — (after "Not really") top candidate goals + an always-present
//             "Something else" → optional free text only after that.

import type { SignalAnswer } from "./types";
import { ATTACH_DISCLOSURE } from "./privacy";

export type PromptResult = {
  answer: SignalAnswer;
  intent?: string; // a tapped candidate
  verbatim?: string; // free text from "Something else"
};

export type PromptOptions = {
  /** Locally-derived candidate goals (FR-5 State B). May be empty → generic ask. */
  candidates: string[];
};

const STYLE = `
:host { all: initial; }
.wrap { position: fixed; bottom: 20px; right: 20px; z-index: 2147483000;
  width: 320px; max-width: calc(100vw - 32px); font-family: system-ui, -apple-system, sans-serif; }
.card { background: #fff; color: #18181b; border: 1px solid #e4e4e7; border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0,0,0,.12); padding: 16px; }
.q { font-size: 14px; font-weight: 600; margin: 0 0 12px; line-height: 1.35; }
.row { display: flex; gap: 8px; flex-wrap: wrap; }
button { font: inherit; font-size: 13px; cursor: pointer; border-radius: 8px; padding: 8px 12px;
  border: 1px solid #e4e4e7; background: #fafafa; color: #18181b; }
button:hover { background: #f4f4f5; }
button.primary { background: #18181b; color: #fff; border-color: #18181b; }
.cand { display: block; width: 100%; text-align: left; margin-bottom: 6px; }
.disc { font-size: 11px; color: #71717a; margin: 12px 0 0; }
.x { position: absolute; top: 8px; right: 10px; border: none; background: none; font-size: 16px;
  color: #a1a1aa; padding: 2px 6px; }
input { font: inherit; font-size: 13px; width: 100%; box-sizing: border-box; padding: 8px 10px;
  border: 1px solid #e4e4e7; border-radius: 8px; margin-bottom: 8px; }
`;

export function showPrompt(opts: PromptOptions): Promise<PromptResult> {
  return new Promise((resolve) => {
    if (typeof document === "undefined") {
      resolve({ answer: "dismissed" });
      return;
    }

    let settled = false;
    const host = document.createElement("div");
    const shadow = host.attachShadow({ mode: "open" });

    function finish(result: PromptResult) {
      if (settled) return;
      settled = true;
      try {
        host.remove();
      } catch {
        /* swallow */
      }
      resolve(result);
    }

    const style = document.createElement("style");
    style.textContent = STYLE;
    shadow.appendChild(style);

    const wrap = document.createElement("div");
    wrap.className = "wrap";
    shadow.appendChild(wrap);

    function render(node: HTMLElement) {
      wrap.innerHTML = "";
      const card = document.createElement("div");
      card.className = "card";
      card.style.position = "relative";
      const x = document.createElement("button");
      x.className = "x";
      x.textContent = "×";
      x.setAttribute("aria-label", "Dismiss");
      x.onclick = () => finish({ answer: "dismissed" });
      card.appendChild(x);
      card.appendChild(node);
      const disc = document.createElement("p");
      disc.className = "disc";
      disc.textContent = ATTACH_DISCLOSURE;
      card.appendChild(disc);
      wrap.appendChild(card);
    }

    // --- State A ---
    function stateA() {
      const node = document.createElement("div");
      const q = document.createElement("p");
      q.className = "q";
      q.textContent = "Were you able to do what you came here to do today?";
      node.appendChild(q);
      const row = document.createElement("div");
      row.className = "row";
      const yes = document.createElement("button");
      yes.className = "primary";
      yes.textContent = "Yes";
      yes.onclick = () => finish({ answer: "yes" });
      const no = document.createElement("button");
      no.textContent = "Not really";
      no.onclick = () => stateB();
      row.append(yes, no);
      node.appendChild(row);
      render(node);
    }

    // --- State B ---
    function stateB() {
      const node = document.createElement("div");
      const q = document.createElement("p");
      q.className = "q";
      q.textContent = "What were you trying to do?";
      node.appendChild(q);
      for (const c of opts.candidates.slice(0, 4)) {
        const b = document.createElement("button");
        b.className = "cand";
        b.textContent = c;
        b.onclick = () => finish({ answer: "not_really", intent: c });
        node.appendChild(b);
      }
      const se = document.createElement("button");
      se.className = "cand";
      se.textContent = "Something else…";
      se.onclick = () => stateText();
      node.appendChild(se);
      render(node);
    }

    // --- "Something else" free text ---
    function stateText() {
      const node = document.createElement("div");
      const q = document.createElement("p");
      q.className = "q";
      q.textContent = "What were you trying to do?";
      node.appendChild(q);
      const input = document.createElement("input");
      input.type = "text";
      input.placeholder = "In your own words…";
      node.appendChild(input);
      const row = document.createElement("div");
      row.className = "row";
      const submit = document.createElement("button");
      submit.className = "primary";
      submit.textContent = "Send";
      submit.onclick = () =>
        finish({ answer: "not_really", verbatim: input.value.trim() || undefined });
      row.appendChild(submit);
      node.appendChild(row);
      render(node);
      try {
        input.focus();
      } catch {
        /* swallow */
      }
    }

    try {
      document.body.appendChild(host);
      stateA();
    } catch {
      finish({ answer: "dismissed" });
    }
  });
}
