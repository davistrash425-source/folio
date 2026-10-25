// One person's account can't be read or changed from another's. Bob is signed
// in throughout; Alice is the person he must not be able to touch.
import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import {
  addPhotosToAlbum,
  createAlbum,
  deleteAlbum,
  deleteInquiry,
  deletePhoto,
  deletePhotos,
  reorderPhotos,
  saveProfile,
  setAlbumCover,
  setAlbumPhotos,
  setInquiryRead,
  setPublished,
  updateAlbum,
  updatePhoto,
  updatePhotos,
} from "../app/actions/site.ts";
import { discardDraftDesign, publishDesign, saveDraftDesign, undoDesign } from "../app/actions/design.ts";
import { findUserById, updateUser } from "../lib/db.ts";
import { galleryPhotos, presetDesign, visibleAlbums, type GallerySection } from "../lib/design.ts";
import { loadSite, siteData } from "../lib/public-site.ts";
import {
  addAlbum,
  addInquiry,
  addPhoto,
  filesOf,
  formOf,
  makeUser,
  redirectedTo,
  resetRequest,
  signInAs,
} from "./helpers.ts";

beforeEach(resetRequest);

// Alice and Bob each have two photos, an album and a message. Bob is signed in.
async function world() {
  const alice = await makeUser("Alice", { published: true });
  const bob = await makeUser("Bob", { published: true });
  const a1 = await addPhoto(alice.id, { description: "alice one" });
  const a2 = await addPhoto(alice.id, { description: "alice two" });
  const b1 = await addPhoto(bob.id, { description: "bob one" });
  const b2 = await addPhoto(bob.id, { description: "bob two" });
  const aAlbum = await addAlbum(alice.id, "Alice album", [a1.photo.id, a2.photo.id]);
  const bAlbum = await addAlbum(bob.id, "Bob album", [b1.photo.id]);
  const aInquiry = await addInquiry(alice.id, "a message for alice");
  const bInquiry = await addInquiry(bob.id, "a message for bob");
  await signInAs(bob);
  return { alice, bob, a1, a2, b1, b2, aAlbum, bAlbum, aInquiry, bInquiry };
}
type World = Awaited<ReturnType<typeof world>>;

// ── Pointing Bob's actions at Alice's things ────────────────────────────

const attacks: Record<string, (w: World) => Promise<unknown>> = {
  "deleting her photo": (w) => deletePhoto(w.a1.photo.id),
  "deleting several of her photos": (w) => deletePhotos([w.a1.photo.id, w.a2.photo.id]),
  "reordering her photos": (w) => reorderPhotos([w.a2.photo.id, w.a1.photo.id]),
  "editing her photo's caption": (w) =>
    updatePhoto(w.a1.photo.id, { description: "hacked", location: "hacked", alt: "hacked", albumIds: [] }),
  "editing several of her photos at once": (w) =>
    updatePhotos([w.a1.photo.id, w.a2.photo.id], { description: "hacked", location: "hacked" }),
  "putting his photos in her album": (w) => addPhotosToAlbum([w.b1.photo.id, w.a1.photo.id], w.aAlbum.id),
  "renaming her album": (w) => updateAlbum(w.aAlbum.id, {}, formOf({ title: "hacked", description: "hacked" })),
  "emptying her album": (w) => setAlbumPhotos(w.aAlbum.id, []),
  "reordering her album": (w) => setAlbumPhotos(w.aAlbum.id, [w.a2.photo.id, w.a1.photo.id]),
  "changing her album's cover": (w) => setAlbumCover(w.aAlbum.id, w.a2.photo.id),
  "deleting her album": (w) => deleteAlbum(w.aAlbum.id),
  "marking her message as read": (w) => setInquiryRead(w.aInquiry.id, true),
  "deleting her message": (w) => deleteInquiry(w.aInquiry.id),
};

for (const [name, attack] of Object.entries(attacks)) {
  test(`Bob can't change Alice's data by ${name}`, async () => {
    const w = await world();
    const alice = await findUserById(w.alice.id);
    const bob = await findUserById(w.bob.id);
    const aliceFiles = filesOf(w.alice.id);
    const bobFiles = filesOf(w.bob.id);

    await attack(w);

    assert.deepEqual(await findUserById(w.alice.id), alice, "Alice's account changed");
    assert.deepEqual(await findUserById(w.bob.id), bob, "Bob's own account changed too");
    assert.deepEqual(filesOf(w.alice.id), aliceFiles, "Alice's photo files changed");
    assert.deepEqual(filesOf(w.bob.id), bobFiles);
  });
}

test("Bob's design changes, going live and undoing never touch Alice's site", async () => {
  const w = await world();
  const alice = await findUserById(w.alice.id);
  const design = presetDesign("exhibition", "dark");
  design.pages[1].title = "Bob's about page";

  assert.equal((await saveDraftDesign(design)).error, undefined);
  assert.equal((await publishDesign(design)).error, undefined);
  await undoDesign();
  await discardDraftDesign();
  await setPublished(false);
  await saveProfile({}, formOf({ name: "Bob Renamed", bio: "new bio" }));

  assert.deepEqual(await findUserById(w.alice.id), alice);
  assert.equal((await findUserById(w.bob.id))!.profile.name, "Bob Renamed");
  assert.ok(siteData((await findUserById(w.alice.id))!), "Alice's site is still online");
  assert.equal(siteData((await findUserById(w.bob.id))!), null, "Bob's site is offline");
});

// ── Pointing Bob's own things at Alice's ────────────────────────────────

test("Bob can't put Alice's photos into his albums or his photo list", async () => {
  const w = await world();
  const alice = await findUserById(w.alice.id);
  const ids = (user: { photos: { id: string }[] }) => user.photos.map((p) => p.id);

  await setAlbumPhotos(w.bAlbum.id, [w.a1.photo.id, w.b2.photo.id, w.b1.photo.id]);
  await setAlbumCover(w.bAlbum.id, w.a1.photo.id);
  await reorderPhotos([w.a1.photo.id, w.b2.photo.id, w.b1.photo.id]);

  const bob = (await findUserById(w.bob.id))!;
  assert.deepEqual(bob.albums![0].photoIds, [w.b2.photo.id, w.b1.photo.id]);
  assert.equal(bob.albums![0].coverPhotoId, undefined);
  assert.deepEqual(ids(bob), [w.b2.photo.id, w.b1.photo.id]);
  assert.deepEqual(await findUserById(w.alice.id), alice);
});

test("Bob can't add his photos to Alice's album from his photo's details", async () => {
  const w = await world();
  const alice = await findUserById(w.alice.id);
  await updatePhoto(w.b1.photo.id, {
    description: "mine",
    location: "",
    alt: "",
    albumIds: [w.aAlbum.id, w.bAlbum.id],
  });
  assert.deepEqual(await findUserById(w.alice.id), alice);
  const bob = (await findUserById(w.bob.id))!;
  assert.deepEqual(bob.albums![0].photoIds, [w.b1.photo.id]);
  assert.equal(bob.photos[0].description, "mine");
});

test("nonsense sent to the photo actions is refused cleanly, not with a crash", async () => {
  const w = await world();
  const bob = await findUserById(w.bob.id);
  const bad = (value: unknown) => value as never;
  await reorderPhotos(bad("not a list"));
  await reorderPhotos(bad([1, { x: 2 }]));
  await reorderPhotos(bad(Array.from({ length: 50_000 }, (_, i) => `id-${i}`)));
  for (const details of [
    undefined,
    { description: 5, location: "", alt: "", albumIds: [] },
    { description: "x".repeat(100_000), location: "", alt: "", albumIds: [] },
    { description: "", location: "", alt: "", albumIds: "all" },
  ]) {
    const result = await updatePhoto(w.b1.photo.id, bad(details));
    assert.ok(result.error, "refused with a message");
  }
  assert.deepEqual(await findUserById(w.bob.id), bob, "nothing changed");
});

test("putting the same photo in a list twice doesn't duplicate it", async () => {
  const w = await world();
  await reorderPhotos([w.b2.photo.id, w.b2.photo.id, w.b1.photo.id, w.b2.photo.id]);
  const bob = (await findUserById(w.bob.id))!;
  assert.deepEqual(bob.photos.map((p) => p.id), [w.b2.photo.id, w.b1.photo.id]);
});

test("deleting your own photo removes its files and album entries, and nobody else's", async () => {
  const w = await world();
  const alice = await findUserById(w.alice.id);
  const aliceFiles = filesOf(w.alice.id);
  const b1Files = filesOf(w.bob.id).filter((f) => f.startsWith(w.b1.photo.id));
  assert.ok(b1Files.length > 1);

  await deletePhoto(w.b1.photo.id);
  await deletePhoto(w.b1.photo.id); // again: nothing left to delete, and no error

  const bob = (await findUserById(w.bob.id))!;
  assert.deepEqual(bob.photos.map((p) => p.id), [w.b2.photo.id]);
  assert.deepEqual(bob.albums![0].photoIds, []);
  assert.ok(filesOf(w.bob.id).every((f) => !f.startsWith(w.b1.photo.id)));
  assert.ok(filesOf(w.bob.id).some((f) => f.startsWith(w.b2.photo.id)));
  assert.deepEqual(await findUserById(w.alice.id), alice);
  assert.deepEqual(filesOf(w.alice.id), aliceFiles);
});

test("different people can use the same album name; each is on their own site", async () => {
  const w = await world();
  const alice = await findUserById(w.alice.id);
  const to = await redirectedTo(createAlbum({}, formOf({ title: "Alice album" })));
  assert.match(to!, /^\/dashboard\/manage\/albums\/[0-9a-f-]{36}$/);

  assert.deepEqual(await findUserById(w.alice.id), alice);
  const bob = (await findUserById(w.bob.id))!;
  assert.equal(bob.albums!.filter((a) => a.slug === "alice-album").length, 1);
  assert.deepEqual(bob.albums!.find((a) => a.slug === "alice-album")!.photoIds, []);

  // …but twice on the same site is refused.
  assert.deepEqual(await createAlbum({}, formOf({ title: "Alice album" })), { error: "You already have an album with that name." });
});

// ── What a stranger can see of a site ───────────────────────────────────

test("a design that names someone else's photos and albums still shows only your own", async () => {
  const w = await world();
  const design = presetDesign();
  const home = design.pages[0];
  const gallery = home.sections.find((s): s is GallerySection => s.type === "gallery")!;
  gallery.source = { kind: "photos", photoIds: [w.a1.photo.id, w.b1.photo.id, w.a2.photo.id] };
  const hero = home.sections.find((s) => s.type === "hero")!;
  if (hero.type === "hero") hero.coverPhotoId = w.a1.photo.id;
  design.captions = { show: "chosen", photoIds: [w.a1.photo.id], includeLocation: true };
  design.albums = { show: "selected", albumIds: [w.aAlbum.id, w.bAlbum.id] };
  assert.equal((await publishDesign(design)).error, undefined);

  const site = siteData((await findUserById(w.bob.id))!)!;
  assert.deepEqual(site.photos.map((p) => p.id).sort(), [w.b1.photo.id, w.b2.photo.id].sort());
  assert.deepEqual(galleryPhotos(gallery, site.photos, site.albums).map((p) => p.id), [w.b1.photo.id]);
  assert.deepEqual(visibleAlbums(site.design, site.albums).map((a) => a.id), [w.bAlbum.id]);
  assert.ok(!JSON.stringify(site).includes(`/api/uploads/${w.alice.id}/`), "a link to Alice's files");
});

test("a visitor's view of a site has no private details", async () => {
  const alice = await makeUser("Alice", { password: "a long secret password" });
  const { photo } = await addPhoto(alice.id);
  await addAlbum(alice.id, "Weddings", [photo.id]);
  await addInquiry(alice.id, "PRIVATE-MESSAGE-FROM-A-CLIENT");
  await updateUser(alice.id, (u) => {
    u.profile.bio = "Photographer in Lisbon";
    u.profile.contactEmail = "hello@alice-photo.example";
    u.profile.showEmail = true;
  });
  const user = (await findUserById(alice.id))!;
  assert.ok(photo.file.includes(".orig."));

  const everything = JSON.stringify(siteData(user));
  assert.ok(everything.includes("hello@alice-photo.example"), "the public contact address is shown");
  assert.ok(everything.includes("Photographer in Lisbon"));
  assert.ok(!everything.includes(alice.email), "the login email");
  assert.ok(!everything.includes(alice.passwordHash), "the password hash");
  assert.ok(!everything.includes("passwordHash"));
  assert.ok(!everything.includes("PRIVATE-MESSAGE"), "messages from clients");
  assert.ok(!everything.includes(".orig."), "links to original photo files");
  assert.ok(!everything.includes("inquiries"));
});

test("sites that are offline show nothing to visitors, but still show in the owner's preview", async () => {
  const alice = await makeUser("Alice", { published: false });
  const user = (await findUserById(alice.id))!;
  assert.equal(siteData(user), null);
  assert.equal(await loadSite(alice.subdomain), null);
  assert.equal(siteData(user, { preview: true })!.subdomain, alice.subdomain);
  assert.equal(await loadSite("no-such-site"), null);

  await updateUser(alice.id, (u) => (u.published = true));
  assert.equal((await loadSite(alice.subdomain.toUpperCase()))!.subdomain, alice.subdomain, "addresses ignore capitals");
});

test("the contact email must be an address (or empty), since inquiries are sent to it", async () => {
  const bob = await makeUser("Bob");
  await signInAs(bob);
  for (const bad of ["not an email", "a@b.com\nBcc: x@y.com", "a@b"]) {
    const result = await saveProfile({}, formOf({ name: "Bob", contactEmail: bad }));
    assert.match(result.error!, /valid contact email/, bad);
  }
  assert.equal((await findUserById(bob.id))!.profile.contactEmail, bob.email, "nothing was saved");
  assert.deepEqual(await saveProfile({}, formOf({ name: "Bob", contactEmail: "bob@studio.com" })), { ok: "Saved." });
  assert.deepEqual(await saveProfile({}, formOf({ name: "Bob", contactEmail: "" })), { ok: "Saved." });
});
