// Direct uploads: the browser sends a photo straight to storage (R2 in
// production), then finishPhotoUpload checks it and adds it to the account.
import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { finishPhotoUpload, startPhotoUpload } from "../app/actions/site.ts";
import { findUserById } from "../lib/db.ts";
import { MAX_PHOTO_BYTES, r2Storage, storage } from "../lib/uploads.ts";
import { filesOf, makeUser, resetRequest, signInAs } from "./helpers.ts";

beforeEach(resetRequest);

const original = () => `${randomUUID()}.orig.jpg`;
const jpeg = () => sharp({ create: { width: 1600, height: 1000, channels: 3, background: "#446688" } }).jpeg().toBuffer();

test("on the local disk there's no direct address, so the browser uploads through the app", async () => {
  await signInAs(await makeUser("Alice"));
  assert.deepEqual(await startPhotoUpload("image/jpeg", 5_000_000), {});
});

test("only photos of an allowed type and size are given an upload address", async () => {
  await signInAs(await makeUser("Alice"));
  assert.deepEqual(await startPhotoUpload("image/svg+xml", 1000), { error: "not a JPG, PNG, WebP, GIF or AVIF" });
  assert.deepEqual(await startPhotoUpload("image/jpeg", MAX_PHOTO_BYTES + 1), { error: "over 20 MB" });
  assert.deepEqual(await startPhotoUpload("image/jpeg", -1), { error: "over 20 MB" }, "nonsense sizes too");
});

test("finishing an upload adds the photo with its web copies, once however often it's called", async () => {
  const alice = await makeUser("Alice");
  await signInAs(alice);
  const file = original();
  await storage.put(alice.id, file, await jpeg()); // what the browser sent

  assert.deepEqual(await finishPhotoUpload(file), { ok: "Uploaded 1 photo." });
  await finishPhotoUpload(file);
  const photos = (await findUserById(alice.id))!.photos;
  assert.equal(photos.length, 1);
  assert.equal(photos[0].file, file);
  assert.equal(photos[0].id, file.split(".")[0]);
  assert.deepEqual(photos[0].variants, [640, 1280, 1600]);
  assert.equal(filesOf(alice.id).length, 4, "the original and three web copies");
});

test("a file that isn't an image is refused and deleted", async () => {
  const alice = await makeUser("Alice");
  await signInAs(alice);
  const file = original();
  await storage.put(alice.id, file, Buffer.from("<html>not a photo</html>"));
  assert.deepEqual(await finishPhotoUpload(file), { error: "couldn't be read as an image" });
  assert.deepEqual(filesOf(alice.id), []);
  assert.equal((await findUserById(alice.id))!.photos.length, 0);
});

test("only names the server hands out can be finished", async () => {
  const alice = await makeUser("Alice");
  await signInAs(alice);
  for (const name of ["../x.orig.jpg", "photo.jpg", `${randomUUID()}-640.webp`, `${randomUUID()}.orig.svg`, "nothing-uploaded"]) {
    assert.deepEqual(await finishPhotoUpload(name), { error: "couldn't be read as an image" }, name);
  }
  assert.deepEqual(await finishPhotoUpload(original()), { error: "couldn't be read as an image" }, "never uploaded");
  assert.equal((await findUserById(alice.id))!.photos.length, 0);
});

test("a photo uploaded to someone else's folder can't be claimed", async () => {
  const alice = await makeUser("Alice");
  const bob = await makeUser("Bob");
  const file = original();
  await storage.put(alice.id, file, await jpeg());
  await signInAs(bob);
  assert.deepEqual(await finishPhotoUpload(file), { error: "couldn't be read as an image" });
  assert.equal((await findUserById(bob.id))!.photos.length, 0);
  assert.equal(filesOf(alice.id).length, 1, "Alice's file is untouched");
});

test("R2 upload addresses go to the private bucket, are signed, expire, and fix the type and size", async () => {
  const r2 = r2Storage({
    accountId: "acct",
    accessKeyId: "key",
    secretAccessKey: "secret",
    publicBucket: "folio-public",
    privateBucket: "folio-private",
    publicUrl: "https://photos.example.com",
  });
  const url = new URL(await r2.uploadUrl!("u1", "abc.orig.jpg", "image/jpeg", 12345));
  assert.equal(`${url.origin}${url.pathname}`, "https://acct.r2.cloudflarestorage.com/folio-private/u1/abc.orig.jpg");
  assert.equal(url.searchParams.get("X-Amz-Expires"), "600");
  assert.ok(url.searchParams.get("X-Amz-Signature"));
  assert.deepEqual(url.searchParams.get("X-Amz-SignedHeaders")?.split(";").sort(), ["content-length", "content-type", "host"]);
});
