import assert from "node:assert/strict";
import test from "node:test";
import { dmcaAgentToShow } from "@/lib/legal";

test("no DMCA agent is shown when none is set", () => {
  assert.equal(dmcaAgentToShow(null), null);
});

test("a DMCA agent with a missing address or email is not shown", () => {
  assert.equal(dmcaAgentToShow({ name: "A", address: "", email: "a@b.c" }), null);
  assert.equal(dmcaAgentToShow({ name: "A", address: "1 Main St", email: " " }), null);
});

test("a complete DMCA agent is shown", () => {
  const agent = { name: "A", address: "1 Main St", email: "a@b.c" };
  assert.equal(dmcaAgentToShow(agent), agent);
});
