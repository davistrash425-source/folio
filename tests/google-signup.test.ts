// "Continue with Google": finishing a new account, and deleting an account
// that has no password.
import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { completeGoogleSignup, deleteAccount } from "../app/actions/auth.ts";
import { createUser, findUserByEmail, findUserById } from "../lib/db.ts";
import { clearGoogleSignup, stashGoogleSignup } from "../lib/google.ts";
import { hashPassword, verifyPassword } from "../lib/session.ts";
import { databaseText, formOf, fromIp, makeUser, redirectedTo, resetRequest, signInAs } from "./helpers.ts";

beforeEach(resetRequest);

const identity = { googleId: "google-123", email: "dana@gmail.com", name: "Dana Photog" };

test("a Google sign-up creates a confirmed account with no password", async () => {
  fromIp("198.51.100.21");
  await stashGoogleSignup(identity);
  assert.equal(await redirectedTo(completeGoogleSignup({}, formOf({ name: "Dana", subdomain: "dana-g" }))), "/dashboard");

  const user = (await findUserByEmail("dana@gmail.com"))!;
  assert.equal(user.googleId, "google-123");
  assert.equal(user.passwordHash, "");
  assert.equal(user.emailVerified, true);
  assert.equal(user.profile.name, "Dana");
});

test("a Google sign-up needs a valid, free address", async () => {
  const davi = await makeUser("Davi");
  fromIp("198.51.100.22");
  await stashGoogleSignup(identity);
  const before = await databaseText();

  assert.match((await completeGoogleSignup({}, formOf({ name: "Dana", subdomain: "no" }))).error!, /3–30 lowercase/);
  assert.match((await completeGoogleSignup({}, formOf({ name: "Dana", subdomain: davi.subdomain }))).error!, /taken/);
  assert.equal(await databaseText(), before, "nothing was created for a bad address");
});

test("a Google sign-up without the pending identity goes nowhere", async () => {
  await clearGoogleSignup();
  fromIp("198.51.100.23");
  const before = await databaseText();
  const result = await completeGoogleSignup({}, formOf({ name: "Dana", subdomain: "dana-h" }));
  assert.match(result.error!, /expired/);
  assert.equal(await databaseText(), before, "nothing was created");
});

test("a Google-only account is deleted by typing its address, not a password", async () => {
  const user = await createUser({
    name: "Dana",
    email: "dana2@gmail.com",
    subdomain: "dana2",
    passwordHash: "",
    published: true,
    googleId: "google-2",
    emailVerified: true,
  });
  await signInAs(user);
  fromIp("198.51.100.24");

  assert.match((await deleteAccount({}, formOf({ confirm: "wrong" }))).error!, /address to confirm/);
  assert.ok(await findUserById(user.id), "still there after a wrong confirmation");

  assert.equal(await redirectedTo(deleteAccount({}, formOf({ confirm: user.subdomain }))), "/?deleted=1");
  assert.equal(await findUserById(user.id), null);
});

test("an account with a password still deletes by its password", async () => {
  const password = "a long password";
  const user = await makeUser("Dana", { password });
  await signInAs(user);
  assert.match((await deleteAccount({}, formOf({ password: "wrong" }))).error!, /password/);
  assert.ok(await findUserById(user.id));

  assert.equal(await redirectedTo(deleteAccount({}, formOf({ password }))), "/?deleted=1");
  assert.equal(await findUserById(user.id), null);
});

test("a passwordless account has no password that matches anything", async () => {
  assert.equal(await verifyPassword("anything", ""), false);
  assert.equal(await verifyPassword("", await hashPassword("a real password")), false);
});
