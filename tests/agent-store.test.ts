import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addAgentChatMessage,
  agentCostSince,
  createAgentTask,
  createApproval,
  deleteUser,
  finishAgentTask,
  findAgentTask,
  findApproval,
  isAgentTaskStopped,
  listAgentChat,
  listAgentTasks,
  listApprovals,
  recordAgentRun,
  stopAgentTask,
  updateUser,
} from "../lib/db.ts";
import { database } from "../lib/pg.ts";
import { makeUser } from "./helpers.ts";

const run = (userId: string, costMicros: number, taskId?: string) =>
  recordAgentRun({
    userId,
    taskId,
    agent: "editor",
    model: "test-model",
    inputTokens: 10,
    outputTokens: 5,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    costMicros,
    stopReason: "end_turn",
  });

// Puts something in each of the four tables for this account.
async function fillAgentTables(userId: string) {
  const task = await createAgentTask({ userId, agent: "editor", input: { goal: "x" } });
  await createApproval({ userId, taskId: task.id, kind: "publish", summary: "s", action: { a: 1 }, actionHash: "h" });
  await run(userId, 100, task.id);
  await addAgentChatMessage({ userId, role: "user", text: "hi" });
}

async function countAgentRows(userId: string) {
  const db = await database();
  const counts: number[] = [];
  for (const table of ["agent_tasks", "approvals", "agent_runs", "agent_chat"]) {
    const { rows } = await db.query<{ n: string }>(`select count(*) as n from ${table} where user_id = $1`, [userId]);
    counts.push(Number(rows[0].n));
  }
  return counts;
}

test("a new agent task is queued, and comes back from find with its jsonb intact", async () => {
  const user = await makeUser("Agent");
  const input = { goal: "reorder", nested: { ids: [1, 2, 3], ok: true } };
  const task = await createAgentTask({ userId: user.id, agent: "editor", input });
  assert.equal(task.status, "queued");
  assert.equal(task.attempts, 0);
  assert.equal(task.parentTaskId, null);
  assert.equal(task.result, null);
  assert.equal(task.finishedAt, null);
  assert.ok(!Number.isNaN(Date.parse(task.createdAt)));

  const found = await findAgentTask(user.id, task.id);
  assert.deepEqual(found, task);
  assert.deepEqual(found?.input, input);

  const child = await createAgentTask({ userId: user.id, agent: "writer", input: {}, parentTaskId: task.id });
  assert.equal((await findAgentTask(user.id, child.id))?.parentTaskId, task.id);
});

test("tasks are listed newest first, up to the limit", async () => {
  const user = await makeUser("Agent");
  const first = await createAgentTask({ userId: user.id, agent: "a", input: 1 });
  await new Promise((r) => setTimeout(r, 5));
  const second = await createAgentTask({ userId: user.id, agent: "a", input: 2 });
  assert.deepEqual((await listAgentTasks(user.id)).map((t) => t.id), [second.id, first.id]);
  assert.deepEqual((await listAgentTasks(user.id, 1)).map((t) => t.id), [second.id]);
});

test("one account cannot find, list, finish or stop another account's task", async () => {
  const alice = await makeUser("Agent");
  const bob = await makeUser("Agent");
  const task = await createAgentTask({ userId: alice.id, agent: "editor", input: {} });

  assert.equal(await findAgentTask(bob.id, task.id), null);
  assert.deepEqual(await listAgentTasks(bob.id), []);
  assert.equal(await finishAgentTask(bob.id, task.id, { status: "done", result: { x: 1 } }), false);
  assert.equal(await stopAgentTask(bob.id, task.id), false);
  assert.equal(await isAgentTaskStopped(bob.id, task.id), false);

  const still = await findAgentTask(alice.id, task.id);
  assert.equal(still?.status, "queued");
  assert.equal(still?.finishedAt, null);
});

test("finishing a task saves its result or error and the time it ended", async () => {
  const user = await makeUser("Agent");
  const ok = await createAgentTask({ userId: user.id, agent: "editor", input: {} });
  assert.equal(await finishAgentTask(user.id, ok.id, { status: "done", result: { photos: [1, 2] } }), true);
  const done = await findAgentTask(user.id, ok.id);
  assert.equal(done?.status, "done");
  assert.deepEqual(done?.result, { photos: [1, 2] });
  assert.ok(done?.finishedAt);

  const bad = await createAgentTask({ userId: user.id, agent: "editor", input: {} });
  assert.equal(await finishAgentTask(user.id, bad.id, { status: "failed", error: "boom" }), true);
  const failed = await findAgentTask(user.id, bad.id);
  assert.equal(failed?.status, "failed");
  assert.equal(failed?.error, "boom");
});

test("only a queued or running task can be finished, so a task finishes once", async () => {
  const user = await makeUser("Agent");
  const task = await createAgentTask({ userId: user.id, agent: "editor", input: {} });
  assert.equal(await finishAgentTask(user.id, task.id, { status: "done", result: "first" }), true);
  assert.equal(await finishAgentTask(user.id, task.id, { status: "failed", error: "late" }), false);
  const after = await findAgentTask(user.id, task.id);
  assert.equal(after?.status, "done");
  assert.equal(after?.result, "first");
  assert.equal(await stopAgentTask(user.id, task.id), false);

  // A running task can be finished too.
  const running = await createAgentTask({ userId: user.id, agent: "editor", input: {} });
  const db = await database();
  await db.query("update agent_tasks set status = 'running', claimed_at = now() where id = $1", [running.id]);
  assert.equal(await finishAgentTask(user.id, running.id, { status: "done" }), true);
});

test("a stopped task stays stopped when the agent tries to finish it", async () => {
  const user = await makeUser("Agent");
  const task = await createAgentTask({ userId: user.id, agent: "editor", input: {} });
  assert.equal(await isAgentTaskStopped(user.id, task.id), false);
  assert.equal(await stopAgentTask(user.id, task.id), true);
  assert.equal(await isAgentTaskStopped(user.id, task.id), true);
  assert.equal(await stopAgentTask(user.id, task.id), false);

  assert.equal(await finishAgentTask(user.id, task.id, { status: "done", result: {} }), false);
  const after = await findAgentTask(user.id, task.id);
  assert.equal(after?.status, "stopped");
  assert.ok(after?.finishedAt);
});

test("a running task can be stopped", async () => {
  const user = await makeUser("Agent");
  const task = await createAgentTask({ userId: user.id, agent: "editor", input: {} });
  const db = await database();
  await db.query("update agent_tasks set status = 'running' where id = $1", [task.id]);
  assert.equal(await stopAgentTask(user.id, task.id), true);
  assert.equal((await findAgentTask(user.id, task.id))?.status, "stopped");
});

test("an approval starts pending and round-trips its action", async () => {
  const user = await makeUser("Agent");
  const task = await createAgentTask({ userId: user.id, agent: "editor", input: {} });
  const action = { type: "publish", pages: ["home", "about"] };
  const approval = await createApproval({
    userId: user.id,
    taskId: task.id,
    kind: "publish",
    summary: "Publish the site",
    action,
    actionHash: "abc123",
  });
  assert.equal(approval.status, "pending");
  assert.equal(approval.decidedAt, null);
  assert.equal(approval.usedAt, null);
  assert.deepEqual(await findApproval(user.id, approval.id), approval);
  assert.deepEqual(approval.action, action);
  assert.equal(approval.actionHash, "abc123");
});

test("one account cannot find or list another account's approvals", async () => {
  const alice = await makeUser("Agent");
  const bob = await makeUser("Agent");
  const approval = await createApproval({
    userId: alice.id,
    kind: "publish",
    summary: "s",
    action: {},
    actionHash: "h",
  });
  assert.equal(await findApproval(bob.id, approval.id), null);
  assert.deepEqual(await listApprovals(bob.id), []);
  assert.deepEqual(await listApprovals(bob.id, "pending"), []);
  assert.equal((await listApprovals(alice.id)).length, 1);
});

test("approvals can be listed by status, newest first", async () => {
  const user = await makeUser("Agent");
  const one = await createApproval({ userId: user.id, kind: "k", summary: "one", action: {}, actionHash: "1" });
  await new Promise((r) => setTimeout(r, 5));
  const two = await createApproval({ userId: user.id, kind: "k", summary: "two", action: {}, actionHash: "2" });
  const db = await database();
  await db.query("update approvals set status = 'rejected' where id = $1", [one.id]);

  assert.deepEqual((await listApprovals(user.id)).map((a) => a.id), [two.id, one.id]);
  assert.deepEqual((await listApprovals(user.id, "pending")).map((a) => a.id), [two.id]);
  assert.deepEqual((await listApprovals(user.id, "rejected")).map((a) => a.id), [one.id]);
  assert.deepEqual(await listApprovals(user.id, "used"), []);
  assert.equal((await listApprovals(user.id, undefined, 1)).length, 1);
});

test("agent cost adds up only this account's runs since the date", async () => {
  const alice = await makeUser("Agent");
  const bob = await makeUser("Agent");
  const old = await run(alice.id, 7_000_000_000);
  const db = await database();
  await db.query("update agent_runs set created_at = now() - interval '10 days' where id = $1", [old.id]);

  // Each is too big for a 32-bit integer, and so is their sum.
  await run(alice.id, 5_000_000_000);
  await run(alice.id, 5_000_000_001);
  await run(bob.id, 3_000_000_000);

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  assert.equal(await agentCostSince(alice.id, since), 10_000_000_001);
  assert.equal(await agentCostSince(bob.id, since), 3_000_000_000);
  assert.equal(await agentCostSince(alice.id, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)), 17_000_000_001);
  assert.equal(typeof (await agentCostSince(alice.id, since)), "number");
});

test("agent cost is zero when there are no runs", async () => {
  const user = await makeUser("Agent");
  assert.equal(await agentCostSince(user.id, new Date(0)), 0);
  await run(user.id, 50);
  assert.equal(await agentCostSince(user.id, new Date(Date.now() + 60_000)), 0);
});

test("a recorded run keeps its token counts and stop reason", async () => {
  const user = await makeUser("Agent");
  const saved = await recordAgentRun({
    userId: user.id,
    agent: "editor",
    model: "m",
    inputTokens: 1,
    outputTokens: 2,
    cacheReadTokens: 3,
    cacheWriteTokens: 4,
    costMicros: 5,
    stopReason: "tool_use",
  });
  assert.deepEqual(
    [saved.inputTokens, saved.outputTokens, saved.cacheReadTokens, saved.cacheWriteTokens, saved.costMicros],
    [1, 2, 3, 4, 5],
  );
  assert.equal(saved.stopReason, "tool_use");
  assert.equal(saved.taskId, null);
});

test("chat shows the newest messages oldest first, and only the account's own", async () => {
  const alice = await makeUser("Agent");
  const bob = await makeUser("Agent");
  for (const text of ["one", "two", "three"]) {
    await addAgentChatMessage({ userId: alice.id, role: text === "two" ? "assistant" : "user", text });
    await new Promise((r) => setTimeout(r, 5));
  }
  await addAgentChatMessage({ userId: bob.id, role: "user", text: "private" });

  assert.deepEqual((await listAgentChat(alice.id)).map((m) => m.text), ["one", "two", "three"]);
  assert.deepEqual((await listAgentChat(alice.id, 2)).map((m) => m.text), ["two", "three"]);
  assert.deepEqual((await listAgentChat(bob.id)).map((m) => m.text), ["private"]);
});

test("deleting an account removes its rows in all four agent tables and no one else's", async () => {
  const alice = await makeUser("Agent");
  const bob = await makeUser("Agent");
  await fillAgentTables(alice.id);
  await fillAgentTables(bob.id);
  assert.deepEqual(await countAgentRows(alice.id), [1, 1, 1, 1]);

  await deleteUser(alice.id);
  assert.deepEqual(await countAgentRows(alice.id), [0, 0, 0, 0]);
  assert.deepEqual(await countAgentRows(bob.id), [1, 1, 1, 1]);
});

test("an account on legal hold keeps its agent rows, and deleting it throws LEGAL_HOLD", async () => {
  const user = await makeUser("Agent");
  await fillAgentTables(user.id);
  await updateUser(user.id, (u) => (u.legalHold = { at: new Date().toISOString(), note: "case" }));

  await assert.rejects(deleteUser(user.id), /LEGAL_HOLD/);
  assert.deepEqual(await countAgentRows(user.id), [1, 1, 1, 1]);
});
