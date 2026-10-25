// "Log in as this user": a full admin looking at an account as its owner, to
// reproduce a problem. It needs a reason, is logged, lasts 30 minutes, and
// can't touch the account's password, email, address, sessions, export or
// deletion, or any admin page.
import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import * as adminActions from "../app/actions/admin.ts";
import * as authActions from "../app/actions/auth.ts";
import * as siteActions from "../app/actions/site.ts";
import { GET as exportAccount } from "../app/api/export/route.ts";
import { requireAdmin } from "../lib/admin.ts";
import { currentImpersonation, currentUser } from "../lib/auth.ts";
import { adminActionsFor, findUserById, updateUser } from "../lib/db.ts";
import { IMPERSONATION_MINUTES, minutesLeft } from "../lib/session.ts";
import { addPhoto, databaseText, formOf, makeUser, redirectedTo, resetRequest, signInAs, signOut } from "./helpers.ts";
import { cookieJar } from "./stubs/next-headers.ts";
import { NotFoundError } from "./stubs/next-navigation.ts";

beforeEach(resetRequest);
afterEach(() => {
  delete process.env.ADMIN_EMAILS;
  delete process.env.ADMIN_VIEWER_EMAILS;
});

const COOKIE = "impersonate";

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}
const doneMessage = (url: string | null) => decodeURIComponent(url?.split("?done=")[1] ?? "");
const REASON = "Reproducing the upload error they reported";

// A full admin (signed in), a read-only viewer, and two photographers.
async function world() {
  const admin = await makeUser("Boss");
  const viewer = await makeUser("Watcher");
  const alice = await makeUser("Alice");
  const bob = await makeUser("Bobby");
  process.env.ADMIN_EMAILS = admin.email;
  process.env.ADMIN_VIEWER_EMAILS = viewer.email;
  await signInAs(admin);
  return { admin, viewer, alice, bob };
}

const start = (alice: { id: string }, reason = REASON) =>
  redirectedTo(adminActions.startImpersonation(form({ userId: alice.id, reason })));

test("starting needs a typed reason, then shows the account as its owner and logs why", async () => {
  const { admin, alice } = await world();

  const tooShort = await start(alice, "hi");
  assert.match(doneMessage(tooShort), /Say why you need to see their account/);
  assert.ok(!cookieJar.has(COOKIE));
  assert.deepEqual(await adminActionsFor(alice.id), []);

  assert.equal(await start(alice), "/dashboard/manage/photos");
  assert.ok(cookieJar.has(COOKIE));
  assert.equal((await currentUser())?.id, alice.id, "the dashboard now shows alice");
  const impersonation = (await currentImpersonation())!;
  assert.equal(impersonation.admin.id, admin.id);
  assert.equal(impersonation.target.id, alice.id);
  assert.ok(minutesLeft(impersonation.expires) <= IMPERSONATION_MINUTES);
  assert.ok(minutesLeft(impersonation.expires) >= IMPERSONATION_MINUTES - 1);

  const log = await adminActionsFor(alice.id);
  assert.equal(log.length, 1);
  assert.equal(log[0].action, "impersonation-started");
  assert.equal(log[0].adminEmail, admin.email);
  assert.ok(log[0].detail.includes(REASON));
});

test("viewers, photographers and signed-out visitors can't start it", async () => {
  const { viewer, alice, bob } = await world();
  const before = await databaseText();

  await signInAs(viewer);
  await assert.rejects(start(alice), NotFoundError);
  await signInAs(bob);
  await assert.rejects(start(alice), NotFoundError);
  signOut();
  assert.equal(await start(alice), "/login");

  assert.ok(!cookieJar.has(COOKIE));
  assert.equal(await databaseText(), before);
  assert.deepEqual(await adminActionsFor(alice.id), []);
});

test("staff accounts, an admin's extra sites and yourself can't be viewed this way", async () => {
  const { admin, viewer } = await world();
  const extra = await makeUser("Extra");
  await updateUser(extra.id, (u) => {
    u.managedBy = admin.id;
  });
  for (const target of [viewer, extra, admin]) {
    assert.match(doneMessage(await start(target)), /can't view staff accounts or extra sites/);
  }
  assert.ok(!cookieJar.has(COOKIE));
  assert.equal((await currentUser())?.id, admin.id);
});

test("while viewing an account, every admin page and action is closed", async () => {
  const { alice } = await world();
  await start(alice);

  await assert.rejects(requireAdmin(), NotFoundError);
  const before = await databaseText();
  await assert.rejects(adminActions.suspendSite(form({ userId: alice.id, reason: "x" })), NotFoundError);
  await assert.rejects(adminActions.deleteAccountAsAdmin(form({ userId: alice.id, confirm: alice.subdomain })), NotFoundError);
  await assert.rejects(adminActions.startImpersonation(form({ userId: alice.id, reason: REASON })), NotFoundError);
  assert.equal(await databaseText(), before);
});

test("while viewing an account, its password, address, sessions, export and deletion are off limits", async () => {
  const { alice } = await world();
  await start(alice);
  const before = await databaseText();

  assert.match((await authActions.deleteAccount({}, formOf({ password: "anything", confirm: alice.subdomain }))).error ?? "", /Stop viewing it first/);
  assert.match((await siteActions.changeAddress({}, formOf({ subdomain: "brand-new-address" }))).error ?? "", /Stop viewing it first/);
  assert.match((await authActions.signOutEverywhereElse()).error ?? "", /Stop viewing it first/);
  assert.match((await authActions.resendVerification()).error ?? "", /Stop viewing it first/);
  assert.equal((await exportAccount()).status, 403);

  assert.equal(await databaseText(), before, "nothing about the account changed");
  assert.ok(await findUserById(alice.id));
});

test("everything else works as the account, and only the account: other people's data stays out of reach", async () => {
  const { admin, alice, bob } = await world();
  const mine = (await addPhoto(alice.id)).photo;
  const theirs = (await addPhoto(bob.id, { description: "bob's" })).photo;
  await start(alice);

  await siteActions.updatePhoto(mine.id, { description: "Fixed as alice", location: "", alt: "", albumIds: [] });
  assert.equal((await findUserById(alice.id))!.photos[0].description, "Fixed as alice");

  await siteActions.updatePhoto(theirs.id, { description: "hacked", location: "", alt: "", albumIds: [] });
  await siteActions.deletePhoto(theirs.id);
  const bobNow = (await findUserById(bob.id))!;
  assert.equal(bobNow.photos.length, 1);
  assert.equal(bobNow.photos[0].description, "bob's");

  await siteActions.setPublished(false);
  assert.equal((await findUserById(alice.id))!.published, false);
  assert.notEqual((await findUserById(admin.id))!.published, false, "the admin's own account is untouched");
});

test("a suspended account stays suspended while an admin views it", async () => {
  const { alice } = await world();
  await updateUser(alice.id, (u) => {
    u.suspended = { at: new Date().toISOString(), reason: "spam" };
  });
  await start(alice);
  assert.equal((await currentUser())?.suspended?.reason, "spam");
});

test("stopping logs it, clears the cookie and goes back to the admin's own login", async () => {
  const { admin, alice } = await world();
  await start(alice);

  assert.equal(await redirectedTo(adminActions.stopImpersonation()), `/admin/sites/${alice.subdomain}`);
  assert.ok(!cookieJar.has(COOKIE));
  assert.equal((await currentUser())?.id, admin.id);
  assert.equal((await requireAdmin()).role, "admin");
  const actions = (await adminActionsFor(alice.id)).map((e) => e.action).sort();
  assert.deepEqual(actions, ["impersonation-ended", "impersonation-started"]);
});

test("it ends by itself after 30 minutes", async (t) => {
  const { admin, alice } = await world();
  await start(alice);
  assert.equal((await currentUser())?.id, alice.id);

  const real = Date.now();
  t.mock.method(Date, "now", () => real + (IMPERSONATION_MINUTES + 1) * 60 * 1000);
  assert.equal(await currentImpersonation(), null);
  assert.equal((await currentUser())?.id, admin.id, "back to the admin's own account");
});

test("it ends the moment the admin stops being an admin", async () => {
  const { admin, alice } = await world();
  await start(alice);
  assert.equal((await currentUser())?.id, alice.id);

  delete process.env.ADMIN_EMAILS;
  assert.equal(await currentImpersonation(), null);
  assert.equal((await currentUser())?.id, admin.id, "just their own, now ordinary, account");
});

test("it ends if the account becomes staff or is deleted", async () => {
  const { admin, alice } = await world();
  await start(alice);
  process.env.ADMIN_VIEWER_EMAILS = alice.email;
  assert.equal(await currentImpersonation(), null);
  assert.equal((await currentUser())?.id, admin.id);

  delete process.env.ADMIN_VIEWER_EMAILS;
  assert.equal((await currentUser())?.id, alice.id, "the cookie still counts once the reason is gone");
  const { deleteUser } = await import("../lib/db.ts");
  await deleteUser(alice.id);
  assert.equal(await currentImpersonation(), null);
  assert.equal((await currentUser())?.id, admin.id);
});

test("a tampered cookie, or another admin's cookie, is ignored", async () => {
  const { admin, alice } = await world();
  const other = await makeUser("Second");
  process.env.ADMIN_EMAILS = `${admin.email},${other.email}`;

  await start(alice);
  const genuine = cookieJar.get(COOKIE)!;

  const forged = `${genuine.slice(0, -2)}${genuine.endsWith("AA") ? "BB" : "AA"}`;
  cookieJar.set(COOKIE, forged);
  assert.equal((await currentUser())?.id, admin.id, "a bad signature does nothing");

  cookieJar.set(COOKIE, genuine.replace(alice.id, (await makeUser("Third")).id));
  assert.equal((await currentUser())?.id, admin.id, "changing who it's for breaks the signature");

  // A real cookie made for the other admin doesn't work in this admin's browser.
  await signInAs(other);
  await start(alice);
  const othersCookie = cookieJar.get(COOKIE)!;
  await signInAs(admin);
  cookieJar.set(COOKIE, othersCookie);
  assert.equal((await currentUser())?.id, admin.id);
});

test("logging out also drops the viewing cookie", async () => {
  const { alice } = await world();
  await start(alice);
  assert.ok(cookieJar.has(COOKIE));
  await redirectedTo(authActions.logout());
  assert.ok(!cookieJar.has(COOKIE));
  assert.equal(await currentUser(), null);
});
