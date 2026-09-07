import { test } from "node:test";
import assert from "node:assert/strict";
import { researchUserId } from "../src/identity.ts";

test("signed-out or blank identity clears research eligibility", () => {
  for (const value of [undefined, null, {}, { userId: "" }, { userId: "  " }]) {
    assert.equal(researchUserId(value), null);
  }
});
test("real user identity is forwarded locally without enrichment", () => {
  assert.equal(researchUserId({ userId: "user-123" }), "user-123");
});
