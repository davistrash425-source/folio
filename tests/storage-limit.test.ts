// Storage use: every upload records the bytes it took, and an account can't
// pass its plan's storage limit.
import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "crypto";
import { uploadPhotos } from "../app/actions/site.ts";
import { findUserById, updateUser } from "../lib/db.ts";
import { FREE_STORAGE_LIMIT, PRO_STORAGE_LIMIT, storageLimit, storageUsed } from "../lib/plans.ts";
import { storage } from "../lib/uploads.ts";
import { filesOf, finishUpload, formWith, jpegFile, makeUser, resetRequest, signInAs, startUpload } from "./helpers.ts";

beforeEach(resetRequest);

const GB = 1024 ** 3;

// The account already holds `bytes` of photos, as one record without real files.
async function usingStorage(userId: string, bytes: number) {
  await updateUser(userId, (u) => {
    u.photos.push({ id: "old", file: "old.orig.jpg", createdAt: "", bytes });
  });
}

test("the limits are 50 GB on Pro and a smaller safety net on Free", () => {
  assert.equal(PRO_STORAGE_LIMIT, 50 * GB);
  assert.equal(storageLimit({ plan: "pro" }), 50 * GB);
  assert.equal(storageLimit({}), FREE_STORAGE_LIMIT);
  assert.ok(FREE_STORAGE_LIMIT < PRO_STORAGE_LIMIT);
});

test("used storage adds up the photos, and older photos without a size count as nothing", () => {
  const photos = [{ bytes: 100 }, { bytes: 250 }, {}].map((p, i) => ({ id: `${i}`, file: "", createdAt: "", ...p }));
  assert.equal(storageUsed({ photos }), 350);
});

test("the upload form records what each photo takes: the original plus its web copies", async () => {
  const alice = await makeUser("Alice");
  await signInAs(alice);
  const file = await jpegFile();
  await uploadPhotos({}, formWith(file));
  const [photo] = (await findUserById(alice.id))!.photos;
  assert.ok(photo.bytes! > file.size, "more than the original alone");
  const onDisk = await Promise.all(filesOf(alice.id).map((f) => storage.get(alice.id, f)));
  assert.equal(photo.bytes, onDisk.reduce((n, d) => n + d.length, 0), "exactly what is stored");
});

test("a direct upload records its size too", async () => {
  const alice = await makeUser("Alice");
  await signInAs(alice);
  const file = `${randomUUID()}.orig.jpg`;
  await storage.put(alice.id, file, Buffer.from(await (await jpegFile()).arrayBuffer()));
  await finishUpload(file);
  const [photo] = (await findUserById(alice.id))!.photos;
  const onDisk = await Promise.all(filesOf(alice.id).map((f) => storage.get(alice.id, f)));
  assert.equal(photo.bytes, onDisk.reduce((n, d) => n + d.length, 0));
});

test("a Free account out of storage can't upload, and the photo that crossed the line is deleted", async () => {
  const alice = await makeUser("Alice");
  await signInAs(alice);
  await usingStorage(alice.id, FREE_STORAGE_LIMIT - 10);
  const result = await uploadPhotos({}, formWith(await jpegFile()));
  assert.match(result.error!, /used all 5 GB of storage/);
  assert.equal((await findUserById(alice.id))!.photos.length, 1);
  assert.deepEqual(filesOf(alice.id), [], "the new photo's files are gone");
});

test("starting a direct upload that can't fit is refused before anything is sent", async () => {
  const alice = await makeUser("Alice");
  await signInAs(alice);
  await usingStorage(alice.id, FREE_STORAGE_LIMIT - 500);
  assert.match(String((await startUpload("image/jpeg", 1000) as { error?: string }).error), /used all 5 GB/);
  assert.deepEqual(await startUpload("image/jpeg", 400), {}, "a smaller photo still fits");
});

test("a direct upload that finishes over the limit is refused and deleted", async () => {
  const alice = await makeUser("Alice");
  await signInAs(alice);
  await usingStorage(alice.id, FREE_STORAGE_LIMIT - 10);
  const file = `${randomUUID()}.orig.jpg`;
  await storage.put(alice.id, file, Buffer.from(await (await jpegFile()).arrayBuffer()));
  assert.match(String((await finishUpload(file) as { error?: string }).error), /used all 5 GB/);
  assert.deepEqual(filesOf(alice.id), []);
  assert.equal((await findUserById(alice.id))!.photos.length, 1);
});

test("Pro has room where Free doesn't", async () => {
  const alice = await makeUser("Alice");
  await signInAs(alice);
  await updateUser(alice.id, (u) => void (u.plan = "pro"));
  await usingStorage(alice.id, FREE_STORAGE_LIMIT + GB);
  assert.equal((await uploadPhotos({}, formWith(await jpegFile()))).ok, "Uploaded 1 photo.");
  await usingStorage(alice.id, PRO_STORAGE_LIMIT);
  assert.match((await uploadPhotos({}, formWith(await jpegFile()))).error!, /used all 50 GB/);
});

test("an account already over its storage keeps its photos but can't add more", async () => {
  const alice = await makeUser("Alice");
  await signInAs(alice);
  await usingStorage(alice.id, FREE_STORAGE_LIMIT + GB);
  assert.match((await uploadPhotos({}, formWith(await jpegFile()))).error!, /used all 5 GB/);
  assert.equal((await findUserById(alice.id))!.photos.length, 1);
});
