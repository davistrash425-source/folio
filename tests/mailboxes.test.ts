// Real mail addresses (lib/mailboxes.ts): a used name is never given to
// anyone else, because a new owner would receive the old owner's mail.
import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { setAgentsAccess } from "../app/actions/admin.ts";
import { signup } from "../app/actions/auth.ts";
import { changeAddress } from "../app/actions/site.ts";
import { createSite } from "../app/actions/sites.ts";
import { addressStatus } from "../lib/address.ts";
import { claimMailbox, createUser, deleteUsers, findMailbox, findUserBySubdomain, mailboxTaken, mailboxesOf, updateUser } from "../lib/db.ts";
import { ensureMailbox, isReservedLocalPart, mailDomain, mailboxBlock, normalizeLocalPart, primaryAddress } from "../lib/mailboxes.ts";
import { database } from "../lib/pg.ts";
import { formOf, fromIp, makeUser, redirectedTo, resetRequest, signInAs } from "./helpers.ts";

beforeEach(() => {
  resetRequest();
  process.env.MAIL_DOMAIN = "mail.test";
});
afterEach(() => {
  delete process.env.MAIL_DOMAIN;
  delete process.env.ADMIN_EMAILS;
});

const agentsOn = (id: string) =>
  updateUser(id, (u) => {
    u.agents = { enabled: true, at: new Date().toISOString(), by: "test" };
  });

async function backdateHold(subdomain: string) {
  const db = await database();
  await db.query("update released_subdomains set released_at = now() - interval '5 years' where subdomain = $1", [subdomain]);
}

test("reserved role names are refused, whatever the case", () => {
  for (const name of ["postmaster", "Support", " ABUSE ", "no-reply", "mailer-daemon", "www"]) {
    assert.equal(isReservedLocalPart(name), true, name);
  }
  assert.equal(isReservedLocalPart("maya"), false);
});

test("names with odd characters are refused", () => {
  assert.equal(normalizeLocalPart("  Maya-Lens "), "maya-lens");
  for (const bad of ["a.b", "a+b", "a b", "é", "a@b", "", "a_b"]) assert.equal(normalizeLocalPart(bad), null, bad);
});

test("the first account to claim a name gets it; another is refused; the same one can claim again", async () => {
  const a = await makeUser("Anna");
  const b = await makeUser("Ben");
  assert.equal(await claimMailbox(a.id, "shared-name"), true);
  assert.equal(await claimMailbox(b.id, "shared-name"), false);
  assert.equal(await claimMailbox(a.id, "shared-name"), true);
  assert.equal((await findMailbox("SHARED-name"))!.user_id, a.id);
  assert.equal(await mailboxTaken("shared-name", a.id), false);
  assert.equal(await mailboxTaken("shared-name", b.id), true);
  assert.equal(await mailboxTaken("shared-name"), true);
});

test("everything is off without MAIL_DOMAIN", async () => {
  delete process.env.MAIL_DOMAIN;
  const user = await makeUser("Quiet");
  assert.equal(mailDomain(), null);
  assert.equal(await ensureMailbox(user), null);
  assert.equal(await primaryAddress(user), null);
  assert.deepEqual(await mailboxesOf(user.id), []);
});

test("an account gets its subdomain as its address, and a reserved subdomain gets none", async () => {
  const user = await makeUser("Maya");
  assert.equal(await ensureMailbox(user), `${user.subdomain}@mail.test`);
  assert.equal(await ensureMailbox(user), `${user.subdomain}@mail.test`, "twice is fine");
  assert.equal(await primaryAddress(user), `${user.subdomain}@mail.test`);
  assert.equal(await ensureMailbox({ id: user.id, subdomain: "postmaster" }), null);
  assert.equal(await findMailbox("postmaster"), null);
});

test("another account's mailbox is not taken over by ensureMailbox", async () => {
  const a = await makeUser("Anna");
  const b = await makeUser("Ben");
  await claimMailbox(a.id, b.subdomain);
  assert.equal(await ensureMailbox(b), null);
  assert.equal((await findMailbox(b.subdomain))!.user_id, a.id);
});

test("deleting an account keeps its mailbox with no user id, and the name can't be claimed or used again, even after the hold passes", async () => {
  const old = await makeUser("Gone");
  const name = old.subdomain;
  await ensureMailbox(old);
  await deleteUsers([old.id]);

  const row = (await findMailbox(name))!;
  assert.equal(row.user_id, null);
  assert.ok(row.retired_at);
  assert.equal(await mailboxTaken(name), true);

  await backdateHold(name);
  const newcomer = await makeUser("Newcomer");
  assert.equal(await claimMailbox(newcomer.id, name), false);
  assert.ok(await mailboxBlock(name, newcomer.id));
  assert.equal((await addressStatus(name)).status, "invalid");

  fromIp("198.51.100.20");
  const fields = { name: "New", email: "new-owner@example.com", password: "a long password", subdomain: name, terms: "on" };
  assert.match((await signup({}, formOf(fields))).error!, /used for mail/);
  assert.equal(await findUserBySubdomain(name), null);

  await signInAs(newcomer);
  assert.match((await changeAddress({}, formOf({ subdomain: name }))).error!, /used for mail/);
  await assert.rejects(
    createUser({ name: "X", email: "x-direct@example.com", passwordHash: "x", subdomain: name, published: true }),
    /SUBDOMAIN_TAKEN/,
    "even straight through the data layer",
  );
});

test("an account on legal hold keeps its mailbox as it was", async () => {
  const held = await makeUser("Held");
  await ensureMailbox(held);
  await updateUser(held.id, (u) => {
    u.legalHold = { at: new Date().toISOString(), note: "case" };
  });
  await assert.rejects(deleteUsers([held.id]), /LEGAL_HOLD/);
  const row = (await findMailbox(held.subdomain))!;
  assert.equal(row.user_id, held.id);
  assert.equal(row.retired_at, null);
});

test("renaming keeps the old mailbox on the same account, and nobody else can take either name", async () => {
  const user = await makeUser("Mover");
  const old = user.subdomain;
  await agentsOn(user.id);
  await ensureMailbox(user);
  await signInAs(user);
  assert.ok((await changeAddress({}, formOf({ subdomain: `${old}-new` }))).ok);

  const boxes = (await mailboxesOf(user.id)).map((m) => m.localPart);
  assert.deepEqual(boxes.sort(), [old, `${old}-new`].sort());
  assert.equal((await findMailbox(old))!.user_id, user.id);
  assert.equal(await primaryAddress(user), `${old}-new@mail.test`, "the newest is the primary one");

  const other = await makeUser("Other");
  await signInAs(other);
  assert.match((await changeAddress({}, formOf({ subdomain: old }))).error!, /used for mail|held/);
  assert.equal(await claimMailbox(other.id, old), false);

  await signInAs(user);
  assert.ok((await changeAddress({}, formOf({ subdomain: old }))).ok, "the owner can move back");
});

test("sign-up and address change refuse a reserved name", async () => {
  fromIp("198.51.100.21");
  const fields = { name: "Rex", email: "rex-root@example.com", password: "a long password", subdomain: "postmaster", terms: "on" };
  assert.match((await signup({}, formOf(fields))).error!, /reserved/);
  const user = await makeUser("Rex");
  await signInAs(user);
  assert.match((await changeAddress({}, formOf({ subdomain: "hostmaster" }))).error!, /reserved/);
  assert.equal((await addressStatus("noreply")).status, "invalid");
});

test("the admin's new-site tool refuses a reserved name and a name held in mailboxes, override or not", async () => {
  const admin = await makeUser("Boss");
  process.env.ADMIN_EMAILS = admin.email;
  await signInAs(admin);

  assert.match((await createSite({}, formOf({ name: "R", subdomain: "abuse", override: "on" }))).error!, /reserved/);

  const old = await makeUser("Late");
  await ensureMailbox(old);
  await deleteUsers([old.id]);
  const refused = await createSite({}, formOf({ name: "Mine", subdomain: old.subdomain, override: "on" }));
  assert.match(refused.error!, /used for mail/);
  assert.equal(await findUserBySubdomain(old.subdomain), null);
});

test("an admin's address change can't override a held mailbox name either", async () => {
  const admin = await makeUser("Boss");
  process.env.ADMIN_EMAILS = admin.email;
  const old = await makeUser("Late");
  await ensureMailbox(old);
  await deleteUsers([old.id]);
  await signInAs(admin);
  const refused = await changeAddress({}, formOf({ subdomain: old.subdomain, override: "on" }));
  assert.match(refused.error!, /used for mail/);
  assert.equal(await findUserBySubdomain(old.subdomain), null);
});

test("switching the agents on creates the mailbox", async () => {
  const admin = await makeUser("Boss");
  const friend = await makeUser("Friend");
  process.env.ADMIN_EMAILS = admin.email;
  await signInAs(admin);
  assert.equal(await primaryAddress(friend), null);
  await redirectedTo(setAgentsAccess(formOf({ userId: friend.id, enabled: "on" })));
  assert.equal(await primaryAddress(friend), `${friend.subdomain}@mail.test`);
});

test("switching the agents on does nothing harmful without MAIL_DOMAIN", async () => {
  delete process.env.MAIL_DOMAIN;
  const admin = await makeUser("Boss");
  const friend = await makeUser("Friend");
  process.env.ADMIN_EMAILS = admin.email;
  await signInAs(admin);
  await redirectedTo(setAgentsAccess(formOf({ userId: friend.id, enabled: "on" })));
  assert.deepEqual(await mailboxesOf(friend.id), []);
});
