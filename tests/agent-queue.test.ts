import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { GET as agentsCron } from "../app/api/cron/agents/route.ts";
import { agentFor } from "../lib/agents/registry.ts";
import { SONNET } from "../lib/agents/models.ts";
import type { AgentDefinition } from "../lib/agents/runner.ts";
import { runQueuedTasks } from "../lib/agents/worker.ts";
import {
  claimAgentTask,
  claimNextAgentTask,
  createAgentTask,
  findAgentTask,
  recoverStuckAgentTasks,
  requeueAgentTask,
  stopAgentTask,
  updateUser,
} from "../lib/db.ts";
import { database } from "../lib/pg.ts";
import { fakeApi, say } from "./agent-helpers.ts";
import { makeUser } from "./helpers.ts";

beforeEach(async () => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  // Each test starts with an empty queue.
  const db = await database();
  await db.query("delete from agent_tasks");
});
afterEach(() => {
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.AGENTS_PAUSED;
  delete process.env.CRON_SECRET;
});

const testAgent: AgentDefinition = { name: "agent_test", model: SONNET, effort: "low", system: "You are a test.", tools: [] };
const agents = (name: string) => (name === "agent_test" ? testAgent : null);

async function agentUser(name = "Queue") {
  const user = await makeUser(name);
  return updateUser(user.id, (u) => {
    u.agents = { enabled: true, at: "x", by: "x" };
  });
}

const queue = (userId: string, input: unknown = { prompt: "hello" }, agent = "agent_test") =>
  createAgentTask({ userId, agent, input });

async function setColumns(id: string, sql: string, params: unknown[] = []) {
  const db = await database();
  await db.query(`update agent_tasks set ${sql} where id = $1`, [id, ...params]);
}

const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000);

test("the oldest queued task is taken first", async () => {
  const u = await agentUser();
  const first = await queue(u.id);
  await queue(u.id);
  const claimed = await claimNextAgentTask();
  assert.equal(claimed?.id, first.id);
  assert.equal(claimed?.status, "running");
  assert.equal(claimed?.attempts, 1);
  assert.ok(claimed?.claimedAt);
});

test("nothing is claimed when the queue is empty", async () => {
  assert.equal(await claimNextAgentTask(), null);
});

test("two claims at once never get the same task", async () => {
  const u = await agentUser();
  await queue(u.id);
  await queue(u.id);
  const [a, b, c] = await Promise.all([claimNextAgentTask(), claimNextAgentTask(), claimNextAgentTask()]);
  const ids = [a, b, c].filter(Boolean).map((x) => x!.id);
  assert.equal(ids.length, 2);
  assert.equal(new Set(ids).size, 2);
});

test("a task claimed by chat is not claimed again", async () => {
  const u = await agentUser();
  const task = await queue(u.id);
  assert.equal(await claimAgentTask(u.id, task.id), true);
  assert.equal(await claimAgentTask(u.id, task.id), false);
  assert.equal(await claimNextAgentTask(), null);
});

test("chat cannot claim another account's task", async () => {
  const u = await agentUser();
  const other = await agentUser("Other");
  const task = await queue(u.id);
  assert.equal(await claimAgentTask(other.id, task.id), false);
  assert.equal((await findAgentTask(u.id, task.id))?.status, "queued");
});

test("a requeued task is not picked before its time", async () => {
  const u = await agentUser();
  const task = await queue(u.id);
  await claimNextAgentTask();
  assert.equal(await requeueAgentTask(u.id, task.id, new Date(Date.now() + 60_000)), true);
  assert.equal(await claimNextAgentTask(), null);
  await setColumns(task.id, "claimed_at = $2", [minutesAgo(1)]);
  assert.equal((await claimNextAgentTask())?.id, task.id);
});

test("a stuck task returns to the queue and is failed after three attempts", async () => {
  const u = await agentUser();
  const task = await queue(u.id);
  await claimNextAgentTask();
  // Claimed just now: not stuck yet.
  assert.equal(await recoverStuckAgentTasks(minutesAgo(10), 3), 0);
  await setColumns(task.id, "claimed_at = $2", [minutesAgo(11)]);
  assert.equal(await recoverStuckAgentTasks(minutesAgo(10), 3), 1);
  assert.equal((await findAgentTask(u.id, task.id))?.status, "queued");

  await claimNextAgentTask();
  await setColumns(task.id, "claimed_at = $2", [minutesAgo(11)]);
  assert.equal(await recoverStuckAgentTasks(minutesAgo(10), 3), 1);
  await claimNextAgentTask();
  await setColumns(task.id, "claimed_at = $2", [minutesAgo(11)]);
  assert.equal(await recoverStuckAgentTasks(minutesAgo(10), 3), 1);
  const after = await findAgentTask(u.id, task.id);
  assert.equal(after?.status, "failed");
  assert.equal(after?.error, "stuck");
  assert.equal(after?.attempts, 3);
});

test("the worker recovers stuck tasks before running", async (t) => {
  const u = await agentUser();
  const task = await queue(u.id);
  await claimNextAgentTask();
  await setColumns(task.id, "claimed_at = $2", [minutesAgo(11)]);
  fakeApi(t, [say("ok")]);
  const counts = await runQueuedTasks({ agents });
  assert.equal(counts.recovered, 1);
  assert.equal(counts.done, 1);
});

test("a finished task saves its answer", async (t) => {
  const u = await agentUser();
  const task = await queue(u.id);
  fakeApi(t, [say("All done")]);
  const counts = await runQueuedTasks({ agents });
  assert.equal(counts.done, 1);
  const after = await findAgentTask(u.id, task.id);
  assert.equal(after?.status, "done");
  assert.deepEqual(after?.result, { text: "All done" });
});

test("the worker stops at the task limit", async (t) => {
  const u = await agentUser();
  for (let i = 0; i < 3; i++) await queue(u.id);
  fakeApi(t, [say("a"), say("b"), say("c")]);
  const counts = await runQueuedTasks({ agents, maxTasks: 2 });
  assert.equal(counts.done, 2);
  assert.ok(await claimNextAgentTask());
});

test("a failure worth retrying comes back later and gives up after three tries", async (t) => {
  const u = await agentUser();
  const task = await queue(u.id);
  // The Anthropic client retries a 429 twice itself, so one run uses three.
  fakeApi(t, [429, 429, 429]);
  const first = await runQueuedTasks({ agents });
  assert.equal(first.requeued, 1);
  const waiting = await findAgentTask(u.id, task.id);
  assert.equal(waiting?.status, "queued");
  assert.ok(new Date(waiting!.claimedAt!).getTime() > Date.now());
  // Not due yet.
  assert.equal((await runQueuedTasks({ agents })).requeued, 0);

  for (const attempt of [2, 3]) {
    await setColumns(task.id, "claimed_at = $2", [minutesAgo(1)]);
    t.mock.restoreAll();
    fakeApi(t, [429, 429, 429]);
    const counts = await runQueuedTasks({ agents });
    assert.equal(counts.requeued, attempt === 2 ? 1 : 0);
    assert.equal(counts.failed, attempt === 2 ? 0 : 1);
  }
  const after = await findAgentTask(u.id, task.id);
  assert.equal(after?.status, "failed");
  assert.equal(after?.attempts, 3);
  assert.equal(after?.error, "api_429");
});

test("a failure that can't be fixed by trying again fails at once", async (t) => {
  const u = await agentUser();
  const task = await queue(u.id);
  fakeApi(t, [400]);
  const counts = await runQueuedTasks({ agents });
  assert.equal(counts.failed, 1);
  const after = await findAgentTask(u.id, task.id);
  assert.equal(after?.status, "failed");
  assert.equal(after?.error, "api_400");
});

test("a task that was stopped stays stopped", async (t) => {
  const u = await agentUser();
  const task = await queue(u.id);
  await claimNextAgentTask();
  await stopAgentTask(u.id, task.id);
  // Nothing queued, so the worker has nothing to do and the stop stands.
  const bodies = fakeApi(t, [say("late")]);
  const counts = await runQueuedTasks({ agents });
  assert.equal(counts.done, 0);
  assert.equal(bodies.length, 0);
  assert.equal((await findAgentTask(u.id, task.id))?.status, "stopped");
});

test("a task stopped while the worker has it is left stopped", async (t) => {
  const u = await agentUser();
  const task = await queue(u.id);
  fakeApi(t, [say("late")], async () => {
    await stopAgentTask(u.id, task.id);
  });
  const counts = await runQueuedTasks({ agents });
  assert.equal(counts.done, 0);
  assert.equal((await findAgentTask(u.id, task.id))?.status, "stopped");
});

test("an account with agents off fails with not_allowed and no model call", async (t) => {
  const off = await makeUser("Off");
  const task = await queue(off.id);
  const bodies = fakeApi(t, [say("no")]);
  const counts = await runQueuedTasks({ agents });
  assert.equal(counts.failed, 1);
  assert.equal(bodies.length, 0);
  const after = await findAgentTask(off.id, task.id);
  assert.equal(after?.status, "failed");
  assert.equal(after?.error, "not_allowed");
});

test("a task for an agent that doesn't exist fails as unknown_agent", async (t) => {
  const u = await agentUser();
  const task = await queue(u.id, { prompt: "hi" }, "toString");
  const bodies = fakeApi(t, [say("no")]);
  await runQueuedTasks({ agents: agentFor });
  assert.equal(bodies.length, 0);
  assert.equal((await findAgentTask(u.id, task.id))?.error, "unknown_agent");
});

test("a task without a prompt fails as bad_input", async (t) => {
  const u = await agentUser();
  const task = await queue(u.id, { prompt: 5 });
  const bodies = fakeApi(t, [say("no")]);
  await runQueuedTasks({ agents });
  assert.equal(bodies.length, 0);
  const after = await findAgentTask(u.id, task.id);
  assert.equal(after?.status, "failed");
  assert.equal(after?.error, "bad_input");
});

test("one crashing task doesn't stop the next", async (t) => {
  const u = await agentUser();
  const crashing = await queue(u.id, { prompt: "boom" }, "agent_crash");
  const fine = await queue(u.id);
  t.mock.method(console, "error", () => {});
  const withCrash = (name: string) => {
    if (name === "agent_crash") throw new TypeError("a client said something private");
    return agents(name);
  };
  fakeApi(t, [say("fine")]);
  const counts = await runQueuedTasks({ agents: withCrash });
  assert.equal(counts.done, 1);
  assert.equal(counts.failed, 1);
  const bad = await findAgentTask(u.id, crashing.id);
  assert.equal(bad?.status, "failed");
  assert.equal(bad?.error, "TypeError");
  assert.equal((await findAgentTask(u.id, fine.id))?.status, "done");
});

test("a chat task that reaches the worker is failed as interrupted without calling the model", async (t) => {
  const u = await agentUser();
  const task = await queue(u.id, { prompt: "hello", chat: true });
  const bodies = fakeApi(t, [say("no")]);
  const counts = await runQueuedTasks({ agents });
  assert.equal(counts.failed, 1);
  assert.equal(bodies.length, 0);
  const after = await findAgentTask(u.id, task.id);
  assert.equal(after?.status, "failed");
  assert.equal(after?.error, "interrupted");
});

test("the agents cron answers 404 without the secret", async () => {
  process.env.CRON_SECRET = "s3cret";
  const call = (auth?: string) => agentsCron(new Request("https://folio.cam/api/cron/agents", { headers: auth ? { authorization: auth } : {} }));
  assert.equal((await call()).status, 404);
  assert.equal((await call("Bearer wrong")).status, 404);
  const ok = await call("Bearer s3cret");
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).done, 0);
});

test("the agents cron does nothing while agents are paused", async (t) => {
  process.env.CRON_SECRET = "s3cret";
  process.env.AGENTS_PAUSED = "1";
  const u = await agentUser();
  const task = await queue(u.id);
  const bodies = fakeApi(t, [say("no")]);
  const res = await agentsCron(new Request("https://folio.cam/api/cron/agents", { headers: { authorization: "Bearer s3cret" } }));
  assert.deepEqual(await res.json(), { paused: true });
  assert.equal(bodies.length, 0);
  assert.equal((await findAgentTask(u.id, task.id))?.status, "queued");
});
