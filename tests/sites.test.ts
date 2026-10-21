// Admins' extra sites (app/actions/sites.ts): creating them, switching
// between them, and who can reach them.
import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { deleteAccount, logout, signup } from "../app/actions/auth.ts";
import { createSite, switchSite } from "../app/actions/sites.ts";
import { requireAdmin } from "../lib/admin.ts";
import { currentAdmin, currentUser } from "../lib/auth.ts";
import { findUserById, findUserBySubdomain, managedSites } from "../lib/db.ts";
import { siteData } from "../lib/public-site.ts";
import { formOf, fromIp, makeUser, redirectedTo, resetRequest, signInAs, signOut } from "./helpers.ts";
import { NotFoundError } from "./stubs/next-navigation.ts";
import { cookieJar } from "./stubs/next-headers.ts";

beforeEach(resetRequest);
afterEach(() => {
  delete process.env.ADMIN_EMAILS;
});

let n = 0;
async function signedInAdmin() {
  const admin = await makeUser("Admin");
  process.env.ADMIN_EMAILS = admin.email;
  await signInAs(admin);
  return admin;
}

// Creates an extra site as the signed-in admin and returns it (now signed in).
async function newSite(name = "Extra") {
  const subdomain = `extra-site-${++n}`;
  assert.equal(await redirectedTo(createSite({}, formOf({ name, subdomain }))), "/dashboard/manage/upload");
  return (await findUserBySubdomain(subdomain))!;
}

test("an admin can create as many sites as they like, each live and signed in straight away", async () => {
  const admin = await signedInAdmin();
  const one = await newSite("Weddings");
  assert.equal((await currentUser())!.id, one.id, "the dashboard now shows the new site");
  assert.equal(one.managedBy, admin.id);
  assert.equal(one.profile.name, "Weddings");
  assert.equal(one.profile.contactEmail, admin.email, "its messages go to the admin");
  assert.ok(siteData(one), "live without confirming an email");

  await switchSite(admin.id).catch(() => {});
  await newSite();
  await newSite();
  assert.equal((await managedSites(admin.id)).length, 3);
});

test("people who aren't admins can't create sites or switch to one", async () => {
  const admin = await signedInAdmin();
  const extra = await newSite();
  const alice = await makeUser("Alice");
  await signInAs(alice);
  await assert.rejects(createSite({}, formOf({ name: "Mine", subdomain: "alice-second" })), NotFoundError);
  await assert.rejects(switchSite(extra.id), NotFoundError);
  await assert.rejects(switchSite(admin.id), NotFoundError);
  assert.equal((await currentUser())!.id, alice.id);
  assert.equal(await findUserBySubdomain("alice-second"), null);

  signOut();
  assert.equal(await redirectedTo(createSite({}, formOf({ name: "Mine", subdomain: "nobody-site" }))), "/login");
  assert.equal(await redirectedTo(switchSite(extra.id)), "/login");
});

test("an admin switches between their own site and their extra sites, but not to anyone else's", async () => {
  const admin = await signedInAdmin();
  const extra = await newSite();
  assert.equal(await redirectedTo(switchSite(admin.id)), "/dashboard/manage/photos");
  assert.equal((await currentUser())!.id, admin.id);
  assert.equal(await redirectedTo(switchSite(extra.id)), "/dashboard/manage/photos");
  assert.equal((await currentUser())!.id, extra.id);
  assert.equal((await currentAdmin())!.id, admin.id);
  assert.equal((await requireAdmin()).id, admin.id, "the admin pages still work from an extra site");

  const alice = await makeUser("Alice");
  await assert.rejects(switchSite(alice.id), NotFoundError);
  const otherAdmin = await makeUser("Other admin");
  process.env.ADMIN_EMAILS = `${admin.email},${otherAdmin.email}`;
  await signInAs(otherAdmin);
  await assert.rejects(switchSite(extra.id), NotFoundError, "another admin's site");
});

test("an extra site's login cookie doesn't work on its own, nor once its admin is no longer an admin", async () => {
  const admin = await signedInAdmin();
  const extra = await newSite();
  assert.ok(await currentUser());

  const manager = cookieJar.get("manager")!;
  cookieJar.delete("manager");
  assert.equal(await currentUser(), null, "without the admin's cookie");
  cookieJar.set("manager", manager);

  process.env.ADMIN_EMAILS = "";
  assert.equal(await currentUser(), null, "the admin was removed");
  process.env.ADMIN_EMAILS = admin.email;
  assert.equal((await currentUser())!.id, extra.id);
});

test("the admin's cookie can't be used as a login cookie", async () => {
  await signedInAdmin();
  await newSite();
  cookieJar.set("session", cookieJar.get("manager")!);
  cookieJar.delete("manager");
  assert.equal(await currentUser(), null);
});

test("logging out from an extra site signs the admin out completely", async () => {
  await signedInAdmin();
  await newSite();
  await redirectedTo(logout());
  assert.equal(cookieJar.size, 0);
  assert.equal(await currentUser(), null);
});

test("extra sites need a free, valid address", async () => {
  const admin = await signedInAdmin();
  const alice = await makeUser("Alice");
  assert.match((await createSite({}, formOf({ name: "X", subdomain: alice.subdomain }))).error!, /taken/);
  assert.match((await createSite({}, formOf({ name: "X", subdomain: "support" }))).error!, /reserved/);
  assert.match((await createSite({}, formOf({ name: "", subdomain: "fine-name" }))).error!, /name/);
  assert.equal((await managedSites(admin.id)).length, 0);
});

test("deleting an extra site takes the admin back to their own site and keeps its address for them only", async () => {
  const admin = await signedInAdmin();
  const extra = await newSite();
  assert.match((await deleteAccount({}, formOf({ confirm: "wrong" }))).error!, /Type the site's address/);
  assert.equal(await redirectedTo(deleteAccount({}, formOf({ confirm: extra.subdomain }))), "/dashboard/manage/photos");
  assert.equal(await findUserById(extra.id), null);
  assert.equal((await currentUser())!.id, admin.id);

  fromIp("198.51.100.150");
  const fields = { name: "Someone", email: "someone-else@example.com", password: "a long password", subdomain: extra.subdomain };
  assert.match((await signup({}, formOf(fields))).error!, /held for a year/);
  await signInAs(admin);
  assert.equal(await redirectedTo(createSite({}, formOf({ name: "Again", subdomain: extra.subdomain }))), "/dashboard/manage/upload");
});

test("deleting an admin's account deletes their extra sites too", async () => {
  const admin = await makeUser("Admin", { password: "admin password" });
  process.env.ADMIN_EMAILS = admin.email;
  await signInAs(admin);
  const one = await newSite();
  await switchSite(admin.id).catch(() => {});
  const two = await newSite();
  await switchSite(admin.id).catch(() => {});

  assert.equal(await redirectedTo(deleteAccount({}, formOf({ password: "admin password" }))), "/?deleted=1");
  for (const account of [admin, one, two]) assert.equal(await findUserById(account.id), null);
});
