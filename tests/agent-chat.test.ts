import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import * as adminActions from "../app/actions/admin.ts";
import * as agentActions from "../app/actions/agents.ts";
import { POST } from "../app/api/agents/chat/route.ts";
import { proposeAction } from "../lib/agents/approvals.ts";
import { SONNET } from "../lib/agents/models.ts";
import {
  addAgentChatMessage,
  createAgentTask,
  findAgentTask,
  findApproval,
  listAgentChat,
  listAgentTasks,
  recordAgentRun,
  updateUser,
} from "../lib/db.ts";
import { database } from "../lib/pg.ts";
import { callTool, fakeApi, reply, say } from "./agent-helpers.ts";
import { formOf, makeUser, postJson, redirectedTo, resetRequest, signInAs } from "./helpers.ts";

beforeEach(async () => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  const db = await database();
  await db.query("delete from agent_tasks");
});
afterEach(() => {
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.ADMIN_EMAILS;
  delete process.env.AGENTS_MONTHLY_LIMIT_USD;
  resetRequest();
});

async function photographer(name = "Chat") {
  const user = await makeUser(name);
  return updateUser(user.id, (u) => {
    u.agents = { enabled: true, at: new Date().toISOString(), by: "test" };
  });
}

const chat = (text: unknown) => postJson(POST, { text });
type Event = { type: string; name?: string; text?: string; message?: string; taskId?: string };
async function events(res: Response) {
  return (await res.text())
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Event);
}
const today = () => new Date().toISOString().slice(0, 10);

test("chat answers 401 when signed out", async () => {
  assert.equal((await chat("hi")).status, 401);
});

test("chat answers 404 when the agents are off for the account", async () => {
  const u = await makeUser("Plain");
  await signInAs(u);
  assert.equal((await chat("hi")).status, 404);
});

test("chat answers 403 while an admin is viewing the account, and calls no model", async (t) => {
  const admin = await makeUser("Boss");
  const alice = await photographer("Alice");
  process.env.ADMIN_EMAILS = admin.email;
  await signInAs(admin);
  await redirectedTo(adminActions.startImpersonation(formOf({ userId: alice.id, reason: "Helping with a support ticket" })));
  const bodies = fakeApi(t, [say("no")]);
  assert.equal((await chat("hi")).status, 403);
  assert.equal(bodies.length, 0);
  assert.deepEqual(await listAgentChat(alice.id), []);
});

test("chat answers 400 for an empty message or one over 4000 characters", async (t) => {
  const u = await photographer();
  await signInAs(u);
  const bodies = fakeApi(t, [say("no")]);
  assert.equal((await chat("   ")).status, 400);
  assert.equal((await chat("a".repeat(4001))).status, 400);
  assert.equal((await chat(42)).status, 400);
  assert.equal(bodies.length, 0);
  assert.deepEqual(await listAgentChat(u.id), []);
});

test("chat answers 429 after 30 messages in an hour", async () => {
  const u = await photographer();
  await signInAs(u);
  for (let i = 0; i < 30; i++) assert.equal((await chat("")).status, 400);
  assert.equal((await chat("")).status, 429);
});

test("a chat message streams the tool steps and the reply, saves both messages and finishes the task", async (t) => {
  const u = await photographer();
  await signInAs(u);
  fakeApi(t, [callTool("get_business", {}), say("You haven't filled in your business details.")]);
  const res = await chat("What do you know about my business?");
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") ?? "", /ndjson/);
  const list = await events(res);
  assert.deepEqual(
    list.map((e) => e.type),
    ["start", "tool", "reply"],
  );
  assert.equal(list[1].name, "get_business");
  assert.equal(list[2].text, "You haven't filled in your business details.");
  const saved = await listAgentChat(u.id);
  assert.deepEqual(
    saved.map((m) => [m.role, m.text]),
    [
      ["user", "What do you know about my business?"],
      ["assistant", "You haven't filled in your business details."],
    ],
  );
  assert.equal(saved[1].taskId, list[2].taskId);
  const task = await findAgentTask(u.id, list[2].taskId!);
  assert.equal(task?.status, "done");
  assert.equal(task?.agent, "agent_01_main");
});

test("today's date is in the newest user message only, never in the system text", async (t) => {
  const u = await photographer();
  await addAgentChatMessage({ userId: u.id, role: "user", text: "earlier question" });
  await addAgentChatMessage({ userId: u.id, role: "assistant", text: "earlier answer" });
  await signInAs(u);
  const bodies = fakeApi(t, [say("ok")]);
  await events(await chat("new question"));
  const body = bodies[0];
  assert.ok(!body.system.includes(today()));
  const contents = body.messages.map((m) => JSON.stringify(m.content));
  assert.ok(contents[contents.length - 1].includes(`(Sent ${today()})`));
  assert.ok(contents[contents.length - 1].includes("new question"));
  assert.equal(body.messages[0].role, "user");
});

test("history sent to the model starts with a user message and holds only the newest 20", async (t) => {
  const u = await photographer();
  for (let i = 0; i < 30; i++) await addAgentChatMessage({ userId: u.id, role: i % 2 ? "assistant" : "user", text: `m${i}` });
  await signInAs(u);
  const bodies = fakeApi(t, [say("ok")]);
  await events(await chat("now"));
  assert.equal(bodies[0].messages[0].role, "user");
  assert.ok(bodies[0].messages.length <= 20);
});

test("a chat reply never includes another account's history", async (t) => {
  const alice = await photographer("Alice");
  const bob = await photographer("Bob");
  await addAgentChatMessage({ userId: bob.id, role: "user", text: "bob's secret plan" });
  const bobTask = await createAgentTask({ userId: bob.id, agent: "agent_01_main", input: { prompt: "bob's secret task" } });
  await signInAs(alice);
  const bodies = fakeApi(t, [callTool("list_recent_tasks", {}), say("done")]);
  await events(await chat("hello"));
  const sent = JSON.stringify(bodies);
  assert.ok(!sent.includes("bob's secret"));
  assert.ok(!sent.includes(bobTask.id));
});

test("a refusal gives an error event and a failed task", async (t) => {
  const u = await photographer();
  await signInAs(u);
  fakeApi(t, [reply([], "refusal")]);
  const list = await events(await chat("something"));
  assert.equal(list[list.length - 1].type, "error");
  const [task] = await listAgentTasks(u.id);
  assert.equal(task.status, "failed");
  assert.equal(task.error, "refused");
});

test("reaching the monthly limit gives an error event and a failed task, with no model call", async (t) => {
  const u = await photographer();
  process.env.AGENTS_MONTHLY_LIMIT_USD = "1";
  await recordAgentRun({
    userId: u.id,
    agent: "agent_01_main",
    model: SONNET,
    inputTokens: 1,
    outputTokens: 1,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    costMicros: 2_000_000,
    stopReason: "end_turn",
  });
  await signInAs(u);
  const bodies = fakeApi(t, [say("no")]);
  const list = await events(await chat("hello"));
  const last = list[list.length - 1];
  assert.equal(last.type, "error");
  assert.match(last.message ?? "", /monthly limit/);
  assert.equal(bodies.length, 0);
  const [task] = await listAgentTasks(u.id);
  assert.equal(task.status, "failed");
  assert.equal(task.error, "monthly_limit");
});

test("an unexpected error leaves no running task and logs only the error's name", async (t) => {
  const u = await photographer();
  await signInAs(u);
  const logged = t.mock.method(console, "error", () => {});
  // No usage block: the runner throws a TypeError while reading it.
  fakeApi(t, [{ id: "m", type: "message", role: "assistant", model: SONNET, content: [], stop_reason: "end_turn" }]);
  const list = await events(await chat("my private words"));
  assert.equal(list[list.length - 1].type, "error");
  const tasks = await listAgentTasks(u.id);
  assert.equal(tasks[0].status, "failed");
  assert.ok(!tasks.some((x) => x.status === "running"));
  assert.ok(!JSON.stringify(logged.mock.calls.map((c) => c.arguments)).includes("my private words"));
});

test("the page actions refuse a request that belongs to another account", async () => {
  const alice = await photographer("Alice");
  const bob = await photographer("Bob");
  const approval = await proposeAction({ userId: bob.id, kind: "save_note", summary: "Bob's note", action: { text: "bob" } });
  const task = await createAgentTask({ userId: bob.id, agent: "agent_01_main", input: { prompt: "p" } });
  await signInAs(alice);
  assert.ok((await agentActions.approve(approval.id)).error);
  assert.ok((await agentActions.reject(approval.id)).error);
  assert.ok((await agentActions.reviseNote(approval.id, "changed")).error);
  await agentActions.stopTask(task.id);
  assert.equal((await findApproval(bob.id, approval.id))?.status, "pending");
  assert.equal((await findAgentTask(bob.id, task.id))?.status, "queued");
  assert.deepEqual(await listAgentChat(bob.id), []);
});

test("the page actions refuse an account without the agents", async () => {
  const alice = await photographer("Alice");
  const plain = await makeUser("Plain");
  const approval = await proposeAction({ userId: alice.id, kind: "save_note", summary: "n", action: { text: "t" } });
  await signInAs(plain);
  assert.ok((await agentActions.approve(approval.id)).error);
  assert.ok((await agentActions.reviseNote(approval.id, "x")).error);
  assert.ok((await agentActions.stopTask("anything")).error);
});

test("editing a note creates a new request and closes the old one; Stop stops your own task", async () => {
  const alice = await photographer();
  const approval = await proposeAction({ userId: alice.id, kind: "save_note", summary: "n", action: { text: "first" } });
  const task = await createAgentTask({ userId: alice.id, agent: "agent_01_main", input: { prompt: "p" } });
  await signInAs(alice);
  assert.ok((await agentActions.reviseNote(approval.id, "second")).ok);
  assert.equal((await findApproval(alice.id, approval.id))?.status, "rejected");
  assert.ok((await agentActions.stopTask(task.id)).ok);
  assert.equal((await findAgentTask(alice.id, task.id))?.status, "stopped");
});
