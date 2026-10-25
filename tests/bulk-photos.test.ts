// Editing, album-adding and deleting several photos at once (the multi-select).
import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { addPhotosToAlbum, createAlbum, deletePhotos, updatePhotos } from "../app/actions/site.ts";
import { findUserById, updateUser } from "../lib/db.ts";
import { addAlbum, addPhoto, filesOf, formOf, makeUser, redirectedTo, resetRequest, signInAs } from "./helpers.ts";

beforeEach(resetRequest);

test("updatePhotos sets captions and locations on several photos at once", async () => {
  const davi = await makeUser("Davi");
  const a = await addPhoto(davi.id);
  const b = await addPhoto(davi.id);
  const c = await addPhoto(davi.id);
  await signInAs(davi);

  const result = await updatePhotos([a.photo.id, b.photo.id], { description: "From the set", location: "Lisbon" });
  assert.equal(result.ok, "Updated 2 photos.");

  const user = (await findUserById(davi.id))!;
  assert.equal(user.photos.find((p) => p.id === a.photo.id)!.description, "From the set");
  assert.equal(user.photos.find((p) => p.id === a.photo.id)!.location, "Lisbon");
  assert.equal(user.photos.find((p) => p.id === b.photo.id)!.description, "From the set");
  assert.equal(user.photos.find((p) => p.id === c.photo.id)!.description, undefined, "an unchosen photo stays untouched");
});

test("updatePhotos leaves fields it wasn't given alone", async () => {
  const davi = await makeUser("Davi");
  const a = await addPhoto(davi.id, { description: "Keep me", location: "Porto" });
  await signInAs(davi);

  await updatePhotos([a.photo.id], { location: "Lisbon" });
  const user = (await findUserById(davi.id))!;
  assert.equal(user.photos[0].description, "Keep me");
  assert.equal(user.photos[0].location, "Lisbon");
});

test("addPhotosToAlbum adds only the photographer's own photos", async () => {
  const davi = await makeUser("Davi");
  const a = await addPhoto(davi.id);
  const b = await addPhoto(davi.id);
  const album = await addAlbum(davi.id, "Portraits");
  await signInAs(davi);

  const result = await addPhotosToAlbum([a.photo.id, b.photo.id, "someone-else's"], album.id);
  assert.match(result.ok!, /Added 2 photos to/);
  assert.deepEqual((await findUserById(davi.id))!.albums![0].photoIds, [a.photo.id, b.photo.id]);
});

test("deletePhotos removes the files and album entries of the chosen photos", async () => {
  const davi = await makeUser("Davi");
  const a = await addPhoto(davi.id);
  const b = await addPhoto(davi.id);
  const c = await addPhoto(davi.id);
  await addAlbum(davi.id, "Keep", [a.photo.id, b.photo.id, c.photo.id]);
  await signInAs(davi);

  const result = await deletePhotos([a.photo.id, c.photo.id]);
  assert.equal(result.ok, "Deleted 2 photos.");

  const user = (await findUserById(davi.id))!;
  assert.deepEqual(user.photos.map((p) => p.id), [b.photo.id]);
  assert.deepEqual(user.albums![0].photoIds, [b.photo.id]);
  assert.ok(filesOf(davi.id).every((f) => !f.startsWith(a.photo.id) && !f.startsWith(c.photo.id)));
  assert.ok(filesOf(davi.id).some((f) => f.startsWith(b.photo.id)));
});

test("a legal hold stops bulk deletes and says so", async () => {
  const davi = await makeUser("Davi");
  const a = await addPhoto(davi.id);
  await updateUser(davi.id, (u) => (u.legalHold = { note: "test", at: new Date().toISOString() }));
  await signInAs(davi);

  const result = await deletePhotos([a.photo.id]);
  assert.match(result.error!, /legal hold/);
  assert.equal((await findUserById(davi.id))!.photos.length, 1, "nothing was deleted");
});

test("createAlbum can start a new album with the selected photos, keeping only the photographer's own", async () => {
  const davi = await makeUser("Davi");
  const alice = await makeUser("Alice");
  const a = await addPhoto(davi.id);
  const b = await addPhoto(davi.id);
  const theirs = await addPhoto(alice.id);
  await signInAs(davi);

  const form = formOf({ title: "Portraits" });
  for (const id of [b.photo.id, theirs.photo.id, a.photo.id]) form.append("photoIds", id);
  await redirectedTo(createAlbum({}, form));

  const album = (await findUserById(davi.id))!.albums![0];
  assert.deepEqual(album.photoIds, [a.photo.id, b.photo.id], "in library order, without Alice's photo");
  assert.deepEqual((await findUserById(alice.id))!.albums ?? [], []);
});
