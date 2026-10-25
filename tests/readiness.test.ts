// The optional checks on the Go live page (lib/readiness.ts) and the preview button's wording.
import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { qualityChecks } from "../lib/readiness.ts";
import { previewLabel } from "../lib/steps.ts";
import { findUserById, updateUser } from "../lib/db.ts";
import { draftDesign } from "../lib/public-site.ts";
import { addAlbum, addPhoto, makeUser, resetRequest } from "./helpers.ts";

beforeEach(resetRequest);

const status = (checks: ReturnType<typeof qualityChecks>) => Object.fromEntries(checks.map((c) => [c.id, c.done]));

test("a brand-new site has things to improve but nothing that blocks going live", async () => {
  const davi = await makeUser("Davi");
  await addPhoto(davi.id);
  const checks = qualityChecks((await findUserById(davi.id))!);
  assert.deepEqual(status(checks), { captions: false, about: false, contact: false, albums: false });
  assert.match(checks[0].label, /1 of 1 photo has no description/);
  assert.ok(checks.every((c) => c.href.startsWith("/dashboard/")), "each check links to where it's fixed");
});

test("describing photos, writing About text, showing contact details and making an album tick the checks", async () => {
  const davi = await makeUser("Davi");
  const { photo } = await addPhoto(davi.id);
  await addAlbum(davi.id, "Desert", [photo.id]);
  await updateUser(davi.id, (u) => {
    u.photos[0].description = "Dunes";
    u.profile.bio = "I shoot deserts.";
    u.profile.phone = "+1 555 0100";
  });
  assert.deepEqual(status(qualityChecks((await findUserById(davi.id))!)), { captions: true, about: true, contact: true, albums: true });
});

test("a contact email only counts once it's switched on for visitors", async () => {
  const davi = await makeUser("Davi");
  const contact = async () => qualityChecks((await findUserById(davi.id))!).find((c) => c.id === "contact")!.done;
  assert.equal(await contact(), false, "the sign-up email is hidden by default");
  await updateUser(davi.id, (u) => (u.profile.showEmail = true));
  assert.equal(await contact(), true);
});

test("the preview button says draft until the live site and the draft are the same", async () => {
  const draft = await makeUser("Draft", { published: false });
  assert.equal(previewLabel(draft), "Preview draft", "offline sites preview the draft");
  const live = await makeUser("Live");
  assert.equal(previewLabel((await findUserById(live.id))!), "Preview live site");
  await updateUser(live.id, (u) => {
    const current = draftDesign(u);
    u.draftDesign = { ...current, theme: current.theme === "index" ? "classic" : "index" };
  });
  assert.equal(previewLabel((await findUserById(live.id))!), "Preview draft", "unpublished changes mean the preview differs from live");
});
