import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, scryptSync } from "crypto";
import { login } from "../app/actions/auth.ts";
import { findUserById, updateUser } from "../lib/db.ts";
import { formOf, fromIp, makeUser, redirectedTo, resetRequest } from "./helpers.ts";

beforeEach(() => resetRequest());

test("the right password logs in", async () => {
  const alice = await makeUser("Alice", { password: "correct horse" });
  fromIp("203.0.113.10");
  assert.equal(await redirectedTo(login({}, formOf({ email: alice.email, password: "correct horse" }))), "/dashboard");
});

test("an unknown email and a wrong password get the same answer", async () => {
  const alice = await makeUser("Alice", { password: "correct horse" });
  fromIp("203.0.113.11");
  const wrong = await login({}, formOf({ email: alice.email, password: "nope nope" }));
  const unknown = await login({}, formOf({ email: "nobody@example.com", password: "nope nope" }));
  assert.equal(wrong.error, "Wrong email or password.");
  assert.equal(unknown.error, wrong.error);
});

test("someone guessing from one address is stopped, but can't lock the owner out from elsewhere", async () => {
  const alice = await makeUser("Alice", { password: "correct horse" });
  fromIp("198.51.100.20");
  for (let i = 0; i < 5; i++) await login({}, formOf({ email: alice.email, password: `guess ${i}` }));
  const stopped = await login({}, formOf({ email: alice.email, password: "correct horse" }));
  assert.match(stopped.error!, /Too many attempts/, "the guesser is stopped, even with the right password");

  fromIp("192.0.2.77"); // Alice, on her own connection
  assert.equal(await redirectedTo(login({}, formOf({ email: alice.email, password: "correct horse" }))), "/dashboard");
});

test("one address trying many accounts is stopped", async () => {
  fromIp("198.51.100.30");
  for (let i = 0; i < 30; i++) await login({}, formOf({ email: `nobody-${i}@example.com`, password: "x" }));
  const stopped = await login({}, formOf({ email: "another@example.com", password: "x" }));
  assert.match(stopped.error!, /Too many attempts/);
});

test("logging in with an old-cost password upgrades the hash", async () => {
  const alice = await makeUser("Alice");
  const salt = randomBytes(16).toString("hex");
  const legacy = `${salt}:${scryptSync("correct horse", salt, 64).toString("hex")}`;
  await updateUser(alice.id, (u) => void (u.passwordHash = legacy));

  fromIp("203.0.113.40");
  await redirectedTo(login({}, formOf({ email: alice.email, password: "correct horse" })));
  assert.match((await findUserById(alice.id))!.passwordHash, /^v2:/, "re-hashed at the current cost");
});
