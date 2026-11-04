// Which photos visitors see on a photographer's site (lib/site-photos.ts):
// hidden photos and photos only in a client gallery stay off it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "crypto";
import { updatePhoto } from "../app/actions/site.ts";
import { findUserById, updateUser } from "../lib/db.ts";
import { siteData } from "../lib/public-site.ts";
import { addAlbum, addPhoto, makeUser, signInAs } from "./helpers.ts";

async function addGallery(userId: string, photoIds: string[]) {
  await updateUser(userId, (u) => {
    (u.galleries ??= []).push({ id: randomUUID(), slug: randomUUID(), title: "Client", passwordHash: "x", photoIds, createdAt: new Date().toISOString() });
  });
}

const visible = async (userId: string) => siteData((await findUserById(userId))!)!.photos.map((p) => p.id);

test("a photo only in a client gallery isn't on the public site", async () => {
  const u = await makeUser("GalleryOnly");
  const { photo: pub } = await addPhoto(u.id);
  const { photo: priv } = await addPhoto(u.id);
  await addGallery(u.id, [priv.id]);
  assert.deepEqual(await visible(u.id), [pub.id]);
});

test("a gallery photo that is also in an album stays on the site", async () => {
  const u = await makeUser("GalleryAlbum");
  const { photo } = await addPhoto(u.id);
  await addGallery(u.id, [photo.id]);
  await addAlbum(u.id, "Weddings", [photo.id]);
  assert.deepEqual(await visible(u.id), [photo.id]);
});

test("a gallery photo picked in the design stays on the site", async () => {
  const u = await makeUser("GalleryPicked");
  const { photo } = await addPhoto(u.id);
  await addGallery(u.id, [photo.id]);
  await updateUser(u.id, (x) => {
    const design = structuredClone(siteData(x)!.design);
    const section = design.pages.flatMap((p) => p.sections).find((s) => s.type === "gallery")!;
    if (section.type === "gallery") section.source = { kind: "photos", photoIds: [photo.id] };
    x.design = design;
  });
  assert.deepEqual(await visible(u.id), [photo.id]);
});

test("turning on a caption for a gallery-only photo doesn't put it on the site", async () => {
  const u = await makeUser("GalleryCaption");
  const { photo } = await addPhoto(u.id);
  await addGallery(u.id, [photo.id]);
  await updateUser(u.id, (x) => {
    x.design = { ...siteData(x, { preview: true })!.design, captions: { show: "chosen", photoIds: [photo.id], includeLocation: true } };
  });
  assert.deepEqual(await visible(u.id), []);
});

test("the photographer can hide a photo from the site and show it again", async () => {
  const u = await makeUser("Hider");
  const { photo } = await addPhoto(u.id);
  await signInAs(u);
  const details = { description: "", location: "", alt: "", albumIds: [] };
  await updatePhoto(photo.id, { ...details, hiddenFromSite: true });
  assert.deepEqual(await visible(u.id), []);
  await updatePhoto(photo.id, { ...details, hiddenFromSite: false });
  assert.deepEqual(await visible(u.id), [photo.id]);
});

test("a hidden photo is left out even when it's in an album", async () => {
  const u = await makeUser("HiddenAlbum");
  const { photo } = await addPhoto(u.id, { hiddenFromSite: true });
  const album = await addAlbum(u.id, "Street", [photo.id]);
  const site = siteData((await findUserById(u.id))!)!;
  assert.deepEqual(site.photos, []);
  assert.deepEqual(site.albums.find((a) => a.id === album.id)!.photoIds, []);
});

test("one photographer can't hide another photographer's photo", async () => {
  const owner = await makeUser("Owner");
  const { photo } = await addPhoto(owner.id);
  await signInAs(await makeUser("Other"));
  await updatePhoto(photo.id, { description: "", location: "", alt: "", albumIds: [], hiddenFromSite: true });
  assert.equal((await findUserById(owner.id))!.photos[0].hiddenFromSite, undefined);
});
