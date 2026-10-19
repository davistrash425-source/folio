// The photo upload form (the uploadPhotos server action).
import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { uploadPhotos } from "../app/actions/site.ts";
import { randomUUID } from "crypto";
import { deleteUser, findUserById, updateUser } from "../lib/db.ts";
import { MAX_PHOTOS, MAX_PHOTO_BYTES, PHOTO_LIMIT_MESSAGE, storage } from "../lib/uploads.ts";
import {
  databaseText,
  filesOf,
  finishUpload,
  formWith,
  jpegFile,
  makeUser,
  redirectedTo,
  resetRequest,
  signInAs,
  signOut,
  startUpload,
} from "./helpers.ts";
import { revalidated } from "./stubs/next-cache.ts";

beforeEach(resetRequest);

test("signed-out visitors can't upload, and nothing is saved", async () => {
  await makeUser("Alice");
  signOut();
  const before = await databaseText();
  assert.equal(await redirectedTo(uploadPhotos({}, formWith(await jpegFile()))), "/login");
  assert.equal(await databaseText(), before);
});

test("uploads go into the signed-in user's account and folder only", async () => {
  const alice = await makeUser("Alice");
  const bob = await makeUser("Bob");
  await signInAs(alice);

  const result = await uploadPhotos({}, formWith(await jpegFile("one.jpg", 3000, 2000), await jpegFile("two.jpg")));
  assert.deepEqual(result, { ok: "Uploaded 2 photos." });

  const after = (await findUserById(alice.id))!;
  assert.equal(after.photos.length, 2);
  assert.equal(new Set(after.photos.map((p) => p.id)).size, 2);
  assert.deepEqual([after.photos[0].width, after.photos[0].height], [3000, 2000], "in the order they were chosen");
  for (const photo of after.photos) {
    assert.match(photo.file, /^[0-9a-f-]{36}\.orig\.jpg$/);
    assert.ok(photo.createdAt);
    assert.ok(photo.variants!.length > 0);
    assert.ok(filesOf(alice.id).includes(photo.file));
  }
  assert.equal(filesOf(alice.id).length, after.photos.reduce((n, p) => n + 1 + p.variants!.length, 0));

  assert.deepEqual((await findUserById(bob.id))!.photos, []);
  assert.deepEqual(filesOf(bob.id), []);
});

test("a hand-made form can't send the photos to someone else's account", async () => {
  const alice = await makeUser("Alice");
  const bob = await makeUser("Bob");
  await signInAs(alice);
  const data = formWith(await jpegFile());
  data.set("userId", bob.id);
  data.set("id", bob.id);
  data.set("subdomain", bob.subdomain);

  await uploadPhotos({}, data);
  assert.equal((await findUserById(alice.id))!.photos.length, 1);
  assert.equal((await findUserById(bob.id))!.photos.length, 0);
  assert.deepEqual(filesOf(bob.id), []);
});

test("new photos are added after the ones already there", async () => {
  const alice = await makeUser("Alice");
  await signInAs(alice);
  await uploadPhotos({}, formWith(await jpegFile("first.jpg", 1000, 700)));
  await uploadPhotos({}, formWith(await jpegFile("second.jpg", 900, 600)));
  const photos = (await findUserById(alice.id))!.photos;
  assert.deepEqual(photos.map((p) => p.width), [1000, 900]);
});

test("uploading refreshes the public site and the dashboard", async () => {
  const alice = await makeUser("Alice");
  await signInAs(alice);
  revalidated.length = 0;
  await uploadPhotos({}, formWith(await jpegFile()));
  assert.ok(revalidated.includes(`tag:site:${alice.subdomain}`), "the cached public site");
  assert.ok(revalidated.includes("path:/dashboard"));
});

test("choosing nothing is an error, and empty file slots are ignored", async () => {
  const alice = await makeUser("Alice");
  await signInAs(alice);
  const nothing = { error: "Choose at least one photo." };
  assert.deepEqual(await uploadPhotos({}, new FormData()), nothing);
  assert.deepEqual(await uploadPhotos({}, formWith(new File([], "", { type: "application/octet-stream" }))), nothing);
  const data = new FormData();
  data.append("photos", "just text, not a file");
  assert.deepEqual(await uploadPhotos({}, data), nothing);
  assert.equal((await findUserById(alice.id))!.photos.length, 0);
});

test("files that aren't usable photos are skipped, and the good ones still upload", async () => {
  const alice = await makeUser("Alice");
  await signInAs(alice);
  const fake = new File(["<html>not a photo</html>"], "fake.jpg", { type: "image/jpeg" });
  const svg = new File(['<svg xmlns="http://www.w3.org/2000/svg"/>'], "logo.svg", { type: "image/svg+xml" });
  const huge = new File([new Uint8Array(MAX_PHOTO_BYTES + 1)], "huge.jpg", { type: "image/jpeg" });

  const result = await uploadPhotos({}, formWith(await jpegFile("good.jpg"), fake, svg, huge));
  assert.deepEqual(result, { ok: "Uploaded 1 photo. Skipped: fake.jpg, logo.svg, huge.jpg." });
  const photos = (await findUserById(alice.id))!.photos;
  assert.equal(photos.length, 1);
  assert.equal(filesOf(alice.id).length, 1 + photos[0].variants!.length, "nothing left over from the skipped files");
});

test("when nothing can be uploaded it says so and saves nothing", async () => {
  const alice = await makeUser("Alice");
  await signInAs(alice);
  const fake = new File(["<html>"], "fake.jpg", { type: "image/jpeg" });
  const text = new File(["hello"], "notes.txt", { type: "text/plain" });
  const result = await uploadPhotos({}, formWith(fake, text));
  assert.match(result.error!, /couldn't be uploaded/);
  assert.equal(result.ok, undefined);
  assert.equal((await findUserById(alice.id))!.photos.length, 0);
  assert.deepEqual(filesOf(alice.id), []);
});

test("an account deleted during the upload is sent to log in and leaves no files behind", async () => {
  const alice = await makeUser("Alice");
  await signInAs(alice);
  const photo = await jpegFile("slow.jpg");
  // Deletes the account while the file is being read, as another tab could.
  const slow = Object.assign(photo, {
    arrayBuffer: async () => {
      await deleteUser(alice.id);
      return new File([await photo.slice().arrayBuffer()], "slow.jpg").arrayBuffer();
    },
  });
  assert.equal(await redirectedTo(uploadPhotos({}, formWith(slow))), "/login");
  assert.deepEqual(filesOf(alice.id), []);
});

test("an account can't hold more than the photo limit, and nothing over it is kept", async () => {
  const alice = await makeUser("Alice");
  await signInAs(alice);
  // Fill the account up to two short of the limit, without real files.
  await updateUser(alice.id, (u) => {
    u.photos = Array.from({ length: MAX_PHOTOS - 2 }, (_, i) => ({ id: `p${i}`, file: `p${i}.orig.jpg`, createdAt: "" }));
  });
  const result = await uploadPhotos({}, formWith(await jpegFile("a.jpg"), await jpegFile("b.jpg"), await jpegFile("c.jpg")));
  assert.match(result.ok!, /^Uploaded 2 photos\. 1 more didn't fit: You've reached the limit of 2,000 photos/);
  assert.equal((await findUserById(alice.id))!.photos.length, MAX_PHOTOS);
  const kept = (await findUserById(alice.id))!.photos.slice(-2);
  assert.equal(filesOf(alice.id).length, kept.reduce((n, p) => n + 1 + p.variants!.length, 0), "the extra photo's files are gone");

  assert.deepEqual(await uploadPhotos({}, formWith(await jpegFile())), { error: PHOTO_LIMIT_MESSAGE });
  assert.deepEqual(await startUpload("image/jpeg", 1000), { error: PHOTO_LIMIT_MESSAGE }, "no upload address either");

  // A direct upload that arrives after the account filled up is refused and deleted.
  const file = `${randomUUID()}.orig.jpg`;
  const jpeg = Buffer.from(await (await jpegFile()).arrayBuffer());
  await storage.put(alice.id, file, jpeg);
  assert.deepEqual(await finishUpload(file), { error: PHOTO_LIMIT_MESSAGE });
  assert.equal(filesOf(alice.id).some((f) => f.startsWith(file.split(".")[0])), false);
});
