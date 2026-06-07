import { test } from "node:test";
import assert from "node:assert/strict";
import { redactText, isSensitiveInput, MAX_LABEL_LEN } from "../src/privacy.ts";

// Redaction is the GOV-3 guard — it runs on every captured label before it leaves
// the page, so it must be conservative and never throw.

test("emails are masked", () => {
  assert.equal(redactText("contact jane.doe@acme.co please"), "contact ‹email› please");
});

test("long digit runs are masked", () => {
  assert.equal(redactText("card 4242424242424242 ok"), "card ‹num› ok");
});

test("short numbers are left alone", () => {
  assert.equal(redactText("page 42 of 100"), "page 42 of 100");
});

test("whitespace is collapsed and length clamped", () => {
  const long = "a ".repeat(400);
  const out = redactText(long);
  assert.ok(out.length <= MAX_LABEL_LEN);
  assert.ok(!out.includes("  "));
});

test("null / undefined / empty are safe", () => {
  assert.equal(redactText(null), "");
  assert.equal(redactText(undefined), "");
  assert.equal(redactText(""), "");
});

test("sensitive input types are flagged for full drop", () => {
  assert.equal(isSensitiveInput("password"), true);
  assert.equal(isSensitiveInput("EMAIL"), true);
  assert.equal(isSensitiveInput("text"), false);
  assert.equal(isSensitiveInput(null), false);
});
