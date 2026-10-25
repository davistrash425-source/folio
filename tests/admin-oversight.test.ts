// Folio's admin oversight: roles (full admins and read-only viewers), the
// overview numbers, the account lists, the audit log, and the account tools on
// a site's admin page (notes, sign out, confirm email, delete).
import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { setTimeout as sleep } from "node:timers/promises";
import * as adminActions from "../app/actions/admin.ts";
import { GET as exportAccount } from "../app/api/export/route.ts";
import { requireAdmin, requireFullAdmin } from "../lib/admin.ts";
import { adminRole, currentUser, isAdmin } from "../lib/auth.ts";
import {
  adminActionsFor,
  adminLogChoices,
  addReport,
  adminOverview,
  createUser,
  findUserById,
  listAccounts,
  listAdminLog,
  listAllAccounts,
  logAdminAction,
  logAdminView,
  updateUser,
} from "../lib/db.ts";
import { database } from "../lib/pg.ts";
import {
  addPhoto,
  captureEmails,
  databaseText,
  filesOf,
  makeUser,
  readZip,
  redirectedTo,
  resetRequest,
  signInAs,
  signOut,
} from "./helpers.ts";
import { cookieJar } from "./stubs/next-headers.ts";
import { NotFoundError } from "./stubs/next-navigation.ts";

beforeEach(resetRequest);
afterEach(() => {
  delete process.env.ADMIN_EMAILS;
  delete process.env.ADMIN_VIEWER_EMAILS;
});

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const doneMessage = (url: string | null) => decodeURIComponent(url?.split("?done=")[1] ?? "");

// A full admin, a read-only viewer and a photographer, with the admin signed in.
async function staff() {
  const admin = await makeUser("Boss");
  const viewer = await makeUser("Watcher");
  const alice = await makeUser("Alice");
  process.env.ADMIN_EMAILS = admin.email;
  process.env.ADMIN_VIEWER_EMAILS = ` ${viewer.email.toUpperCase()} , nobody@example.com `;
  await signInAs(admin);
  return { admin, viewer, alice };
}

// ── Roles ───────────────────────────────────────────────────────────────

test("ADMIN_VIEWER_EMAILS makes read-only staff, who are not admins", async () => {
  const { admin, viewer, alice } = await staff();
  assert.equal(adminRole(admin), "admin");
  assert.equal(adminRole(viewer), "viewer");
  assert.equal(adminRole(alice), null);
  assert.ok(isAdmin(admin));
  assert.ok(!isAdmin(viewer), "a viewer can't switch sites or act as an admin");
  delete process.env.ADMIN_VIEWER_EMAILS;
  assert.equal(adminRole(viewer), null);
});

test("admin pages open for admins and viewers, and are not found for photographers or signed-out visitors", async () => {
  const { admin, viewer, alice } = await staff();
  assert.equal((await requireAdmin()).role, "admin");

  await signInAs(viewer);
  assert.equal((await requireAdmin()).role, "viewer");
  assert.equal((await requireAdmin()).email, viewer.email);

  await signInAs(alice);
  await assert.rejects(requireAdmin(), NotFoundError);

  signOut();
  assert.equal(await redirectedTo(requireAdmin()), "/login");
  assert.equal(await redirectedTo(requireFullAdmin()), "/login");
  void admin;
});

test("a read-only viewer is refused by every admin action and changes nothing", async () => {
  const { viewer, alice } = await staff();
  const one = (await addPhoto(alice.id)).photo;
  await signInAs(viewer);
  await assert.rejects(requireFullAdmin(), NotFoundError);

  const calls: Record<string, () => Promise<unknown>> = {
    takeDownPhotos: () => adminActions.takeDownPhotos(form({ userId: alice.id, photo: one.id })),
    restorePhotos: () => adminActions.restorePhotos(form({ userId: alice.id, photo: one.id })),
    suspendSite: () => adminActions.suspendSite(form({ userId: alice.id, reason: "x" })),
    unsuspendSite: () => adminActions.unsuspendSite(form({ userId: alice.id })),
    placeLegalHold: () => adminActions.placeLegalHold(form({ userId: alice.id })),
    releaseLegalHold: () => adminActions.releaseLegalHold(form({ userId: alice.id })),
    addRightsToOlderPhotos: () => adminActions.addRightsToOlderPhotos(),
    addAdminNote: () => adminActions.addAdminNote(form({ userId: alice.id, text: "x" })),
    signOutAccountEverywhere: () => adminActions.signOutAccountEverywhere(form({ userId: alice.id })),
    verifyAccountEmail: () => adminActions.verifyAccountEmail(form({ userId: alice.id })),
    resendAccountVerification: () => adminActions.resendAccountVerification(form({ userId: alice.id })),
    deleteAccountAsAdmin: () => adminActions.deleteAccountAsAdmin(form({ userId: alice.id, confirm: alice.subdomain })),
    startImpersonation: () => adminActions.startImpersonation(form({ userId: alice.id, reason: "just looking around" })),
  };
  const before = await databaseText();
  for (const [name, call] of Object.entries(calls)) {
    await assert.rejects(call(), NotFoundError, `${name} as a viewer`);
  }
  assert.equal(await databaseText(), before);
  assert.deepEqual(await adminActionsFor(alice.id), []);
});

// ── Overview ────────────────────────────────────────────────────────────

test("the overview counts live, draft, suspended and unconfirmed sites, strikes, holds, photos and reports", async () => {
  const before = await adminOverview();
  const live = await makeUser("Livea");
  await addPhoto(live.id);
  await addPhoto(live.id);
  await makeUser("Draftb", { published: false });
  const suspended = await makeUser("Susp");
  await updateUser(suspended.id, (u) => {
    u.suspended = { at: new Date().toISOString(), reason: "spam" };
  });
  const unverified = await makeUser("Unver", { verified: false });
  await updateUser(unverified.id, (u) => {
    u.createdAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
  });
  const struck = await makeUser("Struck");
  await updateUser(struck.id, (u) => {
    u.strikes = [{ at: new Date().toISOString(), reportId: "r1" }];
    u.legalHold = { at: new Date().toISOString(), note: "" };
  });
  const extra = await makeUser("Extra");
  await updateUser(extra.id, (u) => {
    u.managedBy = live.id;
  });
  const reportId = await addReport({ subdomain: live.subdomain, reason: "copyright", details: "x", reporterEmail: "a@example.com" });

  const after = await adminOverview();
  const delta = (key: "accounts" | "live" | "draft" | "suspended" | "unverified" | "withStrikes" | "onHold" | "photos" | "signups7" | "signups30" | "openReports" | "openCopyright") =>
    after[key] - before[key];
  assert.equal(delta("accounts"), 5, "an admin's extra site isn't a separate photographer");
  assert.equal(delta("live"), 2, "Livea and Struck");
  assert.equal(delta("draft"), 1);
  assert.equal(delta("suspended"), 1);
  assert.equal(delta("unverified"), 1);
  assert.equal(delta("withStrikes"), 1);
  assert.equal(delta("onHold"), 1);
  assert.equal(delta("photos"), 2);
  assert.equal(delta("signups7"), 4, "the unconfirmed account joined 10 days ago");
  assert.equal(delta("signups30"), 5);
  assert.equal(delta("openReports"), 1);
  assert.equal(delta("openCopyright"), 1);
  assert.ok(after.oldestOpenReports.some((r) => r.id === reportId));
  assert.ok(after.staleUnverified.some((u) => u.subdomain === unverified.subdomain));
  assert.ok(after.suspendedSites.some((s) => s.subdomain === suspended.subdomain && s.reason === "spam"));
});

// ── Account lists ───────────────────────────────────────────────────────

test("the accounts list searches name, email and address, filters by status, and never treats % as a wildcard", async () => {
  const film = await createUser({ email: "fan@lists.example", passwordHash: "x", subdomain: "listfilm", name: "100% Film", published: true });
  const other = await createUser({ email: "other@lists.example", passwordHash: "x", subdomain: "listother", name: "Someone Else", published: false });

  const byName = await listAccounts({ q: "Someone Else" });
  assert.deepEqual(byName.rows.map((r) => r.id), [other.id]);
  assert.deepEqual((await listAccounts({ q: "FAN@LISTS" })).rows.map((r) => r.id), [film.id], "by email, any case");
  assert.deepEqual((await listAccounts({ q: "listother" })).rows.map((r) => r.id), [other.id], "by address");
  assert.deepEqual((await listAccounts({ q: "%" })).rows.map((r) => r.id), [film.id], "a % only matches a literal %");

  assert.ok((await listAccounts({ q: "lists.example", filter: "draft" })).rows.every((r) => r.id === other.id));
  assert.deepEqual((await listAccounts({ q: "lists.example", filter: "unverified" })).rows.map((r) => r.subdomain).sort(), ["listfilm", "listother"]);
  assert.deepEqual((await listAccounts({ q: "lists.example", filter: "live" })).rows, []);

  const admins = await listAccounts({ q: "lists.example", filter: "admin", admins: ["FAN@lists.example".toLowerCase()] });
  assert.deepEqual(admins.rows.map((r) => r.id), [film.id]);
});

test("the accounts list is newest first and pages 50 at a time", async () => {
  for (let i = 0; i < 53; i++) {
    await createUser({ email: `page${i}@paging.example`, passwordHash: "x", subdomain: `paging-${i}`, name: `Pager ${i}`, published: true });
  }
  const first = await listAccounts({ q: "paging.example" });
  assert.equal(first.total, 53);
  assert.equal(first.pages, 2);
  assert.equal(first.rows.length, 50);
  assert.equal(first.page, 1);
  const second = await listAccounts({ q: "paging.example", page: 2 });
  assert.equal(second.rows.length, 3);
  const seen = new Set([...first.rows, ...second.rows].map((r) => r.id));
  assert.equal(seen.size, 53, "no account twice");
  const times = first.rows.map((r) => Date.parse(r.createdAt));
  assert.deepEqual(times, [...times].sort((a, b) => b - a), "newest first");
  assert.equal((await listAccounts({ q: "paging.example", page: 99 })).page, 2, "a page past the end shows the last one");
});

test("the all-accounts list has every account once, with only the fields the table shows", async () => {
  const a = await makeUser("Allone");
  const b = await makeUser("Alltwo", { published: false });
  const rows = await listAllAccounts();
  const total = (await listAccounts({})).total;
  assert.equal(rows.length, total, "every account");
  assert.equal(new Set(rows.map((r) => r.id)).size, rows.length);
  const mine = rows.find((r) => r.id === a.id)!;
  assert.deepEqual(Object.keys(mine).sort(), ["createdAt", "email", "extraSite", "hold", "id", "live", "name", "photos", "published", "strikes", "subdomain", "suspended", "verified"]);
  assert.ok(rows.find((r) => r.id === b.id) && !rows.find((r) => r.id === b.id)!.published);
  assert.ok(!JSON.stringify(rows).includes("passwordHash"));
});

// ── Audit log ───────────────────────────────────────────────────────────

test("the audit log lists every admin's actions newest first and filters by admin, action and site", async () => {
  const alice = await makeUser("Logsa");
  const bob = await makeUser("Logsb");
  const entry = (adminEmail: string, user: { id: string; subdomain: string }, action: string) =>
    logAdminAction({ adminEmail, userId: user.id, subdomain: user.subdomain, action, detail: `${action} by ${adminEmail}` });
  await entry("one@staff.example", alice, "suspend");
  await sleep(5);
  await entry("two@staff.example", bob, "legal-hold");
  await sleep(5);
  await entry("ONE@staff.example", bob, "suspend");

  const all = await listAdminLog({ admin: "one@staff.example" });
  assert.deepEqual(all.rows.map((r) => r.subdomain), [bob.subdomain, alice.subdomain], "newest first, any case of the email");
  assert.deepEqual((await listAdminLog({ action: "legal-hold", subdomain: bob.subdomain })).rows.map((r) => r.adminEmail), ["two@staff.example"]);
  assert.equal((await listAdminLog({ admin: "one@staff.example", subdomain: alice.subdomain.toUpperCase() })).total, 1);
  const choices = await adminLogChoices();
  assert.ok(choices.admins.includes("two@staff.example") && choices.actions.includes("legal-hold"));
});

test("the audit log pages 50 at a time", async () => {
  const alice = await makeUser("Logpager");
  for (let i = 0; i < 52; i++) {
    await logAdminAction({ adminEmail: "pager@staff.example", userId: alice.id, subdomain: alice.subdomain, action: "add-note", detail: `n${i}` });
  }
  const first = await listAdminLog({ admin: "pager@staff.example" });
  assert.equal(first.total, 52);
  assert.equal(first.rows.length, 50);
  assert.equal((await listAdminLog({ admin: "pager@staff.example", page: 2 })).rows.length, 2);
});

test("opening an account is logged as 'viewed' once an hour per admin and account", async () => {
  const alice = await makeUser("Viewed");
  const look = (adminEmail: string) => logAdminView({ adminEmail, userId: alice.id, subdomain: alice.subdomain });
  const views = async () => (await adminActionsFor(alice.id)).filter((e) => e.action === "viewed");

  await look("a@staff.example");
  await look("a@staff.example");
  assert.equal((await views()).length, 1, "twice in a row is one entry");
  await look("b@staff.example");
  assert.equal((await views()).length, 2, "another person is logged separately");

  const db = await database();
  await db.query("update admin_actions set at = now() - interval '2 hours' where user_id = $1", [alice.id]);
  await look("a@staff.example");
  assert.equal((await views()).length, 3, "an hour later it's logged again");
});

// ── Account tools ───────────────────────────────────────────────────────

test("a private note is saved, logged, shown to staff and left out of the photographer's export", async () => {
  const { alice } = await staff();
  const to = await redirectedTo(adminActions.addAdminNote(form({ userId: alice.id, text: "Asked about a refund." })));
  assert.equal(to?.split("?")[0], `/admin/sites/${alice.subdomain}`);
  const saved = (await findUserById(alice.id))!;
  assert.equal(saved.adminNotes?.length, 1);
  assert.equal(saved.adminNotes?.[0].text, "Asked about a refund.");
  assert.match(saved.adminNotes![0].by, /@example\.com$/);
  assert.equal((await adminActionsFor(alice.id)).filter((e) => e.action === "add-note").length, 1);

  assert.equal(doneMessage(await redirectedTo(adminActions.addAdminNote(form({ userId: alice.id, text: "  " })))), "Write something to save.");
  assert.equal((await findUserById(alice.id))!.adminNotes?.length, 1);

  await signInAs(alice);
  const files = readZip(Buffer.from(await (await exportAccount()).arrayBuffer()));
  const account = files.get("account.json")!.toString("utf8");
  assert.ok(account.includes(alice.email));
  assert.ok(!account.includes("Asked about a refund"), "the photographer never sees staff notes");
  assert.ok(!account.includes("adminNotes"));
});

test("signing an account out everywhere ends its existing logins", async () => {
  const { admin, alice } = await staff();
  await signInAs(alice);
  const aliceBrowser = new Map(cookieJar);
  assert.equal((await currentUser())?.id, alice.id);

  await signInAs(admin);
  await sleep(5); // logins are dated to the millisecond
  const to = await redirectedTo(adminActions.signOutAccountEverywhere(form({ userId: alice.id })));
  assert.equal(doneMessage(to), "Signed them out everywhere.");

  cookieJar.clear();
  for (const [name, value] of aliceBrowser) cookieJar.set(name, value);
  assert.equal(await currentUser(), null, "alice's old login no longer works");
  assert.ok((await findUserById(alice.id))!.sessionsValidFrom);
  assert.equal((await adminActionsFor(alice.id)).filter((e) => e.action === "sign-out-everywhere").length, 1);
});

test("an admin can mark an email as confirmed or resend the confirmation, and both are logged", async (t) => {
  const { alice } = await staff();
  const waiting = await makeUser("Waiting", { verified: false });
  const emails = captureEmails(t);

  const sent = await redirectedTo(adminActions.resendAccountVerification(form({ userId: waiting.id })));
  assert.equal(doneMessage(sent), `Sent a confirmation email to ${waiting.email}.`);
  assert.ok(emails.some((e) => e.includes(waiting.email) && e.includes("/verify-email?token=")));
  assert.equal((await findUserById(waiting.id))!.emailVerified, false);

  const marked = await redirectedTo(adminActions.verifyAccountEmail(form({ userId: waiting.id })));
  assert.equal(doneMessage(marked), "Marked their email as confirmed.");
  assert.equal((await findUserById(waiting.id))!.emailVerified, true);
  assert.deepEqual(
    (await adminActionsFor(waiting.id)).map((e) => e.action).sort(),
    ["resend-verification", "verify-email"],
  );

  assert.equal(doneMessage(await redirectedTo(adminActions.verifyAccountEmail(form({ userId: waiting.id })))), "Their email is already confirmed.");
  assert.equal(doneMessage(await redirectedTo(adminActions.resendAccountVerification(form({ userId: alice.id })))), "Their email is already confirmed.");
});

test("deleting an account needs the address typed, is blocked by a legal hold, and removes the account and its files", async () => {
  const { admin, viewer, alice } = await staff();
  await addPhoto(alice.id);
  assert.ok(filesOf(alice.id).length > 0);

  const wrong = await redirectedTo(adminActions.deleteAccountAsAdmin(form({ userId: alice.id, confirm: "nope" })));
  assert.equal(doneMessage(wrong), "Type the site's address to confirm.");
  assert.ok(await findUserById(alice.id));

  await updateUser(alice.id, (u) => {
    u.legalHold = { at: new Date().toISOString(), note: "case" };
  });
  const held = await redirectedTo(adminActions.deleteAccountAsAdmin(form({ userId: alice.id, confirm: alice.subdomain })));
  assert.match(doneMessage(held), /legal hold/);
  assert.ok(await findUserById(alice.id));
  assert.ok(filesOf(alice.id).length > 0, "files kept under a hold");

  await updateUser(alice.id, (u) => {
    delete u.legalHold;
  });
  const gone = await redirectedTo(adminActions.deleteAccountAsAdmin(form({ userId: alice.id, confirm: alice.subdomain.toUpperCase() })));
  assert.equal(gone?.split("?")[0], "/admin/accounts");
  assert.equal(await findUserById(alice.id), null);
  assert.deepEqual(filesOf(alice.id), []);
  const log = await adminActionsFor(alice.id);
  assert.equal(log.length, 1);
  assert.equal(log[0].action, "delete-account");
  assert.equal(log[0].adminEmail, admin.email);

  // Staff accounts can't be deleted from here.
  const refused = await redirectedTo(adminActions.deleteAccountAsAdmin(form({ userId: viewer.id, confirm: viewer.subdomain })));
  assert.match(doneMessage(refused), /can't be deleted here/);
  assert.ok(await findUserById(viewer.id));
});
