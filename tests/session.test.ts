import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import {
  createSession,
  deleteSession,
  getSessionUserId,
  hashPassword,
  verifyPassword,
} from "../lib/session.ts";
import { cookieJar } from "./stubs/next-headers.ts";

const DAY = 24 * 60 * 60 * 1000;

beforeEach(() => cookieJar.clear());

// The cookie is "<userId>.<expires>.<signature>".
async function sessionCookie(userId = "user-1") {
  await createSession(userId);
  const [id, expires, sig] = cookieJar.get("session")!.split(".");
  return { id, expires, sig };
}

test("a new session logs the user in, and logging out ends it", async () => {
  await createSession("user-1");
  assert.equal(await getSessionUserId(), "user-1");
  await deleteSession();
  assert.equal(await getSessionUserId(), null);
});

test("sessions last 30 days", async () => {
  const { expires } = await sessionCookie();
  const days = (Number(expires) - Date.now()) / DAY;
  assert.ok(days > 29.9 && days <= 30, `lasts ${days} days`);
});

test("changing the user id in the cookie logs nobody in", async () => {
  const { expires, sig } = await sessionCookie("user-1");
  cookieJar.set("session", `user-2.${expires}.${sig}`);
  assert.equal(await getSessionUserId(), null);
});

test("extending the expiry in the cookie logs nobody in", async () => {
  const { id, expires, sig } = await sessionCookie();
  cookieJar.set("session", `${id}.${Number(expires) + 365 * DAY}.${sig}`);
  assert.equal(await getSessionUserId(), null);
});

test("expired sessions log nobody in, even with a valid signature", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.now() });
  await createSession("user-1");
  t.mock.timers.tick(31 * DAY);
  assert.equal(await getSessionUserId(), null);
});

test("missing, malformed and forged cookies log nobody in", async () => {
  const { id, expires, sig } = await sessionCookie();
  for (const value of [
    "",
    "user-1",
    `${id}.${expires}`,
    `${id}.${expires}.`,
    `${id}.${expires}.${sig.slice(0, -1)}`,
    `${id}.${expires}.${"A".repeat(sig.length)}`,
    `${id}.${expires}.${sig}x`,
  ]) {
    cookieJar.set("session", value);
    assert.equal(await getSessionUserId(), null, `accepted ${JSON.stringify(value)}`);
  }
});

test("cookies signed with a different secret are refused", async (t) => {
  const old = process.env.SESSION_SECRET;
  t.after(() => {
    if (old === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = old;
  });
  process.env.SESSION_SECRET = "first-secret";
  await createSession("user-1");
  process.env.SESSION_SECRET = "second-secret";
  assert.equal(await getSessionUserId(), null);
});

test("passwords are salted and only the right one matches", async () => {
  const a = await hashPassword("correct horse");
  const b = await hashPassword("correct horse");
  assert.notEqual(a, b, "same password should hash differently");
  assert.ok(!a.includes("correct horse"));
  assert.equal(await verifyPassword("correct horse", a), true);
  assert.equal(await verifyPassword("correct horse", b), true);
  assert.equal(await verifyPassword("Correct horse", a), false);
  assert.equal(await verifyPassword("", a), false);
});

test("a damaged stored password matches nothing", async () => {
  for (const stored of ["", "nocolon", "salt:", ":abcd", "salt:zz", "salt:not-hex"]) {
    assert.equal(await verifyPassword("anything", stored), false, `matched ${JSON.stringify(stored)}`);
  }
});
