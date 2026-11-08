// What happens to agent data over its life: duplicates, outcomes, what the
// photographer is shown, the export, and leftovers after an account is deleted.
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { GET as exportAccount } from "../app/api/export/route.ts";
import { POST as chatRoute } from "../app/api/agents/chat/route.ts";
import { approveAction, describeApproval, proposeAction } from "../lib/agents/approvals.ts";
import { costMicros } from "../lib/agents/models.ts";
import { runAgent } from "../lib/agents/runner.ts";
import {
  addAgentChatMessage,
  createAgentTask,
  deleteOrphanedAgentRows,
  deleteUser,
  findAgentTask,
  findApproval,
  listAgentChat,
  listApprovals,
  stopAgentTask,
  updateUser,
} from "../lib/db.ts";
import { database } from "../lib/pg.ts";
import { callTool, fakeApi, reply, say } from "./agent-helpers.ts";
import { makeUser, postJson, readZip, resetRequest, signInAs } from "./helpers.ts";

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = "test-key";
});
afterEach(() => {
  delete process.env.ANTHROPIC_API_KEY;
  resetRequest();
});

async function photographer(name = "Alice") {
  const user = await makeUser(name);
  return updateUser(user.id, (u) => {
    u.agents = { enabled: true, at: new Date().toISOString(), by: "staff@example.com" };
  });
}

const note = (userId: string, taskId?: string, text = "same words") =>
  proposeAction({ userId, taskId, kind: "save_note", summary: "x", action: { text } });

test("a retried task proposing the same thing doesn't make a second request", async () => {
  const alice = await photographer();
  const task = await createAgentTask({ userId: alice.id, agent: "a", input: {} });
  const first = await note(alice.id, task.id);
  const second = await note(alice.id, task.id);
  assert.equal(second.id, first.id);
  assert.equal((await listApprovals(alice.id, "pending")).length, 1);
});

test("the same words from a different task are a separate request", async () => {
  const alice = await photographer();
  const one = await createAgentTask({ userId: alice.id, agent: "a", input: {} });
  const two = await createAgentTask({ userId: alice.id, agent: "a", input: {} });
  assert.notEqual((await note(alice.id, one.id)).id, (await note(alice.id, two.id)).id);
});

test("what the photographer approves comes from the action, whatever the agent's summary says", async () => {
  const alice = await photographer();
  const approval = await proposeAction({ userId: alice.id, kind: "save_note", summary: "Harmless, nothing to see", action: { text: "the real words" } });
  const shown = describeApproval(approval);
  assert.ok(shown.includes("the real words"));
  assert.ok(!shown.includes("Harmless"));
});

test("an approval records whether it worked", async (t) => {
  t.mock.method(console, "error", () => {});
  const alice = await photographer();
  await signInAs(alice);
  const good = await note(alice.id, undefined, "works");
  await approveAction(good.id);
  assert.equal((await findApproval(alice.id, good.id))?.outcome, "done");

  const bad = await note(alice.id, undefined, "fails");
  const db = await database();
  await db.exec("alter table agent_chat rename to agent_chat_away");
  try {
    await approveAction(bad.id);
  } finally {
    await db.exec("alter table agent_chat_away rename to agent_chat");
  }
  assert.equal((await findApproval(alice.id, bad.id))?.outcome, "failed");
});

test("a blank reply from the model is a failure and is never saved to the chat", async (t) => {
  const alice = await photographer();
  await signInAs(alice);
  fakeApi(t, [reply([], "end_turn")]);
  const res = await postJson(chatRoute, { text: "hello" });
  assert.ok((await res.text()).includes('"error"'));
  assert.deepEqual((await listAgentChat(alice.id)).map((m) => m.role), ["user"]);
});

test("a blank message already in the history isn't sent back to the model", async (t) => {
  const alice = await photographer();
  await addAgentChatMessage({ userId: alice.id, role: "user", text: "first" });
  await addAgentChatMessage({ userId: alice.id, role: "assistant", text: "" });
  await signInAs(alice);
  const bodies = fakeApi(t, [say("ok")]);
  await (await postJson(chatRoute, { text: "second" })).text();
  assert.ok(bodies[0].messages.every((m) => m.content !== ""));
});

test("each chat turn is sent the same way every time, so the cache can reuse it", async (t) => {
  const alice = await photographer();
  await signInAs(alice);
  const bodies = fakeApi(t, [say("one"), say("two")]);
  await (await postJson(chatRoute, { text: "first" })).text();
  await (await postJson(chatRoute, { text: "second" })).text();
  assert.deepEqual(bodies[1].messages[0], bodies[0].messages[0]);
  assert.equal(bodies[1].messages.at(-1)?.role, "user");
});

test("no new model call starts after a run's deadline", async (t) => {
  const alice = await photographer();
  const task = await createAgentTask({ userId: alice.id, agent: "a", input: {} });
  const bodies = fakeApi(t, [say("never")]);
  const agent = { name: "a", model: "claude-sonnet-5-5", effort: "low" as const, system: "s", tools: [] };
  const outcome = await runAgent(agent, { userId: alice.id, taskId: task.id }, [{ role: "user", content: "x" }], undefined, Date.now() - 1);
  assert.deepEqual(outcome, { status: "over_limit", text: "", reason: "out_of_time" });
  assert.equal(bodies.length, 0);
});

test("a stop pressed during a model call also stops the tools that call asked for", async (t) => {
  const alice = await photographer();
  const task = await createAgentTask({ userId: alice.id, agent: "a", input: {} });
  let ran = false;
  fakeApi(t, [callTool("act", {})], async () => {
    await stopAgentTask(alice.id, task.id);
  });
  const { z } = await import("zod");
  const { agentTool } = await import("../lib/agents/runner.ts");
  const act = agentTool({
    name: "act",
    description: "A",
    schema: z.object({}),
    run: async () => {
      ran = true;
      return "ok";
    },
  });
  const agent = { name: "a", model: "claude-sonnet-5-5", effort: "low" as const, system: "s", tools: [act] };
  assert.equal((await runAgent(agent, { userId: alice.id, taskId: task.id }, [{ role: "user", content: "x" }])).status, "stopped");
  assert.equal(ran, false);
  assert.equal((await findAgentTask(alice.id, task.id))?.status, "stopped");
});

test("a model that isn't in the price list is charged at the highest fallback price", () => {
  assert.equal(costMicros("claude-opus-4-8", { inputTokens: 1_000_000, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }), 5_000_000);
});

test("the export holds the agent chat, tasks and approvals, but not which staff member switched them on", async () => {
  const alice = await photographer();
  await addAgentChatMessage({ userId: alice.id, role: "user", text: "my own words" });
  await createAgentTask({ userId: alice.id, agent: "a", input: { prompt: "a task" } });
  await note(alice.id, undefined, "my note");
  await signInAs(alice);
  const files = readZip(Buffer.from(await (await exportAccount()).arrayBuffer()));
  const agents = files.get("agents.json")!.toString();
  for (const words of ["my own words", "a task", "my note"]) assert.ok(agents.includes(words), words);
  assert.ok(!files.get("account.json")!.toString().includes("staff@example.com"));
});

test("rows written after an account is deleted are swept up, and other accounts' stay", async () => {
  const alice = await photographer();
  const bob = await photographer("Bobby");
  await addAgentChatMessage({ userId: bob.id, role: "user", text: "bob stays" });
  await deleteUser(alice.id);
  await addAgentChatMessage({ userId: alice.id, role: "assistant", text: "arrived too late" });
  assert.equal(await deleteOrphanedAgentRows(), 1);
  assert.equal((await listAgentChat(alice.id)).length, 0);
  assert.equal((await listAgentChat(bob.id)).length, 1);
});
