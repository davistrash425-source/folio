// Folio AGENTS on/off per account (setAgentsAccess in app/actions/admin.ts,
// agentsAllowed and agentsPaused in lib/plans.ts). Off for everyone until a
// full admin turns it on; AGENTS_PAUSED=1 switches it off for all.
import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { setAgentsAccess } from "../app/actions/admin.ts";
import { adminActionsFor, findUserById, updateUser } from "../lib/db.ts";
import { agentsAllowed } from "../lib/plans.ts";
import { formOf, makeUser, redirectedTo, resetRequest, signInAs } from "./helpers.ts";

beforeEach(resetRequest);
afterEach(() => {
  delete process.env.ADMIN_EMAILS;
  delete process.env.AGENTS_PAUSED;
});

async function adminAndFriend() {
  const admin = await makeUser("Boss");
  const friend = await makeUser("Friend");
  process.env.ADMIN_EMAILS = admin.email;
  await signInAs(admin);
  return { admin, friend };
}

test("a new account has the agents off", async () => {
  const user = await makeUser("Newcomer");
  const fresh = (await findUserById(user.id))!;
  assert.equal(fresh.agents, undefined);
  assert.equal(agentsAllowed(fresh), false);
});

test("a full admin can turn the agents on for one account, and it is logged", async () => {
  const { admin, friend } = await adminAndFriend();
  await redirectedTo(setAgentsAccess(formOf({ userId: friend.id, enabled: "on" })));

  const after = (await findUserById(friend.id))!;
  assert.equal(after.agents?.enabled, true);
  assert.equal(after.agents?.by, admin.email);
  assert.ok(after.agents?.at, "the time of the change is recorded");
  assert.equal(agentsAllowed(after), true);

  const log = (await adminActionsFor(friend.id)).filter((a) => a.action === "agents-access");
  assert.equal(log.length, 1);
  assert.equal(log[0].detail, "Agents on");
  assert.equal(log[0].adminEmail, admin.email);
});

test("turning the agents on for one account leaves another account off", async () => {
  const { friend } = await adminAndFriend();
  const other = await makeUser("Other");
  await redirectedTo(setAgentsAccess(formOf({ userId: friend.id, enabled: "on" })));

  assert.equal(agentsAllowed((await findUserById(friend.id))!), true);
  assert.equal(agentsAllowed((await findUserById(other.id))!), false);
});

test("a full admin can turn the agents off again, and it is logged", async () => {
  const { friend } = await adminAndFriend();
  await redirectedTo(setAgentsAccess(formOf({ userId: friend.id, enabled: "on" })));
  await redirectedTo(setAgentsAccess(formOf({ userId: friend.id, enabled: "off" })));

  const after = (await findUserById(friend.id))!;
  assert.equal(after.agents?.enabled, false);
  assert.equal(agentsAllowed(after), false);

  const log = (await adminActionsFor(friend.id)).filter((a) => a.action === "agents-access");
  assert.deepEqual(log.map((a) => a.detail), ["Agents off", "Agents on"]);
});

test("AGENTS_PAUSED=1 turns the agents off for an account that has them on", async () => {
  const { friend } = await adminAndFriend();
  await redirectedTo(setAgentsAccess(formOf({ userId: friend.id, enabled: "on" })));
  const on = (await findUserById(friend.id))!;
  assert.equal(agentsAllowed(on), true);

  process.env.AGENTS_PAUSED = "1";
  assert.equal(agentsAllowed(on), false);

  delete process.env.AGENTS_PAUSED;
  assert.equal(agentsAllowed(on), true, "the switch is only the env var; the account's setting is unchanged");
});

test("a suspended account can't use the agents, even when they are on", async () => {
  const { friend } = await adminAndFriend();
  await redirectedTo(setAgentsAccess(formOf({ userId: friend.id, enabled: "on" })));
  await updateUser(friend.id, (u) => {
    u.suspended = { at: new Date().toISOString(), reason: "test" };
  });

  const suspended = (await findUserById(friend.id))!;
  assert.equal(suspended.agents?.enabled, true);
  assert.equal(agentsAllowed(suspended), false);
});
