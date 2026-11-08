// The monthly spending limit on Folio AGENTS (lib/agents/limits.ts), checked
// by the runner before every model call.
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { runAgent, type AgentDefinition } from "../lib/agents/runner.ts";
import { agentSpendThisMonth, monthStart, spendingBlock } from "../lib/agents/limits.ts";
import { costMicros, SONNET } from "../lib/agents/models.ts";
import { createAgentTask, deleteUser, recordAgentRun, updateUser } from "../lib/db.ts";
import { database } from "../lib/pg.ts";
import { callTool, fakeApi, say } from "./agent-helpers.ts";
import { makeUser } from "./helpers.ts";

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  delete process.env.AGENTS_MONTHLY_LIMIT_USD;
  delete process.env.AGENTS_PAUSED;
});
afterEach(() => {
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.AGENTS_MONTHLY_LIMIT_USD;
  delete process.env.AGENTS_PAUSED;
});

const agent: AgentDefinition = {
  name: "agent_test",
  model: SONNET,
  effort: "low",
  system: "You are a test.",
  tools: [],
};
const ask = [{ role: "user" as const, content: "hello" }];

// What one fake model call costs.
const CALL = costMicros(SONNET, { inputTokens: 100, outputTokens: 20, cacheReadTokens: 0, cacheWriteTokens: 0 });

async function setUp(name = "Limits") {
  const user = await makeUser(name);
  await updateUser(user.id, (u) => {
    u.agents = { enabled: true, at: new Date().toISOString(), by: "test" };
  });
  const task = await createAgentTask({ userId: user.id, agent: "agent_test", input: {} });
  return { user, context: { userId: user.id, taskId: task.id } };
}

async function spend(userId: string, costMicros: number) {
  await recordAgentRun({
    userId,
    agent: "agent_test",
    model: SONNET,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    costMicros,
    stopReason: "end_turn",
  });
}

test("an account under its limit can run", async (t) => {
  const { context } = await setUp();
  fakeApi(t, [say("Hi")]);
  assert.deepEqual(await runAgent(agent, context, ask), { status: "done", text: "Hi" });
});

test("the default limit is fifteen dollars a month", async () => {
  const { user } = await setUp();
  assert.deepEqual(await agentSpendThisMonth(user.id), { usedMicros: 0, limitMicros: 15_000_000 });
  await spend(user.id, 14_999_999);
  assert.equal(await spendingBlock(user.id), null);
  await spend(user.id, 1);
  assert.equal(await spendingBlock(user.id), "monthly_limit");
});

test("an account at its limit makes no model call and gets over_limit", async (t) => {
  const { user, context } = await setUp();
  await spend(user.id, 15_000_000);
  const bodies = fakeApi(t, [say("never")]);
  assert.deepEqual(await runAgent(agent, context, ask), { status: "over_limit", text: "", reason: "monthly_limit" });
  assert.equal(bodies.length, 0);
});

test("a run that crosses the limit stops before its next model call", async (t) => {
  const { context } = await setUp();
  process.env.AGENTS_MONTHLY_LIMIT_USD = String(CALL / 1_000_000);
  const bodies = fakeApi(t, [callTool("missing_tool", {}), say("never")]);
  const outcome = await runAgent(agent, context, ask);
  assert.equal(outcome.status, "over_limit");
  assert.equal(outcome.reason, "monthly_limit");
  assert.equal(bodies.length, 1);
});

test("only spending in the current UTC month counts", async () => {
  const { user } = await setUp();
  await spend(user.id, 20_000_000);
  const db = await database();
  const lastMonth = new Date(monthStart().getTime() - 60_000).toISOString();
  await db.query("update agent_runs set created_at = $2 where user_id = $1", [user.id, lastMonth]);
  assert.equal(await spendingBlock(user.id), null);
  assert.equal((await agentSpendThisMonth(user.id)).usedMicros, 0);

  await db.query("update agent_runs set created_at = $2 where user_id = $1", [user.id, monthStart().toISOString()]);
  assert.equal(await spendingBlock(user.id), "monthly_limit");
});

test("the month starts at midnight UTC on the first", () => {
  assert.equal(monthStart(new Date("2026-11-30T23:59:59Z")).toISOString(), "2026-11-01T00:00:00.000Z");
  assert.equal(monthStart(new Date("2026-12-01T00:00:00Z")).toISOString(), "2026-12-01T00:00:00.000Z");
});

test("one account's spending does not count against another", async () => {
  const a = await setUp("Alice");
  const b = await setUp("Bob");
  await spend(a.user.id, 15_000_000);
  assert.equal(await spendingBlock(a.user.id), "monthly_limit");
  assert.equal(await spendingBlock(b.user.id), null);
});

test("the limit can be changed with AGENTS_MONTHLY_LIMIT_USD", async () => {
  const { user } = await setUp();
  await spend(user.id, 5_000_000);
  process.env.AGENTS_MONTHLY_LIMIT_USD = "5";
  assert.equal(await spendingBlock(user.id), "monthly_limit");
  assert.equal((await agentSpendThisMonth(user.id)).limitMicros, 5_000_000);
  process.env.AGENTS_MONTHLY_LIMIT_USD = "50";
  assert.equal(await spendingBlock(user.id), null);
});

test("a junk AGENTS_MONTHLY_LIMIT_USD uses the default", async () => {
  const { user } = await setUp();
  for (const junk of ["", "abc", "0", "-5", "NaN", "Infinity"]) {
    process.env.AGENTS_MONTHLY_LIMIT_USD = junk;
    assert.equal((await agentSpendThisMonth(user.id)).limitMicros, 15_000_000, `"${junk}" should be ignored`);
  }
});

test("turning the agents off mid-run stops it before the next model call", async (t) => {
  const { user, context } = await setUp();
  const bodies = fakeApi(t, [callTool("missing_tool", {}), say("never")], async () => {
    await updateUser(user.id, (u) => {
      u.agents = { enabled: false, at: new Date().toISOString(), by: "test" };
    });
  });
  const outcome = await runAgent(agent, context, ask);
  assert.equal(outcome.status, "over_limit");
  assert.equal(outcome.reason, "not_allowed");
  assert.equal(bodies.length, 1);
});

test("AGENTS_PAUSED=1 mid-run stops it before the next model call", async (t) => {
  const { context } = await setUp();
  const bodies = fakeApi(t, [callTool("missing_tool", {}), say("never")], async () => {
    process.env.AGENTS_PAUSED = "1";
  });
  const outcome = await runAgent(agent, context, ask);
  assert.equal(outcome.status, "over_limit");
  assert.equal(outcome.reason, "not_allowed");
  assert.equal(bodies.length, 1);
});

test("a deleted account is not allowed", async () => {
  const { user } = await setUp();
  await deleteUser(user.id);
  assert.equal(await spendingBlock(user.id), "not_allowed");
});
