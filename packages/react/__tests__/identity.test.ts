import { test } from "node:test";
import assert from "node:assert/strict";
import { toIdentifyArgs } from "../src/identity.ts";

// The one rule worth pinning: don't identify until there's a real user id — so the
// provider/hook never attaches an anonymous or empty user.

test("returns null when there is no identity", () => {
  assert.equal(toIdentifyArgs(undefined), null);
  assert.equal(toIdentifyArgs(null), null);
});

test("returns null when there is no userId (still logged out)", () => {
  assert.equal(toIdentifyArgs({}), null);
  assert.equal(toIdentifyArgs({ account: "Vertex", plan: "growth" }), null);
});

test("maps a full identity to identify(userId, traits)", () => {
  assert.deepEqual(toIdentifyArgs({ userId: "u_1", account: "Vertex", plan: "growth" }), {
    userId: "u_1",
    traits: { account: "Vertex", plan: "growth" },
  });
});

test("carries undefined traits through (account/plan optional)", () => {
  assert.deepEqual(toIdentifyArgs({ userId: "u_2" }), {
    userId: "u_2",
    traits: { account: undefined, plan: undefined },
  });
});
