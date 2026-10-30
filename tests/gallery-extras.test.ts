// Client gallery follow-ups: download all, expiry, favourites, emailing the link.
import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import {
  createGallery,
  emailGalleryLink,
  setGalleryPhotos,
  toggleFavourite,
  unlockGallery,
  updateGallery,
} from "../app/actions/galleries.ts";
import { GET as downloadAll } from "../app/sites/[subdomain]/g/[gallery]/download/route.ts";
import { findUserById, updateUser } from "../lib/db.ts";
import { galleryExpired, validExpiryDate } from "../lib/galleries.ts";
import { addPhoto, captureEmails, formOf, fromIp, makeUser, readZip, redirectedTo, resetRequest, signInAs, signOut } from "./helpers.ts";

beforeEach(resetRequest);

// A Pro photographer with a gallery holding two photos; the visitor is signed
// out and has typed the password.
async function openGallery(ip: string) {
  const owner = await makeUser("Pam");
  await updateUser(owner.id, (u) => void (u.plan = "pro"));
  await signInAs(owner);
  const { photo: a } = await addPhoto(owner.id);
  const { photo: b } = await addPhoto(owner.id);
  await redirectedTo(createGallery({}, formOf({ title: "Maya & Dan", password: "secret1" })));
  const id = (await findUserById(owner.id))!.galleries![0].id;
  await setGalleryPhotos(id, [a.id, b.id]);
  const gallery = (await findUserById(owner.id))!.galleries![0];
  return { owner, gallery, photos: [a, b], visit: () => { signOut(); fromIp(ip); }, unlock: () => unlockGallery(owner.subdomain, gallery.slug, {}, formOf({ password: "secret1" })) };
}

const ctx = (subdomain: string, gallery: string) => ({ params: Promise.resolve({ subdomain, gallery }) }) as never;

test("expiry dates are valid days, and the link works through the end of that day", () => {
  assert.equal(validExpiryDate("2026-12-31"), true);
  assert.equal(validExpiryDate("2026-02-30"), false);
  assert.equal(validExpiryDate("tomorrow"), false);
  assert.equal(galleryExpired({}), false);
  assert.equal(galleryExpired({ expiresAt: "2026-06-01" }, Date.parse("2026-06-01T23:59:59Z")), false);
  assert.equal(galleryExpired({ expiresAt: "2026-06-01" }, Date.parse("2026-06-02T00:00:00Z")), true);
});

test("the owner sets and clears an expiry date, and a bad one is refused", async () => {
  const { owner, gallery } = await openGallery("198.51.100.1");
  assert.match((await updateGallery(gallery.id, {}, formOf({ title: "X", password: "", expires: "2026-13-45" }))).error!, /isn't valid/);
  await updateGallery(gallery.id, {}, formOf({ title: "X", password: "", expires: "2030-01-01" }));
  assert.equal((await findUserById(owner.id))!.galleries![0].expiresAt, "2030-01-01");
  await updateGallery(gallery.id, {}, formOf({ title: "X", password: "", expires: "" }));
  assert.equal((await findUserById(owner.id))!.galleries![0].expiresAt, undefined);
});

test("an expired gallery can't be unlocked or downloaded", async () => {
  const { owner, gallery, visit, unlock } = await openGallery("198.51.100.2");
  visit();
  await redirectedTo(unlock());
  assert.equal((await downloadAll(new Request("http://x"), ctx(owner.subdomain, gallery.slug))).status, 200);

  await updateUser(owner.id, (u) => void (u.galleries![0].expiresAt = "2020-01-01"));
  assert.equal((await downloadAll(new Request("http://x"), ctx(owner.subdomain, gallery.slug))).status, 404, "an old cookie stops working");
  assert.equal((await unlock()).error, "That password isn't right.", "and the password is no longer accepted");
});

test("an offline site closes the gallery: no download or hearts", async () => {
  const { owner, gallery, photos, visit, unlock } = await openGallery("198.51.100.11");
  visit();
  await redirectedTo(unlock());
  assert.equal((await downloadAll(new Request("http://x"), ctx(owner.subdomain, gallery.slug))).status, 200);

  await updateUser(owner.id, (u) => void (u.published = false));
  assert.equal((await downloadAll(new Request("http://x"), ctx(owner.subdomain, gallery.slug))).status, 404);
  assert.match((await toggleFavourite(owner.subdomain, gallery.slug, photos[0].id)).error!, /isn't available/);
});

test("download all gives a zip of every photo, only to someone with the password", async () => {
  const { owner, gallery, photos, visit, unlock } = await openGallery("198.51.100.3");
  visit();
  assert.equal((await downloadAll(new Request("http://x"), ctx(owner.subdomain, gallery.slug))).status, 404, "no password yet");
  await redirectedTo(unlock());
  const res = await downloadAll(new Request("http://x"), ctx(owner.subdomain, gallery.slug));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "application/zip");
  assert.match(res.headers.get("content-disposition")!, /Maya-Dan\.zip/);
  const files = readZip(Buffer.from(await res.arrayBuffer()));
  assert.equal(files.size, 2);
  for (const photo of photos) assert.ok([...files.keys()].some((n) => n.includes(photo.id) && n.endsWith(".webp")), "web copies, not originals");
  assert.ok(![...files.keys()].some((n) => n.includes(".orig.")));
});

test("another gallery's cookie or a wrong address doesn't download", async () => {
  const { owner, gallery, visit, unlock } = await openGallery("198.51.100.4");
  visit();
  await redirectedTo(unlock());
  assert.equal((await downloadAll(new Request("http://x"), ctx(owner.subdomain, "nope"))).status, 404);
  assert.equal((await downloadAll(new Request("http://x"), ctx("nobody", gallery.slug))).status, 404);
});

test("a client can heart and un-heart photos in the gallery, and nothing else", async () => {
  const { owner, gallery, photos, visit, unlock } = await openGallery("198.51.100.5");
  const stranger = await makeUser("Sam");
  const { photo: outside } = await addPhoto(stranger.id);

  visit();
  assert.match((await toggleFavourite(owner.subdomain, gallery.slug, photos[0].id)).error!, /isn't available/, "locked");
  await redirectedTo(unlock());

  assert.deepEqual((await toggleFavourite(owner.subdomain, gallery.slug, photos[0].id)).favourites, [photos[0].id]);
  assert.deepEqual((await toggleFavourite(owner.subdomain, gallery.slug, photos[1].id)).favourites, [photos[0].id, photos[1].id]);
  assert.deepEqual((await toggleFavourite(owner.subdomain, gallery.slug, photos[0].id)).favourites, [photos[1].id]);
  assert.match((await toggleFavourite(owner.subdomain, gallery.slug, outside.id)).error!, /isn't in this gallery/);
  assert.deepEqual((await findUserById(owner.id))!.galleries![0].favouriteIds, [photos[1].id]);
});

test("favourites need the password and a live gallery", async () => {
  const { owner, gallery, photos, visit, unlock } = await openGallery("198.51.100.6");
  visit();
  await redirectedTo(unlock());
  await updateUser(owner.id, (u) => void (u.galleries![0].expiresAt = "2020-01-01"));
  assert.match((await toggleFavourite(owner.subdomain, gallery.slug, photos[0].id)).error!, /isn't available/);
  assert.match((await toggleFavourite("nobody", gallery.slug, photos[0].id)).error!, /isn't available/);
});

test("emailing the link sends it without the password", async (t) => {
  const { owner, gallery } = await openGallery("198.51.100.7");
  const sent = captureEmails(t);
  await updateGallery(gallery.id, {}, formOf({ title: "Maya & Dan", password: "", expires: "2030-01-01" }));
  const result = await emailGalleryLink(gallery.id, {}, formOf({ email: "maya@example.com", note: "Here are your photos!" }));
  assert.match(result.ok!, /maya@example.com/);
  const mail = sent.join("\n");
  assert.match(mail, /maya@example\.com/);
  assert.ok(mail.includes(`/g/${gallery.slug}`));
  assert.match(mail, /Here are your photos!/);
  assert.match(mail, /2030-01-01/);
  assert.ok(!mail.includes("secret1"), "the password is never emailed");
  assert.ok(mail.includes(owner.email), "replies go to the photographer");
});

test("emailing the link needs a valid address, your own gallery, and is limited", async (t) => {
  const { gallery } = await openGallery("198.51.100.8");
  captureEmails(t);
  assert.match((await emailGalleryLink(gallery.id, {}, formOf({ email: "not-an-address" }))).error!, /email address/);

  const other = await makeUser("Olly");
  await signInAs(other);
  assert.match((await emailGalleryLink(gallery.id, {}, formOf({ email: "maya@example.com" }))).error!, /no longer exists/);

  await signInAs((await findUserById((await makeUser("Rae")).id))!);
  signOut();
  await assert.rejects(emailGalleryLink(gallery.id, {}, formOf({ email: "maya@example.com" })), "signed-out visitors are sent to log in");
});

test("emailing the link needs the site live and on Pro", async (t) => {
  const { owner, gallery } = await openGallery("198.51.100.12");
  captureEmails(t);

  await updateUser(owner.id, (u) => void (u.plan = "free"));
  assert.equal((await emailGalleryLink(gallery.id, {}, formOf({ email: "maya@example.com" }))).error, "Client galleries are part of Folio Pro.");
  await updateUser(owner.id, (u) => void (u.plan = "pro"));

  await updateUser(owner.id, (u) => void (u.published = false));
  assert.match((await emailGalleryLink(gallery.id, {}, formOf({ email: "maya@example.com" }))).error!, /offline/);
  await updateUser(owner.id, (u) => void (u.published = true));

  await updateUser(owner.id, (u) => void (u.emailVerified = false));
  assert.match((await emailGalleryLink(gallery.id, {}, formOf({ email: "maya@example.com" }))).error!, /offline/);
});

test("emails to clients stop after 20 an hour", async (t) => {
  const { gallery } = await openGallery("198.51.100.9");
  captureEmails(t);
  for (let i = 0; i < 20; i++) assert.ok((await emailGalleryLink(gallery.id, {}, formOf({ email: `c${i}@example.com` }))).ok);
  assert.match((await emailGalleryLink(gallery.id, {}, formOf({ email: "extra@example.com" }))).error!, /lot of emails/);
});
