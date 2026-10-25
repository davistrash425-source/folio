import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { utimes } from "fs/promises";
import path from "path";
import { GET as daily } from "../app/api/cron/daily/route.ts";
import { deleteAccount } from "../app/actions/auth.ts";
import { DRAFT_REMINDER_AFTER_DAYS, removeAccountFiles, removeOrphanedOriginals, retryStorageCleanups, sendDraftReminders } from "../lib/cleanup.ts";
import { deleteUser, findUserById, pendingStorageCleanups, updateUser } from "../lib/db.ts";
import { UPLOAD_DIR, storage } from "../lib/uploads.ts";
import { addPhoto, captureEmails, filesOf, formOf, makeUser, redirectedTo, resetRequest, signInAs } from "./helpers.ts";

beforeEach(resetRequest);

const DAY = 24 * 60 * 60 * 1000;
const oldOriginal = async (userId: string, name: string, ageMs: number) => {
  await storage.put(userId, name, Buffer.from("x"));
  const when = new Date(Date.now() - ageMs);
  await utimes(path.join(UPLOAD_DIR, userId, name), when, when);
};

test("old originals with no photo are deleted; recent ones and real photos stay", async () => {
  const alice = await makeUser("Alice");
  const { photo } = await addPhoto(alice.id);
  await oldOriginal(alice.id, "11111111-1111-1111-1111-111111111111.orig.jpg", 2 * DAY); // never finished
  await oldOriginal(alice.id, "22222222-2222-2222-2222-222222222222.orig.jpg", 60_000); // still uploading
  await oldOriginal(alice.id, photo.file, 3 * DAY); // a real photo, however old

  const result = await removeOrphanedOriginals();
  assert.equal(result.removed, 1);
  const left = filesOf(alice.id);
  assert.ok(!left.includes("11111111-1111-1111-1111-111111111111.orig.jpg"));
  assert.ok(left.includes("22222222-2222-2222-2222-222222222222.orig.jpg"));
  assert.ok(left.includes(photo.file));
});

test("deleting an account queues its files, and they're cleared once removed", async () => {
  const alice = await makeUser("Alice");
  await addPhoto(alice.id);
  await deleteUser(alice.id);
  assert.ok((await pendingStorageCleanups()).includes(alice.id));
  assert.equal(await removeAccountFiles(alice.id), true);
  assert.ok(!(await pendingStorageCleanups()).includes(alice.id));
  assert.deepEqual(filesOf(alice.id), []);
});

test("if storage fails when an account is deleted, the account is still gone and the daily job finishes the job", async (t) => {
  const alice = await makeUser("Alice", { password: "correct horse" });
  await addPhoto(alice.id);
  await signInAs(alice);
  t.mock.method(console, "error", () => {});
  const removeAll = t.mock.method(storage, "removeAll", async () => {
    throw new Error("R2 is down");
  });
  await redirectedTo(deleteAccount({}, formOf({ password: "correct horse" })));
  assert.equal(await findUserById(alice.id), null);
  assert.ok((await pendingStorageCleanups()).includes(alice.id), "still waiting");
  assert.ok(filesOf(alice.id).length > 0);

  removeAll.mock.restore();
  const retried = await retryStorageCleanups();
  assert.ok(retried.done >= 1);
  assert.deepEqual(filesOf(alice.id), []);
  assert.ok(!(await pendingStorageCleanups()).includes(alice.id));
});

test("a verified draft site gets one reminder after a few days, and no more", async (t) => {
  const emails = captureEmails(t);
  const alice = await makeUser("Alice", { published: false });
  const young = await makeUser("Young", { published: false });
  const live = await makeUser("Live");
  const unverified = await makeUser("Unverified", { published: false, verified: false });
  const old = new Date(Date.now() - (DRAFT_REMINDER_AFTER_DAYS + 1) * DAY).toISOString();
  for (const u of [alice, live, unverified]) await updateUser(u.id, (x) => void (x.createdAt = old));

  await sendDraftReminders();
  const mail = () => emails.join("\n");
  assert.equal(emails.length, 1);
  assert.ok(mail().includes(alice.email));
  assert.match(mail(), /\/dashboard\/manage\/publish/);
  for (const other of [young, live, unverified]) assert.ok(!mail().includes(other.email), `${other.email} wasn't reminded`);
  await sendDraftReminders();
  assert.equal(emails.length, 1, "only one reminder, ever");
});

test("the daily job only runs for Vercel's cron, with the secret", async (t) => {
  t.mock.method(console, "error", () => {});
  const call = (auth?: string) => daily(new Request("https://folio.cam/api/cron/daily", { headers: auth ? { authorization: auth } : {} }));
  assert.equal((await call("Bearer anything")).status, 404, "closed when no secret is set");
  process.env.CRON_SECRET = "s3cret";
  t.after(() => void delete process.env.CRON_SECRET);
  assert.equal((await call()).status, 404);
  assert.equal((await call("Bearer wrong")).status, 404);
  const ok = await call("Bearer s3cret");
  assert.equal(ok.status, 200);
  assert.deepEqual(Object.keys(await ok.json()), ["closedAccounts", "unfinishedUploads", "draftReminders"]);
});
