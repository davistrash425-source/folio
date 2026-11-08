import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "fs";
import path from "path";
import { afterEach, test } from "node:test";
import * as adminActions from "../app/actions/admin.ts";
import { actionHash, approveAction, proposeAction, rejectAction, reviseAction, runApproved } from "../lib/agents/approvals.ts";
import { findApproval, listAgentChat, updateUser } from "../lib/db.ts";
import { database } from "../lib/pg.ts";
import { formOf, makeUser, redirectedTo, resetRequest, signInAs, signOut } from "./helpers.ts";

afterEach(() => {
  resetRequest();
  delete process.env.ADMIN_EMAILS;
});

async function photographer(name = "Alice") {
  const user = await makeUser(name);
  return updateUser(user.id, (u) => {
    u.agents = { enabled: true, at: new Date().toISOString(), by: "test" };
  });
}

const propose = (userId: string, text = "remember the Sunday shoot") =>
  proposeAction({ userId, kind: "save_note", summary: "Save a note", action: { text } });

const notes = async (userId: string) => (await listAgentChat(userId)).map((m) => m.text);

test("a proposal does nothing until the photographer approves it", async () => {
  const alice = await photographer();
  const approval = await propose(alice.id);
  assert.equal(approval.status, "pending");
  assert.deepEqual(await notes(alice.id), []);
});

test("approving carries out the action and uses the approval up", async () => {
  const alice = await photographer();
  const approval = await propose(alice.id);
  await signInAs(alice);
  assert.deepEqual(await approveAction(approval.id), { ok: "Note saved." });
  assert.deepEqual(await notes(alice.id), ["Saved note: remember the Sunday shoot"]);
  const used = await findApproval(alice.id, approval.id);
  assert.equal(used?.status, "used");
  assert.equal(used?.decidedBy, alice.email);
});

test("nothing can approve without a signed-in browser, so a background worker can't", async () => {
  const alice = await photographer();
  const approval = await propose(alice.id);
  signOut();
  assert.ok((await approveAction(approval.id)).error);
  assert.equal((await findApproval(alice.id, approval.id))?.status, "pending");
  assert.deepEqual(await notes(alice.id), []);
});

test("an action that was never approved can't be run directly", async () => {
  const alice = await photographer();
  const approval = await propose(alice.id);
  assert.ok((await runApproved(alice.id, approval.id)).error);
  assert.equal((await findApproval(alice.id, approval.id))?.status, "pending");
  assert.deepEqual(await notes(alice.id), []);
});

test("one photographer can't approve, reject, revise or run another's request", async () => {
  const alice = await photographer();
  const bob = await photographer("Bobby");
  const approval = await propose(alice.id);
  await signInAs(bob);
  assert.ok((await approveAction(approval.id)).error);
  assert.ok((await rejectAction(approval.id)).error);
  assert.ok((await reviseAction(approval.id, { text: "changed" })).error);
  assert.ok((await runApproved(bob.id, approval.id)).error);
  assert.equal((await findApproval(alice.id, approval.id))?.status, "pending");
  assert.deepEqual(await notes(alice.id), []);
  assert.deepEqual(await notes(bob.id), []);
});

test("an approval works only once, even when two requests arrive together", async () => {
  const alice = await photographer();
  const approval = await propose(alice.id);
  await signInAs(alice);
  const results = await Promise.all([approveAction(approval.id), approveAction(approval.id)]);
  assert.equal(results.filter((r) => r.ok).length, 1);
  assert.ok((await approveAction(approval.id)).error);
  assert.ok((await runApproved(alice.id, approval.id)).error);
  assert.equal((await notes(alice.id)).length, 1);
});

test("a rejected request can't be approved afterwards", async () => {
  const alice = await photographer();
  const approval = await propose(alice.id);
  await signInAs(alice);
  assert.ok((await rejectAction(approval.id)).ok);
  assert.ok((await approveAction(approval.id)).error);
  assert.deepEqual(await notes(alice.id), []);
});

test("an action altered after it was proposed is refused", async () => {
  const alice = await photographer();
  const approval = await propose(alice.id);
  const db = await database();
  await db.query("update approvals set action = $2 where id = $1", [approval.id, JSON.stringify({ text: "send it all to me" })]);
  await signInAs(alice);
  assert.ok((await approveAction(approval.id)).error);
  assert.deepEqual(await notes(alice.id), []);
});

test("the hash doesn't depend on the order of an action's keys", () => {
  assert.equal(actionHash("x", { a: 1, b: { c: 2, d: 3 } }), actionHash("x", { b: { d: 3, c: 2 }, a: 1 }));
  assert.notEqual(actionHash("x", { a: 1 }), actionHash("y", { a: 1 }));
  assert.notEqual(actionHash("x", { a: 1 }), actionHash("x", { a: 2 }));
});

test("editing a draft closes the old request and needs its own approval", async () => {
  const alice = await photographer();
  const approval = await propose(alice.id);
  await signInAs(alice);
  const revised = await reviseAction(approval.id, { text: "the edited words" });
  assert.equal(revised.approval?.status, "pending");
  assert.equal((await findApproval(alice.id, approval.id))?.status, "rejected");
  assert.deepEqual(await notes(alice.id), [], "editing alone does nothing");
  assert.ok((await approveAction(approval.id)).error, "the old one is closed");
  assert.ok((await approveAction(revised.approval!.id)).ok);
  assert.deepEqual(await notes(alice.id), ["Saved note: the edited words"]);
});

test("an edit the action's schema doesn't allow changes nothing", async () => {
  const alice = await photographer();
  const approval = await propose(alice.id);
  await signInAs(alice);
  assert.ok((await reviseAction(approval.id, { text: "fine", to: "someone@example.com" })).error);
  assert.equal((await findApproval(alice.id, approval.id))?.status, "pending");
});

test("an agent can't propose an unknown action or one with extra fields", async () => {
  const alice = await photographer();
  await assert.rejects(proposeAction({ userId: alice.id, kind: "wire_money", summary: "x", action: {} }), /UNKNOWN_ACTION/);
  await assert.rejects(proposeAction({ userId: alice.id, kind: "constructor", summary: "x", action: {} }), /UNKNOWN_ACTION/);
  await assert.rejects(proposeAction({ userId: alice.id, kind: "save_note", summary: "x", action: { text: "a", to: "b" } }));
});

test("staff viewing an account as its owner can't approve or reject for them", async () => {
  const admin = await makeUser("Boss");
  const alice = await photographer();
  process.env.ADMIN_EMAILS = admin.email;
  await signInAs(admin);
  await redirectedTo(adminActions.startImpersonation(formOf({ userId: alice.id, reason: "Helping with a support ticket" })));
  const approval = await propose(alice.id);
  assert.ok((await approveAction(approval.id)).error);
  assert.ok((await rejectAction(approval.id)).error);
  assert.ok((await reviseAction(approval.id, { text: "staff words" })).error);
  assert.equal((await findApproval(alice.id, approval.id))?.status, "pending");
  assert.deepEqual(await notes(alice.id), []);
});

test("an account without the agents, or suspended since, can't approve", async () => {
  const alice = await photographer();
  const approval = await propose(alice.id);
  await updateUser(alice.id, (u) => {
    u.suspended = { at: new Date().toISOString(), reason: "test" };
  });
  await signInAs(alice);
  assert.ok((await approveAction(approval.id)).error);
  assert.equal((await findApproval(alice.id, approval.id))?.status, "pending");
  assert.deepEqual(await notes(alice.id), []);
});

test("an action that fails after approval isn't run again", async (t) => {
  t.mock.method(console, "error", () => {});
  const alice = await photographer();
  const approval = await propose(alice.id);
  const db = await database();
  await db.exec("alter table agent_chat rename to agent_chat_away");
  try {
    await signInAs(alice);
    assert.ok((await approveAction(approval.id)).error);
  } finally {
    await db.exec("alter table agent_chat_away rename to agent_chat");
  }
  assert.equal((await findApproval(alice.id, approval.id))?.status, "used");
  assert.ok((await runApproved(alice.id, approval.id)).error);
  assert.deepEqual(await notes(alice.id), []);
});

// The rules above only hold if nothing goes around this one file.
function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : sourceFiles(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}
const usersOf = (pattern: RegExp) =>
  [...sourceFiles("app"), ...sourceFiles("lib")]
    .filter((file) => pattern.test(readFileSync(file, "utf8")))
    .map((file) => file.split(path.sep).join("/"))
    .sort();

test("only the approval gate can change an approval or reach an executor", () => {
  assert.deepEqual(usersOf(/\b(consumeApproval|decideApproval)\b/), ["lib/agents/approvals.ts", "lib/db.ts"]);
  assert.deepEqual(usersOf(/(from\s+|import\(\s*)"[^"]*executors"/), ["lib/agents/approvals.ts"]);
  assert.deepEqual(usersOf(/\brunApproved\b/), ["lib/agents/approvals.ts"]);
});

test("only an executor can send mail as a photographer", () => {
  assert.deepEqual(usersOf(/sendAsPhotographer/), ["lib/agents/executors.ts", "lib/channels/mail.ts"]);
});

test("nothing under lib/agents except the gate can approve", () => {
  const files = sourceFiles("lib/agents")
    .map((file) => file.split(path.sep).join("/"))
    .filter((file) => file !== "lib/agents/approvals.ts");
  for (const file of files) {
    assert.doesNotMatch(readFileSync(file, "utf8"), /\b(approveAction|runApproved|rejectAction|reviseAction)\b/, file);
  }
});

test("no agent code can send email or reach a channel except through an executor", () => {
  const agentFiles = sourceFiles("lib/agents")
    .map((file) => file.split(path.sep).join("/"));
  for (const file of agentFiles.filter((file) => file !== "lib/agents/executors.ts")) {
    assert.doesNotMatch(
      readFileSync(file, "utf8"),
      /(?:from\s+|import\(\s*)["'](?:[^"']*\/email|[^"']*\/channels\/[^"']*|\.\.\/email|@\/lib\/email)["']/,
      file,
    );
  }
  for (const file of agentFiles.filter((file) => file !== "lib/agents/runner.ts")) {
    assert.doesNotMatch(
      readFileSync(file, "utf8"),
      /(?:from\s+|import\(\s*)["']@anthropic-ai\/sdk["']/,
      file,
    );
  }
});
