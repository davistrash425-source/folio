// Who is signed in (requireUser) and deleting an account (deleteAccount).
import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "fs";
import path from "path";
import { deleteAccount } from "../app/actions/auth.ts";
import { GET as exportAccount } from "../app/api/export/route.ts";
import { requireUser } from "../lib/auth.ts";
import { findUserById } from "../lib/db.ts";
import { UPLOAD_DIR } from "../lib/uploads.ts";
import { createToken, redeemToken } from "../lib/tokens.ts";
import { addAlbum, addInquiry, addPhoto, filesOf, formOf, fromIp, makeUser, redirectedTo, resetRequest, signInAs, signOut } from "./helpers.ts";
import { cookieJar } from "./stubs/next-headers.ts";

beforeEach(resetRequest);

// ── requireUser ─────────────────────────────────────────────────────────

test("requireUser returns the signed-in user and sends everyone else to the login page", async () => {
  const alice = await makeUser("Alice");
  const bob = await makeUser("Bob");

  signOut();
  assert.equal(await redirectedTo(requireUser()), "/login");

  await signInAs(alice);
  assert.equal((await requireUser()).id, alice.id);
  await signInAs(bob);
  assert.equal((await requireUser()).id, bob.id);

  cookieJar.set("session", `${alice.id}.99999999999999.forged-signature`);
  assert.equal(await redirectedTo(requireUser()), "/login", "a forged cookie");
});

// ── deleteAccount ───────────────────────────────────────────────────────

test("deleting an account removes that person's data and photos, and nobody else's", async () => {
  const alice = await makeUser("Alice", { password: "alice's password" });
  const bob = await makeUser("Bob", { password: "bob's password" });
  for (const user of [alice, bob]) {
    const { photo } = await addPhoto(user.id);
    await addAlbum(user.id, "Weddings", [photo.id]);
    await addInquiry(user.id, "hello");
  }
  const bobBefore = await findUserById(bob.id);
  const bobFiles = filesOf(bob.id);
  assert.ok(filesOf(alice.id).length > 0);
  const resetLink = await createToken(alice.id, "reset", 60_000);
  const bobsLink = await createToken(bob.id, "reset", 60_000);

  await signInAs(alice);
  assert.equal(await redirectedTo(deleteAccount({}, formOf({ password: "alice's password" }))), "/?deleted=1");

  assert.equal(await findUserById(alice.id), null);
  assert.equal(existsSync(path.join(UPLOAD_DIR, alice.id)), false, "her photo folder");
  assert.equal(await redeemToken(resetLink, "reset"), null, "her unused password-reset link");
  assert.equal(cookieJar.has("session"), false, "signed out");
  assert.deepEqual(await findUserById(bob.id), bobBefore);
  assert.deepEqual(filesOf(bob.id), bobFiles);
  assert.equal(await redeemToken(bobsLink, "reset"), bob.id, "Bob's own reset link still works");
});

test("the wrong password deletes nothing", async () => {
  const alice = await makeUser("Alice", { password: "alice's password" });
  await addPhoto(alice.id);
  await signInAs(alice);
  const before = await findUserById(alice.id);
  const files = filesOf(alice.id);

  assert.deepEqual(await deleteAccount({}, formOf({ password: "wrong" })), { error: "That password isn't right." });
  assert.deepEqual(await deleteAccount({}, formOf({})), { error: "That password isn't right." });
  assert.deepEqual(await findUserById(alice.id), before);
  assert.deepEqual(filesOf(alice.id), files);
  assert.equal((await requireUser()).id, alice.id, "still signed in");
});

test("Bob can't delete Alice's account, even knowing her password", async () => {
  const alice = await makeUser("Alice", { password: "alice's password" });
  const bob = await makeUser("Bob", { password: "bob's password" });
  await addPhoto(alice.id);
  const before = await findUserById(alice.id);
  const files = filesOf(alice.id);

  await signInAs(bob);
  const result = await deleteAccount({}, formOf({ password: "alice's password", userId: alice.id }));
  assert.deepEqual(result, { error: "That password isn't right." });
  assert.deepEqual(await findUserById(alice.id), before);
  assert.deepEqual(filesOf(alice.id), files);
  assert.ok(await findUserById(bob.id));
});

test("guessing the password to delete an account is limited to a few tries", async () => {
  const alice = await makeUser("Alice", { password: "alice's password" });
  await signInAs(alice);
  fromIp("203.0.113.40");
  for (let i = 0; i < 5; i++) {
    assert.deepEqual(await deleteAccount({}, formOf({ password: `guess ${i}` })), { error: "That password isn't right." });
  }
  const locked = await deleteAccount({}, formOf({ password: "alice's password" }));
  assert.match(locked.error!, /Too many attempts/, "even the right password is refused for a while");
  assert.ok(await findUserById(alice.id));
});

test("after an account is deleted, its old login cookie opens nothing", async () => {
  const alice = await makeUser("Alice", { password: "alice's password" });
  await signInAs(alice);
  const oldCookie = cookieJar.get("session")!;
  await redirectedTo(deleteAccount({}, formOf({ password: "alice's password" })));

  cookieJar.set("session", oldCookie); // another browser that was still signed in
  assert.equal(await redirectedTo(requireUser()), "/login");
  assert.equal((await exportAccount()).status, 401);
});
