// Finishing a direct upload must never publish a photo again: not one Folio
// has taken down, not one already in the account, and nothing at all from a
// suspended site.
import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "crypto";
import { findUserById, updateUser } from "../lib/db.ts";
import { deleteWebCopies, storage } from "../lib/uploads.ts";
import { addPhoto, filesOf, finishUpload, jpegFile, makeUser, resetRequest, signInAs } from "./helpers.ts";

beforeEach(resetRequest);

test("finishing the upload of a photo taken down by Folio doesn't put its web copies back", async (t) => {
  const alice = await makeUser("Alice");
  const { photo } = await addPhoto(alice.id, { removed: { at: new Date().toISOString() } });
  await deleteWebCopies(alice.id, photo); // what the takedown does
  await signInAs(alice);
  const put = t.mock.method(storage, "put", async () => {});

  const result = await finishUpload(photo.file);
  assert.match(result.error, /taken down/);
  assert.equal(put.mock.callCount(), 0, "nothing was written");
  assert.deepEqual(filesOf(alice.id), [photo.file], "only the private original is there");
});

test("finishing a photo that's already in the account writes nothing and adds nothing", async (t) => {
  const alice = await makeUser("Alice");
  const { photo } = await addPhoto(alice.id);
  await signInAs(alice);
  const put = t.mock.method(storage, "put", async () => {});

  assert.equal((await finishUpload(photo.file)).ok, "Uploaded 1 photo.");
  assert.equal(put.mock.callCount(), 0);
  assert.equal((await findUserById(alice.id))!.photos.length, 1);
});

test("a suspended site can't finish an upload, and nothing is written", async (t) => {
  const alice = await makeUser("Alice");
  await updateUser(alice.id, (u) => void (u.suspended = { at: new Date().toISOString(), reason: "a test" }));
  await signInAs(alice);
  const file = `${randomUUID()}.orig.jpg`;
  await storage.put(alice.id, file, Buffer.from(await (await jpegFile()).arrayBuffer()));
  const put = t.mock.method(storage, "put", async () => {});

  assert.match(String((await finishUpload(file)).error), /suspended/);
  assert.equal(put.mock.callCount(), 0);
  assert.equal((await findUserById(alice.id))!.photos.length, 0);
  assert.deepEqual(filesOf(alice.id), [file]);
});
