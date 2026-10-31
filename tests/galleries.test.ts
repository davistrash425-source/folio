// Client galleries: a Pro feature, opened with a link and a password.
import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { createGallery, deleteGallery, setGalleryPhotos, unlockGallery, updateGallery } from "../app/actions/galleries.ts";
import { findUserById, updateUser } from "../lib/db.ts";
import { hasGalleryAccess } from "../lib/session.ts";
import { PRO_GALLERY_LIMIT } from "../lib/plans.ts";
import { deletePhoto, deletePhotos } from "../app/actions/site.ts";
import { addPhoto, formOf, fromIp, makeUser, redirectedTo, resetRequest, signInAs, signOut } from "./helpers.ts";
import { cookieJar } from "./stubs/next-headers.ts";

beforeEach(resetRequest);

async function proUser(name = "Pam") {
  const user = await makeUser(name);
  await updateUser(user.id, (u) => void (u.plan = "pro"));
  await signInAs(user);
  return user;
}

async function galleryFor(userId: string) {
  return (await findUserById(userId))!.galleries![0];
}

test("a free account can't make client galleries", async () => {
  const user = await makeUser("Fay");
  await signInAs(user);
  const result = await createGallery({}, formOf({ title: "Client", password: "secret1" }));
  assert.match(result.error!, /Pro/);
  assert.equal((await findUserById(user.id))!.galleries, undefined);
});

test("a Pro account makes a gallery with a random link and a hashed password", async () => {
  const user = await proUser();
  const to = await redirectedTo(createGallery({}, formOf({ title: "Maya & Dan", password: "secret1" })));
  const gallery = await galleryFor(user.id);
  assert.equal(to, `/dashboard/manage/galleries/${gallery.id}`);
  assert.equal(gallery.title, "Maya & Dan");
  assert.match(gallery.slug, /^[\w-]{8}$/);
  assert.notEqual(gallery.passwordHash, "secret1");
  assert.match((await createGallery({}, formOf({ title: "X", password: "abc" }))).error!, /at least 6/);
});

test("Pro stops at the gallery limit", async () => {
  const user = await proUser();
  for (let i = 0; i < PRO_GALLERY_LIMIT; i++) {
    await redirectedTo(createGallery({}, formOf({ title: `G${i}`, password: "secret1" })));
  }
  assert.match((await createGallery({}, formOf({ title: "One too many", password: "secret1" }))).error!, /limit of 20/);
  assert.equal((await findUserById(user.id))!.galleries!.length, PRO_GALLERY_LIMIT);
});

test("only the right password opens a gallery, and changing it locks everyone out again", async () => {
  const owner = await proUser();
  await redirectedTo(createGallery({}, formOf({ title: "Client", password: "secret1" })));
  const gallery = await galleryFor(owner.id);
  signOut();
  fromIp("198.51.100.77");

  assert.equal((await unlockGallery(owner.subdomain, gallery.slug, {}, formOf({ password: "nope-nope" }))).error, "That password isn't right.");
  assert.equal(await hasGalleryAccess(gallery.id, gallery.passwordHash), false);

  assert.equal(await redirectedTo(unlockGallery(owner.subdomain, gallery.slug, {}, formOf({ password: "secret1" }))), `/g/${gallery.slug}`);
  assert.equal(await hasGalleryAccess(gallery.id, gallery.passwordHash), true);

  await signInAs(owner);
  await updateGallery(gallery.id, {}, formOf({ title: "Client", password: "different2" }));
  const changed = await galleryFor(owner.id);
  assert.equal(await hasGalleryAccess(gallery.id, changed.passwordHash), false, "the old cookie no longer works");
});

test("a gallery's cookie doesn't open another gallery", async () => {
  const owner = await proUser();
  await redirectedTo(createGallery({}, formOf({ title: "One", password: "secret1" })));
  await redirectedTo(createGallery({}, formOf({ title: "Two", password: "secret1" })));
  const [one, two] = (await findUserById(owner.id))!.galleries!;
  signOut();
  fromIp("198.51.100.78");
  await redirectedTo(unlockGallery(owner.subdomain, one.slug, {}, formOf({ password: "secret1" })));
  const cookie = [...cookieJar.entries()].find(([name]) => name === `gallery_${one.id}`)!;
  cookieJar.set(`gallery_${two.id}`, cookie[1]);
  assert.equal(await hasGalleryAccess(two.id, two.passwordHash), false);
});

test("password guesses are limited", async () => {
  const owner = await proUser();
  await redirectedTo(createGallery({}, formOf({ title: "Client", password: "secret1" })));
  const gallery = await galleryFor(owner.id);
  signOut();
  fromIp("198.51.100.79");
  for (let i = 0; i < 8; i++) await unlockGallery(owner.subdomain, gallery.slug, {}, formOf({ password: `guess-${i}` }));
  assert.match((await unlockGallery(owner.subdomain, gallery.slug, {}, formOf({ password: "secret1" }))).error!, /Too many/);
});

test("an offline site's galleries can't be opened", async () => {
  const owner = await proUser();
  await redirectedTo(createGallery({}, formOf({ title: "Client", password: "secret1" })));
  const gallery = await galleryFor(owner.id);
  await updateUser(owner.id, (u) => void (u.published = false));
  signOut();
  fromIp("198.51.100.80");
  assert.equal((await unlockGallery(owner.subdomain, gallery.slug, {}, formOf({ password: "secret1" }))).error, "That password isn't right.");
});

test("a gallery holds only the owner's own photos, and other accounts can't change it", async () => {
  const owner = await proUser();
  const { photo: mine } = await addPhoto(owner.id);
  const other = await makeUser("Olly");
  const { photo: theirs } = await addPhoto(other.id);
  await redirectedTo(createGallery({}, formOf({ title: "Client", password: "secret1" })));
  const gallery = await galleryFor(owner.id);

  await setGalleryPhotos(gallery.id, [mine.id, theirs.id, mine.id]);
  assert.deepEqual((await galleryFor(owner.id)).photoIds, [mine.id], "someone else's photo and duplicates are dropped");

  await signInAs(other);
  assert.match((await setGalleryPhotos(gallery.id, [theirs.id])).error!, /no longer exists/);
  await deleteGallery(gallery.id);
  await updateGallery(gallery.id, {}, formOf({ title: "Hijacked", password: "" }));
  assert.equal((await galleryFor(owner.id)).title, "Client");
});

test("deleting a gallery removes it", async () => {
  const owner = await proUser();
  await redirectedTo(createGallery({}, formOf({ title: "Client", password: "secret1" })));
  await deleteGallery((await galleryFor(owner.id)).id);
  assert.deepEqual((await findUserById(owner.id))!.galleries, []);
});

test("deleting a photo takes it out of client galleries and their favourites", async () => {
  const user = await proUser();
  const { photo: kept } = await addPhoto(user.id);
  const { photo: gone } = await addPhoto(user.id);
  const { photo: alsoGone } = await addPhoto(user.id);
  await createGallery({}, formOf({ title: "Client", password: "secret1" })).catch(() => {});
  const gallery = await galleryFor(user.id);
  await setGalleryPhotos(gallery.id, [kept.id, gone.id, alsoGone.id]);
  await updateUser(user.id, (u) => void (u.galleries![0].favouriteIds = [gone.id, kept.id]));

  await deletePhoto(gone.id);
  await deletePhotos([alsoGone.id]);
  const after = await galleryFor(user.id);
  assert.deepEqual(after.photoIds, [kept.id], "the count matches what the client sees");
  assert.deepEqual(after.favouriteIds, [kept.id]);
});
