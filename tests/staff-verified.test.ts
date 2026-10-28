// Staff roles need a confirmed email. Sign-up logs someone straight in, so a
// staff address with no account yet (or an account nobody confirmed) must not
// open the admin pages.
import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { requireAdmin, requireFullAdmin } from "../lib/admin.ts";
import { adminRole, currentStaff, isAdmin } from "../lib/auth.ts";
import { findUserById, updateUser } from "../lib/db.ts";
import { makeUser, resetRequest, signInAs } from "./helpers.ts";
import { NotFoundError } from "./stubs/next-navigation.ts";

beforeEach(resetRequest);
afterEach(() => {
  delete process.env.ADMIN_EMAILS;
  delete process.env.ADMIN_VIEWER_EMAILS;
});

test("an unconfirmed account with a staff address gets no staff role or admin pages", async () => {
  const impostor = await makeUser("Impostor", { verified: false });
  process.env.ADMIN_EMAILS = impostor.email;
  process.env.ADMIN_VIEWER_EMAILS = impostor.email;

  assert.equal(adminRole(impostor), null);
  assert.ok(!isAdmin(impostor));
  await signInAs(impostor);
  assert.equal(await currentStaff(), null);
  await assert.rejects(requireAdmin(), NotFoundError);
  await assert.rejects(requireFullAdmin(), NotFoundError);
});

test("the same staff address gets its role once the account is confirmed", async () => {
  const boss = await makeUser("Boss", { verified: false });
  process.env.ADMIN_EMAILS = boss.email;
  await signInAs(boss);
  await assert.rejects(requireAdmin(), NotFoundError);

  await updateUser(boss.id, (u) => {
    u.emailVerified = true;
  });
  assert.equal(adminRole((await findUserById(boss.id))!), "admin");
  assert.equal((await requireFullAdmin()).role, "admin");
});

test("a confirmed read-only viewer keeps the viewer role, and an unconfirmed one loses it", async () => {
  const watcher = await makeUser("Watcher");
  process.env.ADMIN_VIEWER_EMAILS = watcher.email;
  await signInAs(watcher);
  assert.equal((await requireAdmin()).role, "viewer");

  await updateUser(watcher.id, (u) => {
    u.emailVerified = false;
  });
  await assert.rejects(requireAdmin(), NotFoundError);
});
