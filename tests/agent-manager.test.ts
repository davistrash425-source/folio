import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { managerAgent, SPECIALISTS } from "../lib/agents/main.ts";
import { agentFor } from "../lib/agents/registry.ts";
import { runAgent } from "../lib/agents/runner.ts";
import { runQueuedTasks } from "../lib/agents/worker.ts";
import { createAgentTask, finishAgentTask, listAgentChat, listAgentTasks, listApprovals, updateUser } from "../lib/db.ts";
import { database } from "../lib/pg.ts";
import { fakeApi, say } from "./agent-helpers.ts";
import { makeUser } from "./helpers.ts";

beforeEach(async () => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  const db = await database();
  await db.query("delete from agent_tasks");
});
afterEach(() => {
  delete process.env.ANTHROPIC_API_KEY;
});

async function photographer(name = "Mina") {
  const user = await makeUser(name);
  return updateUser(user.id, (u) => {
    u.agents = { enabled: true, at: new Date().toISOString(), by: "test" };
  });
}

const specialists = { agent_x_test: "Does test things." };

function tool(name: string, list: Record<string, string> = specialists) {
  const found = managerAgent(list).tools.find((t) => t.name === name);
  assert.ok(found, `tool ${name} exists`);
  return found;
}

async function parentTask(userId: string) {
  return createAgentTask({ userId, agent: "agent_01_main", input: { prompt: "x", chat: true } });
}

test("the manager has no tool that sends, posts, books or approves", () => {
  for (const list of [{}, specialists]) {
    for (const t of managerAgent(list).tools) {
      // Tools may read, or propose; none may act, so no name starts with an action word.
      assert.doesNotMatch(t.name, /^(send|post|book|publish|approve|reject|revise|confirm|move|cancel)/);
    }
  }
  assert.deepEqual(
    managerAgent({}).tools.map((t) => t.name),
    [
      "list_recent_tasks",
      "get_task_result",
      "get_business",
      "propose_note",
      "check_availability",
      "list_bookings",
      "propose_confirm_booking",
      "propose_move_booking",
      "propose_cancel_booking",
      "list_messages",
      "draft_reply",
    ],
  );
});

test("assign_task exists only when there are specialists", () => {
  assert.equal(Object.keys(SPECIALISTS).length, 0);
  assert.ok(!managerAgent().tools.some((t) => t.name === "assign_task"));
  assert.ok(managerAgent(specialists).tools.some((t) => t.name === "assign_task"));
  assert.match(tool("assign_task").description, /agent_x_test: Does test things\./);
});

test("the manager is registered under its name", () => {
  assert.equal(agentFor("agent_01_main")?.name, "agent_01_main");
});

test("propose_note makes a pending approval and does nothing else", async () => {
  const u = await photographer();
  const task = await parentTask(u.id);
  const answer = await tool("propose_note").run({ userId: u.id, taskId: task.id }, { text: "Call the florist", summary: "Save a note" });
  assert.match(answer, /Approvals/);
  const pending = await listApprovals(u.id, "pending");
  assert.equal(pending.length, 1);
  assert.equal(pending[0].kind, "save_note");
  assert.deepEqual(pending[0].action, { text: "Call the florist" });
  assert.deepEqual(await listAgentChat(u.id), []);
  assert.equal((await listApprovals(u.id, "used")).length, 0);
});

test("propose_note refuses a note over 2000 characters", async () => {
  const u = await photographer();
  const task = await parentTask(u.id);
  await assert.rejects(async () => tool("propose_note").run({ userId: u.id, taskId: task.id }, { text: "a".repeat(2001), summary: "x" }));
  assert.equal((await listApprovals(u.id)).length, 0);
});

test("get_task_result can't see another account's task", async () => {
  const alice = await photographer("Alice");
  const bob = await photographer("Bob");
  const bobTask = await createAgentTask({ userId: bob.id, agent: "agent_x_test", input: { prompt: "p" } });
  await finishAgentTask(bob.id, bobTask.id, { status: "done", result: { text: "bob's private result" } });
  const aliceTask = await parentTask(alice.id);
  const ctx = { userId: alice.id, taskId: aliceTask.id };
  assert.equal(await tool("get_task_result").run(ctx, { id: bobTask.id }), "No such task.");
  assert.doesNotMatch(await tool("list_recent_tasks").run(ctx, {}), /bob's private result/);
});

test("get_business says so when empty and shows the saved facts otherwise", async () => {
  const u = await photographer();
  const ctx = { userId: u.id, taskId: "t" };
  assert.match(await tool("get_business").run(ctx, {}), /hasn't filled in/);
  await updateUser(u.id, (x) => {
    x.business = { rates: "Portrait EUR 250", tone: "Warm", rules: "No Sundays", updatedAt: "x" };
  });
  const text = await tool("get_business").run(ctx, {});
  assert.match(text, /Portrait EUR 250/);
  assert.match(text, /No Sundays/);
});

test("list_recent_tasks gives at most 10 tasks and 300 characters of each result", async () => {
  const u = await photographer();
  for (let i = 0; i < 12; i++) {
    const t = await createAgentTask({ userId: u.id, agent: "agent_x_test", input: { prompt: "p" } });
    await finishAgentTask(u.id, t.id, { status: "done", result: { text: "z".repeat(1000) } });
  }
  const lines = (await tool("list_recent_tasks").run({ userId: u.id, taskId: "t" }, {})).split("\n");
  assert.equal(lines.length, 10);
  assert.ok(lines.every((l) => l.length < 450));
});

test("assign_task queues a task under the current one, at most three per run", async () => {
  const u = await photographer();
  const parent = await parentTask(u.id);
  const ctx = { userId: u.id, taskId: parent.id };
  const assign = tool("assign_task");
  for (let i = 0; i < 3; i++) assert.match(await assign.run(ctx, { agent: "agent_x_test", prompt: `job ${i}` }), /Queued/);
  assert.match(await assign.run(ctx, { agent: "agent_x_test", prompt: "one too many" }), /already assigned 3/);
  const children = (await listAgentTasks(u.id)).filter((t) => t.parentTaskId === parent.id);
  assert.equal(children.length, 3);
  assert.ok(children.every((t) => t.status === "queued" && t.agent === "agent_x_test"));
});

test("assign_task rejects an agent that isn't a specialist", async () => {
  const u = await photographer();
  const parent = await parentTask(u.id);
  await assert.rejects(async () => tool("assign_task").run({ userId: u.id, taskId: parent.id }, { agent: "agent_01_main", prompt: "loop" }));
  assert.equal((await listAgentTasks(u.id)).filter((t) => t.parentTaskId === parent.id).length, 0);
});

test("a task the manager queued is run by the worker and its result can be read", async (t) => {
  const u = await photographer();
  const parent = await parentTask(u.id);
  // The parent was a live chat run; finish it so only the child is queued.
  await finishAgentTask(u.id, parent.id, { status: "done" });
  const ctx = { userId: u.id, taskId: parent.id };
  const queued = await tool("assign_task").run(ctx, { agent: "agent_x_test", prompt: "do it" });
  const id = queued.match(/task ([0-9a-f-]{36})/)![1];
  fakeApi(t, [say("The specialist is done.")]);
  const specialist = { ...managerAgent({}), name: "agent_x_test", tools: [] };
  const counts = await runQueuedTasks({ agents: (name) => (name === "agent_x_test" ? specialist : null) });
  assert.equal(counts.done, 1);
  assert.match(await tool("get_task_result").run(ctx, { id }), /Status: done\nResult: The specialist is done\./);
});

test("the manager's system text has no date and is the same on every call", async (t) => {
  const u = await photographer();
  const task = await parentTask(u.id);
  const bodies = fakeApi(t, [say("one"), say("two")]);
  const ctx = { userId: u.id, taskId: task.id };
  await runAgent(managerAgent(), ctx, [{ role: "user", content: "hi" }]);
  await runAgent(managerAgent(), ctx, [{ role: "user", content: "hi again" }]);
  assert.equal(bodies[0].system, bodies[1].system);
  assert.doesNotMatch(bodies[0].system, /\d{4}|today|January|February|March|April|May|June|July|August|September|October|November|December/i);
});
