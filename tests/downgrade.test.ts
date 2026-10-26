// What a downgrade from Pro to Free hides: client galleries and Pro themes stay
// saved, but visitors don't see them until the account is Pro again.
import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { createGallery, setGalleryPhotos, toggleFavourite, unlockGallery } from "../app/actions/galleries.ts";
import { GET as downloadAll } from "../app/sites/[subdomain]/g/[gallery]/download/route.ts";
import { findUserById, updateUser } from "../lib/db.ts";
import { presetDesign } from "../lib/design.ts";
import { galleriesOpen } from "../lib/plans.ts";
import { publishedDesign, draftDesign } from "../lib/public-site.ts";
import { addPhoto, formOf, fromIp, makeUser, redirectedTo, resetRequest, signInAs, signOut } from "./helpers.ts";

beforeEach(resetRequest);

const ctx = (subdomain: string, gallery: string) => ({ params: Promise.resolve({ subdomain, gallery }) }) as never;

test("galleries are open only on Pro", () => {
  assert.equal(galleriesOpen({ plan: "pro" }), true);
  assert.equal(galleriesOpen({ plan: "free" }), false);
  assert.equal(galleriesOpen({}), false);
});

test("after a downgrade a client gallery can't be unlocked, downloaded or hearted, and comes back on Pro", async () => {
  const owner = await makeUser("Dora");
  await updateUser(owner.id, (u) => void (u.plan = "pro"));
  await signInAs(owner);
  const { photo } = await addPhoto(owner.id);
  await redirectedTo(createGallery({}, formOf({ title: "Wedding", password: "secret1" })));
  const id = (await findUserById(owner.id))!.galleries![0].id;
  await setGalleryPhotos(id, [photo.id]);
  const gallery = (await findUserById(owner.id))!.galleries![0];
  const unlock = () => unlockGallery(owner.subdomain, gallery.slug, {}, formOf({ password: "secret1" }));

  signOut();
  fromIp("198.51.100.40");
  await redirectedTo(unlock());
  assert.equal((await downloadAll(new Request("http://x"), ctx(owner.subdomain, gallery.slug))).status, 200);

  await updateUser(owner.id, (u) => void (u.plan = "free"));
  assert.equal((await downloadAll(new Request("http://x"), ctx(owner.subdomain, gallery.slug))).status, 404, "an old cookie stops working");
  assert.equal((await unlock()).error, "That password isn't right.", "and the password is no longer accepted");
  assert.equal((await toggleFavourite(owner.subdomain, gallery.slug, photo.id)).error, "This gallery isn't available.");
  assert.equal((await findUserById(owner.id))!.galleries!.length, 1, "the gallery itself is kept");

  await updateUser(owner.id, (u) => void (u.plan = "pro"));
  assert.equal((await downloadAll(new Request("http://x"), ctx(owner.subdomain, gallery.slug))).status, 200, "back on Pro it opens again");
});

test("a Free account's site shows Classic instead of a saved Pro theme, and the Pro theme is kept", async () => {
  const owner = await makeUser("Eli");
  await updateUser(owner.id, (u) => {
    u.plan = "pro";
    u.design = presetDesign("monograph");
    u.draftDesign = presetDesign("contactsheet");
  });
  let user = (await findUserById(owner.id))!;
  assert.equal(publishedDesign(user).theme, "monograph");
  assert.equal(draftDesign(user).theme, "contactsheet");

  await updateUser(owner.id, (u) => void (u.plan = "free"));
  user = (await findUserById(owner.id))!;
  assert.equal(publishedDesign(user).theme, "classic");
  assert.equal(draftDesign(user).theme, "classic");
  assert.equal(user.design?.theme, "monograph", "the saved choice isn't thrown away");

  await updateUser(owner.id, (u) => void (u.plan = "pro"));
  assert.equal(publishedDesign((await findUserById(owner.id))!).theme, "monograph");
});
