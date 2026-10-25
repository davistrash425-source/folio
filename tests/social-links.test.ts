// Social links on the profile: handles and links on the network's own domain are
// accepted and stored as full links; anything else is refused with a clear error.
import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { saveProfile } from "../app/actions/site.ts";
import { findUserById, updateUser } from "../lib/db.ts";
import { cleanSocial, cleanWebsite } from "../lib/social.ts";
import { formOf, makeUser, resetRequest, signInAs } from "./helpers.ts";

beforeEach(resetRequest);

test("an Instagram handle, with or without @, or a profile link becomes one canonical link", () => {
  for (const input of ["davif", "@davif", "instagram.com/davif", "https://www.instagram.com/davif/?hl=en", " @davif "]) {
    assert.deepEqual(cleanSocial("instagram", input), { value: "https://instagram.com/davif" }, input);
  }
});

test("an Instagram field refuses other websites and post links", () => {
  assert.match(cleanSocial("instagram", "https://davif.photos").error!, /Instagram: use your handle/);
  assert.match(cleanSocial("instagram", "https://instagram.com/p/abc123").error!, /isn’t to a profile/);
  assert.match(cleanSocial("instagram", "not a handle!").error!, /valid handle/);
  assert.match(cleanSocial("instagram", "a".repeat(31)).error!, /valid handle/);
});

test("X and Facebook take a handle or their own domain only", () => {
  assert.deepEqual(cleanSocial("twitter", "@davi_f"), { value: "https://x.com/davi_f" });
  assert.deepEqual(cleanSocial("twitter", "https://twitter.com/davi_f"), { value: "https://x.com/davi_f" });
  assert.ok(cleanSocial("twitter", "https://instagram.com/davi_f").error);
  assert.deepEqual(cleanSocial("facebook", "https://m.facebook.com/davi.photo"), { value: "https://facebook.com/davi.photo" });
  assert.ok(cleanSocial("facebook", "https://example.com/davi.photo").error);
});

test("an empty social field is fine and stores nothing", () => {
  assert.deepEqual(cleanSocial("instagram", "  "), {});
  assert.deepEqual(cleanWebsite(""), {});
});

test("a website gets https:// added, and anything that isn't a web address is refused", () => {
  assert.deepEqual(cleanWebsite("davif.photos"), { value: "https://davif.photos" });
  assert.deepEqual(cleanWebsite("http://davif.photos/work"), { value: "http://davif.photos/work" });
  for (const bad of ["javascript:alert(1)", "ftp://davif.photos", "no spaces.com", "localhost"]) {
    assert.match(cleanWebsite(bad).error!, /^Website:/, bad);
  }
});

test("saving the profile stores social links as full links", async () => {
  const bob = await makeUser("Bob");
  await signInAs(bob);
  const result = await saveProfile(
    {},
    formOf({ name: "Bob", instagram: "@bob", twitter: "bob_x", facebook: "bob.photo", website: "bob.photos" }),
  );
  assert.deepEqual(result, { ok: "Saved." });
  const { social } = (await findUserById(bob.id))!.profile;
  assert.deepEqual(social, {
    instagram: "https://instagram.com/bob",
    twitter: "https://x.com/bob_x",
    facebook: "https://facebook.com/bob.photo",
    website: "https://bob.photos",
  });
});

test("saving the profile with a wrong social link says which one and saves nothing", async () => {
  const bob = await makeUser("Bob");
  await signInAs(bob);
  const result = await saveProfile({}, formOf({ name: "Renamed", instagram: "https://davif.photos" }));
  assert.match(result.error ?? "", /^Instagram:/);
  assert.notEqual((await findUserById(bob.id))!.profile.name, "Renamed");
});

test("a link saved before the checks existed still reads back, and can be fixed later", async () => {
  const bob = await makeUser("Bob");
  await updateUser(bob.id, (u) => {
    u.profile.social.instagram = "https://davif.photos";
  });
  assert.equal((await findUserById(bob.id))!.profile.social.instagram, "https://davif.photos");

  await signInAs(bob);
  const result = await saveProfile({}, formOf({ name: "Bob", instagram: "@bob" }));
  assert.deepEqual(result, { ok: "Saved." });
  assert.equal((await findUserById(bob.id))!.profile.social.instagram, "https://instagram.com/bob");
});
