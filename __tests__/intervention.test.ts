import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildServeContext,
  normalizeServed,
  pickRespondentKey,
} from "../src/intervention.ts";

// The serve/respond client contract (Wave 0005 slice B). Pure so it unit-tests
// without a DOM — the wire shape and the de-dup key are where correctness lives;
// the survey widget itself is DOM and exercised end-to-end against the app.

// ---- buildServeContext ------------------------------------------------------

test("buildServeContext includes only defined fields", () => {
  assert.deepEqual(buildServeContext("/billing", { account: "Acme", plan: "pro" }), {
    route: "/billing",
    account: "Acme",
    plan: "pro",
  });
  assert.deepEqual(buildServeContext("/x", undefined), { route: "/x" });
  assert.deepEqual(buildServeContext(undefined, {}), {});
});

test("buildServeContext trims/clamps and drops empties", () => {
  const ctx = buildServeContext("  /billing  ", { account: "  ", plan: "" });
  assert.equal(ctx.route, "/billing");
  assert.ok(!("account" in ctx));
  assert.ok(!("plan" in ctx));
});

// ---- normalizeServed (never trust the wire) --------------------------------

test("normalizeServed accepts a well-formed survey", () => {
  const s = normalizeServed({
    id: "i1",
    type: "survey",
    config: { question: "What blocked you?", options: ["A", "B"], allow_text: true },
  });
  assert.deepEqual(s, {
    id: "i1",
    type: "survey",
    config: { question: "What blocked you?", options: ["A", "B"], allow_text: true },
  });
});

test("normalizeServed rejects an un-renderable type (no widget yet)", () => {
  assert.equal(
    normalizeServed({ id: "i1", type: "micro_interview", config: { question: "Q" } }),
    null,
  );
});

test("normalizeServed rejects a missing question or junk shape", () => {
  assert.equal(normalizeServed({ id: "i1", type: "survey", config: {} }), null);
  assert.equal(normalizeServed({ id: "i1", type: "survey" }), null);
  assert.equal(normalizeServed(null), null);
  assert.equal(normalizeServed("nope"), null);
});

test("normalizeServed sanitises options (trim, de-blank, cap 6) and defaults allow_text", () => {
  const s = normalizeServed({
    id: "i1",
    type: "survey",
    config: { question: "Q", options: [" A ", "", "B", "C", "D", "E", "F", "G"] },
  });
  // ServedIntervention is a discriminated union — narrow before reading a
  // survey-only field, or the type-check gate fails while node --test (which
  // strips types) still passes.
  assert.ok(s && s.type === "survey");
  assert.deepEqual(s.config.options, ["A", "B", "C", "D", "E", "F"]);
  assert.equal(s.config.allow_text, false);
});

// ---- pickRespondentKey ------------------------------------------------------

test("pickRespondentKey prefers userId, then persisted anon, then session", () => {
  assert.equal(pickRespondentKey("user-1", "anon-x", "sess-1"), "user-1");
  assert.equal(pickRespondentKey(undefined, "anon-x", "sess-1"), "anon-x");
  assert.equal(pickRespondentKey("  ", null, "sess-1"), "sess-1");
});

// ---- demand_probe (the honest painted door — client half) ------------------

test("normalizeServed accepts a well-formed demand_probe", () => {
  const p = normalizeServed({
    id: "p1",
    type: "demand_probe",
    config: {
      label: "Want exports to CSV?",
      disclosure: "This doesn't exist yet — your click was counted as a vote.",
    },
  });
  assert.deepEqual(p, {
    id: "p1",
    type: "demand_probe",
    config: {
      label: "Want exports to CSV?",
      disclosure: "This doesn't exist yet — your click was counted as a vote.",
    },
  });
});

test("a probe without the disclosure is DROPPED — never an undisclosed fake door", () => {
  assert.equal(
    normalizeServed({
      id: "p1",
      type: "demand_probe",
      config: { label: "Want exports?" },
    }),
    null,
  );
  assert.equal(
    normalizeServed({
      id: "p1",
      type: "demand_probe",
      config: { label: "Want exports?", disclosure: "   " },
    }),
    null,
  );
});

test("a probe without a label is dropped too", () => {
  assert.equal(
    normalizeServed({
      id: "p1",
      type: "demand_probe",
      config: { disclosure: "This doesn't exist yet." },
    }),
    null,
  );
});

test("a probe slot passes through only as a bare token — never a selector", () => {
  const ok = normalizeServed({
    id: "p1",
    type: "demand_probe",
    config: { label: "L", disclosure: "D", slot: "exports-csv" },
  });
  assert.equal(ok?.type === "demand_probe" && ok.config.slot, "exports-csv");

  for (const bad of ["#app .btn", "a b", "-x", ""]) {
    const r = normalizeServed({
      id: "p1",
      type: "demand_probe",
      config: { label: "L", disclosure: "D", slot: bad },
    });
    assert.ok(r && r.type === "demand_probe" && !("slot" in r.config), `kept: ${bad}`);
  }
});
