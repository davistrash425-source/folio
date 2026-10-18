import { test } from "node:test";
import assert from "node:assert/strict";
import path from "path";
import {
  DATA_DIR,
  addToken,
  createUser,
  deleteUser,
  findUserByEmail,
  findUserById,
  findUserBySubdomain,
  takeToken,
  updateUser,
} from "../lib/db.ts";
import { createToken, redeemToken } from "../lib/tokens.ts";
import { databaseText } from "./helpers.ts";

let n = 0;
const newUser = (overrides: { email?: string; subdomain?: string } = {}) => {
  n++;
  return createUser({
    email: overrides.email ?? `person${n}@example.com`,
    passwordHash: "salt:hash",
    subdomain: overrides.subdomain ?? `site${n}`,
    name: `Person ${n}`,
    published: false,
  });
};

test("tests use their own data folder, not data/", () => {
  assert.equal(DATA_DIR, process.env.FOLIO_DATA_DIR);
  assert.notEqual(DATA_DIR, path.resolve("data"));
});

test("new users start empty and unverified, with a default design", async () => {
  const user = await newUser({ email: "New.Person@Example.com", subdomain: "NewPerson" });
  assert.equal(user.email, "new.person@example.com");
  assert.equal(user.subdomain, "newperson");
  assert.equal(user.emailVerified, false);
  assert.equal(user.published, false);
  assert.deepEqual([user.photos, user.albums, user.inquiries], [[], [], []]);
  assert.equal(user.profile.contactEmail, "new.person@example.com");
  assert.ok(user.design);
  assert.deepEqual(await findUserById(user.id), user, "what was saved is what came back");
});

test("users can be found by id, and by email or address in any case", async () => {
  const user = await newUser({ email: "find.me@example.com", subdomain: "findme" });
  assert.equal((await findUserById(user.id))?.email, "find.me@example.com");
  assert.equal((await findUserByEmail("FIND.ME@example.COM"))?.id, user.id);
  assert.equal((await findUserBySubdomain("FindMe"))?.id, user.id);
  assert.equal(await findUserById("no-such-id"), null);
  assert.equal(await findUserByEmail("nobody@example.com"), null);
  assert.equal(await findUserBySubdomain("nobody"), null);
});

test("an email or site address can only be claimed once, in any case", async () => {
  await newUser({ email: "taken@example.com", subdomain: "taken" });
  await assert.rejects(newUser({ email: "TAKEN@example.com" }), /EMAIL_TAKEN/);
  await assert.rejects(newUser({ subdomain: "Taken" }), /SUBDOMAIN_TAKEN/);
});

test("updating a user saves the change; updating a missing user fails", async () => {
  const user = await newUser();
  await updateUser(user.id, (u) => (u.profile.bio = "Landscapes"));
  assert.equal((await findUserById(user.id))?.profile.bio, "Landscapes");
  await assert.rejects(updateUser("no-such-id", () => {}), /USER_NOT_FOUND/);
});

test("many updates at once all land, none overwrite another", async () => {
  const user = await newUser();
  await Promise.all(
    Array.from({ length: 25 }, (_, i) =>
      updateUser(user.id, (u) => {
        u.photos.push({ id: `p${i}`, file: `p${i}.jpg`, createdAt: "" });
      }),
    ),
  );
  assert.equal((await findUserById(user.id))?.photos.length, 25);
});

test("a failed update doesn't stop later ones", async () => {
  const user = await newUser();
  await assert.rejects(
    updateUser(user.id, () => {
      throw new Error("boom");
    }),
  );
  await updateUser(user.id, (u) => (u.profile.bio = "after"));
  assert.equal((await findUserById(user.id))?.profile.bio, "after");
});

test("deleting a user removes them and their links, and no one else's", async () => {
  const gone = await newUser();
  const kept = await newUser();
  await createToken(gone.id, "reset", 60_000);
  const keptToken = await createToken(kept.id, "reset", 60_000);
  await deleteUser(gone.id);
  assert.equal(await findUserById(gone.id), null);
  assert.equal(await findUserByEmail(gone.email), null);
  assert.ok(await findUserById(kept.id));
  assert.ok(!(await databaseText()).includes(gone.id));
  assert.equal(await redeemToken(keptToken, "reset"), kept.id);
});

test("a token can be taken once, and expired tokens are refused", async () => {
  const later = new Date(Date.now() + 60_000).toISOString();
  await addToken({ hash: "fresh", userId: "u1", kind: "reset", expiresAt: later });
  assert.equal((await takeToken("fresh", "reset"))?.userId, "u1");
  assert.equal(await takeToken("fresh", "reset"), null);
  assert.equal(await takeToken("fresh", "verify"), null);

  const earlier = new Date(Date.now() - 1).toISOString();
  await addToken({ hash: "stale", userId: "u2", kind: "verify", expiresAt: earlier });
  assert.equal(await takeToken("stale", "verify"), null);
});

test("a new link replaces the user's older link of the same kind only", async () => {
  const first = await createToken("u3", "reset", 60_000);
  const verify = await createToken("u3", "verify", 60_000);
  const second = await createToken("u3", "reset", 60_000);
  assert.equal(await redeemToken(first, "reset"), null);
  assert.equal(await redeemToken(second, "reset"), "u3");
  assert.equal(await redeemToken(verify, "verify"), "u3");
});

test("links work once, for their own kind, and only the hash is stored", async () => {
  const token = await createToken("u4", "reset", 60_000);
  assert.ok(!(await databaseText()).includes(token), "raw token saved");
  assert.equal(await redeemToken(token, "verify"), null);
  assert.equal(await redeemToken("", "reset"), null);
  assert.equal(await redeemToken(token, "reset"), "u4");
  assert.equal(await redeemToken(token, "reset"), null);
});

test("a failed update saves none of its changes", async () => {
  const user = await newUser();
  await assert.rejects(
    updateUser(user.id, (u) => {
      u.profile.bio = "half done";
      throw new Error("boom");
    }),
  );
  assert.equal((await findUserById(user.id))?.profile.bio, "");
});

test("two sign-ups racing for the same email or address: exactly one wins", async () => {
  const results = await Promise.allSettled([
    newUser({ email: "race@example.com" }),
    newUser({ email: "RACE@example.com" }),
    newUser({ subdomain: "racer" }),
    newUser({ subdomain: "Racer" }),
  ]);
  assert.deepEqual(
    results.map((r) => (r.status === "fulfilled" ? "ok" : (r.reason as Error).message)).sort(),
    ["EMAIL_TAKEN", "SUBDOMAIN_TAKEN", "ok", "ok"],
  );
});
