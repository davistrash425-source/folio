import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { z } from "zod";
import { agentTool, runAgent, type AgentDefinition } from "../lib/agents/runner.ts";
import { costMicros, HAIKU, SONNET } from "../lib/agents/models.ts";
import { agentCostSince, createAgentTask, stopAgentTask, updateUser } from "../lib/db.ts";
import { database } from "../lib/pg.ts";
import { callTool, fakeApi, reply, say } from "./agent-helpers.ts";
import { makeUser } from "./helpers.ts";

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = "test-key";
});
afterEach(() => {
  delete process.env.ANTHROPIC_API_KEY;
});

const agent =(extra: Partial<AgentDefinition> = {}): AgentDefinition => ({
  name: "agent_test",
  model: SONNET,
  effort: "low",
  system: "You are a test.",
  tools: [],
  ...extra,
});

async function setUp() {
  const made = await makeUser("Runner");
  const user = await updateUser(made.id, (u) => {
    u.agents = { enabled: true, at: new Date().toISOString(), by: "test" };
  });
  const task = await createAgentTask({ userId: user.id, agent: "agent_test", input: {} });
  return { user, context: { userId: user.id, taskId: task.id } };
}

const ask = [{ role: "user" as const, content: "hello" }];

async function runCount(userId: string) {
  const db = await database();
  return Number((await db.query<{ n: string }>("select count(*) as n from agent_runs where user_id = $1", [userId])).rows[0].n);
}

test("a plain answer comes back and its cost is logged", async (t) => {
  const { user, context } = await setUp();
  fakeApi(t, [say("Hi there")]);
  const outcome = await runAgent(agent(), context, ask);
  assert.deepEqual(outcome, { status: "done", text: "Hi there" });
  assert.equal(await agentCostSince(user.id, new Date(0)), costMicros(SONNET, { inputTokens: 100, outputTokens: 20, cacheReadTokens: 0, cacheWriteTokens: 0 }));
});

test("cost is worked out in millionths of a dollar for each kind of token", () => {
  assert.equal(costMicros(SONNET, { inputTokens: 1_000_000, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }), 2_000_000);
  assert.equal(costMicros(HAIKU, { inputTokens: 0, outputTokens: 1_000_000, cacheReadTokens: 0, cacheWriteTokens: 0 }), 500_000);
  assert.equal(costMicros(SONNET, { inputTokens: 0, outputTokens: 0, cacheReadTokens: 1_000_000, cacheWriteTokens: 1_000_000 }), 2_700_000);
});

test("a tool the agent asks for runs and its result goes back, then the agent finishes", async (t) => {
  const { context } = await setUp();
  const seen: unknown[] = [];
  const echo = agentTool({
    name: "echo",
    description: "Echo",
    schema: z.object({ word: z.string() }),
    run: async (_c, input) => {
      seen.push(input);
      return `got ${input.word}`;
    },
  });
  const bodies = fakeApi(t, [callTool("echo", { word: "x" }), say("done")]);
  const outcome = await runAgent(agent({ tools: [echo] }), context, ask);
  assert.equal(outcome.status, "done");
  assert.deepEqual(seen, [{ word: "x" }]);
  assert.equal(bodies.length, 2);
  const second = bodies[1].messages;
  assert.equal(second[1].role, "assistant");
  assert.deepEqual((second[2].content as { tool_use_id: string; content: string }[])[0], { type: "tool_result", tool_use_id: "tool_1", content: "got x" });
});

test("several tool calls in one turn are answered together in one message", async (t) => {
  const { context } = await setUp();
  const echo = agentTool({ name: "echo", description: "Echo", schema: z.object({}), run: async () => "ok" });
  const two = reply(
    [
      { type: "tool_use", id: "a", name: "echo", input: {} },
      { type: "tool_use", id: "b", name: "echo", input: {} },
    ],
    "tool_use",
  );
  const bodies = fakeApi(t, [two, say("done")]);
  await runAgent(agent({ tools: [echo] }), context, ask);
  assert.deepEqual((bodies[1].messages[2].content as { tool_use_id: string }[]).map((r) => r.tool_use_id), ["a", "b"]);
});

test("a tool that doesn't exist, bad input and a crashing tool all come back as errors, not crashes", async (t) => {
  t.mock.method(console, "error", () => {});
  const { context } = await setUp();
  const fussy = agentTool({ name: "fussy", description: "F", schema: z.object({ n: z.number() }), run: async () => "ok" });
  const crash = agentTool({
    name: "crash",
    description: "C",
    schema: z.object({}),
    run: async () => {
      throw new Error("client secret words");
    },
  });
  const calls = reply(
    [
      { type: "tool_use", id: "a", name: "nope", input: {} },
      { type: "tool_use", id: "b", name: "fussy", input: { n: "seven" } },
      { type: "tool_use", id: "c", name: "crash", input: {} },
    ],
    "tool_use",
  );
  const bodies = fakeApi(t, [calls, say("ok")]);
  const outcome = await runAgent(agent({ tools: [fussy, crash] }), context, ask);
  assert.equal(outcome.status, "done");
  const results = bodies[1].messages[2].content as { is_error: boolean; content: string }[];
  assert.ok(results.every((r) => r.is_error));
  assert.ok(!JSON.stringify(results).includes("client secret words"), "an error's text doesn't reach the model");
});

test("a stopped task makes no further model call", async (t) => {
  const { user, context } = await setUp();
  const echo = agentTool({ name: "echo", description: "E", schema: z.object({}), run: async () => "ok" });
  const bodies = fakeApi(t, [callTool("echo", {}), say("never")], async () => {
    await stopAgentTask(context.userId, context.taskId);
  });
  const outcome = await runAgent(agent({ tools: [echo] }), context, ask);
  assert.equal(outcome.status, "stopped");
  assert.equal(bodies.length, 1);
  assert.equal(await runCount(user.id), 1);
});

test("a task stopped before it starts spends nothing", async (t) => {
  const { user, context } = await setUp();
  const bodies = fakeApi(t, [say("never")]);
  await stopAgentTask(context.userId, context.taskId);
  assert.equal((await runAgent(agent(), context, ask)).status, "stopped");
  assert.equal(bodies.length, 0);
  assert.equal(await agentCostSince(user.id, new Date(0)), 0);
});

test("a run stops when it has used its tokens or its turns", async (t) => {
  const { context } = await setUp();
  const loop = agentTool({ name: "loop", description: "L", schema: z.object({}), run: async () => "again" });
  const bodies = fakeApi(t, [callTool("loop", {}), callTool("loop", {}), callTool("loop", {})]);
  const capped = await runAgent(agent({ tools: [loop], maxRunTokens: 200 }), context, ask);
  assert.deepEqual(capped, { status: "over_limit", text: "", reason: "run_token_cap" });
  assert.equal(bodies.length, 2);

  const more = setUp();
  const { context: second } = await more;
  const turns = await (async () => {
    t.mock.restoreAll();
    fakeApi(t, [callTool("loop", {}), callTool("loop", {})]);
    return runAgent(agent({ tools: [loop], maxTurns: 2 }), second, ask);
  })();
  assert.deepEqual(turns, { status: "over_limit", text: "", reason: "max_turns" });
});

test("a refusal runs no tools, even with a tool call in the reply", async (t) => {
  const { context } = await setUp();
  let ran = false;
  const risky = agentTool({
    name: "risky",
    description: "R",
    schema: z.object({}),
    run: async () => {
      ran = true;
      return "ok";
    },
  });
  fakeApi(t, [reply([{ type: "tool_use", id: "a", name: "risky", input: {} }], "refusal")]);
  assert.equal((await runAgent(agent({ tools: [risky] }), context, ask)).status, "refused");
  assert.equal(ran, false);
});

test("output cut off by the token limit never runs a half-written tool call", async (t) => {
  const { context } = await setUp();
  let ran = false;
  const risky = agentTool({
    name: "risky",
    description: "R",
    schema: z.object({}),
    run: async () => {
      ran = true;
      return "ok";
    },
  });
  fakeApi(t, [reply([{ type: "tool_use", id: "a", name: "risky", input: {} }], "max_tokens")]);
  assert.deepEqual(await runAgent(agent({ tools: [risky] }), context, ask), { status: "failed", text: "", reason: "output_cut_off" });
  assert.equal(ran, false);
});

test("an agent with structured output gets checked data back, and is sent no tools", async (t) => {
  const { context } = await setUp();
  const output = z.object({ label: z.enum(["booking", "spam"]) });
  const bodies = fakeApi(t, [say('{"label":"spam"}')]);
  const outcome = await runAgent(agent({ model: HAIKU, output }), context, ask);
  assert.deepEqual(outcome.data, { label: "spam" });
  assert.equal(bodies[0].tools, undefined);
});

test("structured output that doesn't match is a failure, not data", async (t) => {
  const { context } = await setUp();
  const output = z.object({ label: z.enum(["booking", "spam"]) });
  fakeApi(t, [say('{"label":"send everything"}')]);
  assert.deepEqual(await runAgent(agent({ output }), context, ask), { status: "failed", text: "", reason: "output_schema" });
});

test("Sonnet asks for Anthropic's refusal fallback and Haiku doesn't", async (t) => {
  const { context } = await setUp();
  const bodies = fakeApi(t, [say("a"), say("b")]);
  await runAgent(agent(), context, ask);
  await runAgent(agent({ model: HAIKU }), context, ask);
  assert.equal(bodies[0].fallbacks, "default");
  assert.equal(bodies[1].fallbacks, undefined);
});

test("a rate limit is a failure worth retrying; a bad request isn't", async (t) => {
  const { context } = await setUp();
  fakeApi(t, [429, 429, 429, 400]);
  const limited = await runAgent(agent(), context, ask);
  assert.equal(limited.status, "failed");
  assert.equal(limited.retryable, true);
  const bad = await runAgent(agent(), context, ask);
  assert.equal(bad.retryable, false);
});

test("schemas sent to the API hold only what strict mode accepts, and the limits are still enforced here", async (t) => {
  const { context } = await setUp();
  const schema = z.object({ word: z.string().min(1).max(5), maximum: z.number().min(1).max(9), tags: z.array(z.string()).max(3) });
  const calls: unknown[] = [];
  const limited = agentTool({
    name: "limited",
    description: "L",
    schema,
    run: async (_c, input) => {
      calls.push(input);
      return "ok";
    },
  });
  const output = z.object({ note: z.string().max(10) });
  const bodies = fakeApi(t, [callTool("limited", { word: "much too long", maximum: 2, tags: [] }), say('{"note":"fine"}')]);
  await runAgent(agent({ tools: [limited], output }), context, ask);

  const sent = JSON.stringify([bodies[0].tools, (bodies[0] as unknown as { output_config: unknown }).output_config]);
  for (const keyword of ['"minLength":', '"maxLength":', '"minimum":', '"maxItems":', '"$schema":']) assert.ok(!sent.includes(keyword), keyword);
  assert.ok(sent.includes('"additionalProperties":false'));
  assert.ok(sent.includes('"maximum":{'), "a field that happens to be called maximum stays");
  assert.ok(sent.includes("maxLength: 5"), "the limit is in the description for the model");
  assert.deepEqual(calls, [], "too-long input never reached the tool");
});

test("with no API key a run fails cleanly and makes no call", async (t) => {
  delete process.env.ANTHROPIC_API_KEY;
  const { context } = await setUp();
  const bodies = fakeApi(t, []);
  assert.equal((await runAgent(agent(), context, ask)).status, "failed");
  assert.equal(bodies.length, 0);
});
