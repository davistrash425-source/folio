// The two download routes: /api/export (your own account as a .zip) and
// /api/uploads/<user>/<file> (the photos shown on public sites).
import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { GET as exportAccount } from "../app/api/export/route.ts";
import { GET as serveUpload } from "../app/api/uploads/[userId]/[file]/route.ts";
import { DATA_DIR, deleteUser, updateUser } from "../lib/db.ts";
import { setManager } from "../lib/session.ts";
import { UPLOAD_DIR, photoSource, storage } from "../lib/uploads.ts";
import { addAlbum, addInquiry, addPhoto, makeUser, readZip, resetRequest, signInAs, signOut } from "./helpers.ts";
import { cookieJar } from "./stubs/next-headers.ts";

beforeEach(resetRequest);

const getUpload = (userId: string, file: string) =>
  serveUpload(new Request("http://localhost/api/uploads"), { params: Promise.resolve({ userId, file }) });

// The file name of a photo's web-size copy, as it appears in site addresses.
const webCopyOf = (userId: string, photo: Parameters<typeof photoSource>[1]) =>
  photoSource(userId, photo).src.split("/").pop()!;

// ── /api/export ─────────────────────────────────────────────────────────

test("the export refuses visitors who aren't signed in", async () => {
  signOut();
  const res = await exportAccount();
  assert.equal(res.status, 401);
  assert.equal(await res.text(), "Not signed in");
});

test("the export refuses forged login cookies and cookies for deleted accounts", async () => {
  const ghost = await makeUser("Ghost");
  await signInAs(ghost);
  await deleteUser(ghost.id);
  assert.equal((await exportAccount()).status, 401, "deleted account");

  cookieJar.set("session", `${ghost.id}.99999999999999.forged-signature`);
  assert.equal((await exportAccount()).status, 401, "forged cookie");
});

test("the export refuses a cookie for a real account with the wrong signature", async () => {
  const alice = await makeUser("Alice");
  // Right shape, right length, not expired, and the account exists: only the
  // signature check can turn it away.
  cookieJar.set("session", `${alice.id}.99999999999999.${"A".repeat(43)}`);
  assert.equal((await exportAccount()).status, 401);
  await signInAs(alice);
  assert.equal((await exportAccount()).status, 200, "the real cookie still works");
});

test("the export is a zip of the signed-in user's account and original photos", async () => {
  const alice = await makeUser("Alice");
  const dunes = await addPhoto(alice.id, { description: "Dunes" });
  const coast = await addPhoto(alice.id);
  await addAlbum(alice.id, "Desert", [dunes.photo.id]);
  await addInquiry(alice.id, "Are you free in May?");
  await signInAs(alice);

  const res = await exportAccount();
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "application/zip");
  assert.equal(res.headers.get("content-disposition"), `attachment; filename="folio-${alice.subdomain}.zip"`);
  assert.equal(res.headers.get("cache-control"), "no-store");

  const files = readZip(Buffer.from(await res.arrayBuffer()));
  const first = `photos/001-${dunes.photo.id}.jpg`;
  const second = `photos/002-${coast.photo.id}.jpg`;
  assert.deepEqual([...files.keys()], ["account.json", first, second]);
  assert.ok(files.get(first)!.equals(dunes.original), "photos are the originals, byte for byte");
  assert.ok(files.get(second)!.equals(coast.original));

  const account = JSON.parse(files.get("account.json")!.toString());
  assert.equal(account.email, alice.email);
  assert.deepEqual(
    account.photos.map((p: { id: string }) => p.id),
    [dunes.photo.id, coast.photo.id],
  );
  assert.equal(account.photos[0].description, "Dunes");
  assert.equal(account.albums[0].title, "Desert");
  assert.equal(account.inquiries[0].message, "Are you free in May?");
});

test("the export leaves out the password", async () => {
  const alice = await makeUser("Alice", { password: "correct horse" });
  await signInAs(alice);
  const files = readZip(Buffer.from(await (await exportAccount()).arrayBuffer()));
  const text = files.get("account.json")!.toString();
  assert.ok(alice.passwordHash.length > 50);
  assert.ok(!text.includes("passwordHash"));
  assert.ok(!text.includes(alice.passwordHash));
});

test("the export leaves out Folio's staff-only fields: legal hold, admin notes and the admin an extra site belongs to", async (t) => {
  const alice = await makeUser("Alice");
  const admin = await makeUser("Boss");
  process.env.ADMIN_EMAILS = admin.email;
  t.after(() => void delete process.env.ADMIN_EMAILS);
  await updateUser(alice.id, (u) => {
    u.legalHold = { at: new Date().toISOString(), note: "LEGAL-HOLD-NOTE" };
    u.adminNotes = [{ id: "n1", at: new Date().toISOString(), by: admin.email, text: "STAFF-NOTE" }];
    u.managedBy = admin.id;
  });
  await signInAs(alice);
  await setManager(admin.id); // the admin switched to this extra site

  const res = await exportAccount();
  assert.equal(res.status, 200);
  const account = readZip(Buffer.from(await res.arrayBuffer())).get("account.json")!.toString("utf8");
  for (const hidden of ["legalHold", "LEGAL-HOLD-NOTE", "adminNotes", "STAFF-NOTE", "managedBy", admin.id]) {
    assert.ok(!account.includes(hidden), `the export includes ${hidden}`);
  }
  assert.ok(account.includes(alice.email), "the rest of the account is still there");
});

test("one person's export never contains another person's data", async () => {
  const alice = await makeUser("Alice");
  const bob = await makeUser("Bob");
  const alicePhoto = await addPhoto(alice.id, { description: "ALICE-CAPTION" });
  const bobPhoto = await addPhoto(bob.id, { description: "BOB-CAPTION" });
  await updateUser(alice.id, (u) => (u.profile.bio = "ALICE-BIO"));
  await updateUser(bob.id, (u) => (u.profile.bio = "BOB-BIO"));
  await addInquiry(alice.id, "ALICE-INBOX");
  await addInquiry(bob.id, "BOB-INBOX");

  for (const [me, mine, other, theirs] of [
    [alice, alicePhoto, bob, bobPhoto],
    [bob, bobPhoto, alice, alicePhoto],
  ] as const) {
    await signInAs(me);
    const files = readZip(Buffer.from(await (await exportAccount()).arrayBuffer()));
    const mark = (u: typeof me) => u.profile.name.toUpperCase();
    const everything = [...files.entries()].map(([name, data]) => name + data.toString("latin1")).join("\n");
    assert.ok(everything.includes(`${mark(me)}-BIO`), `${me.profile.name}'s own bio is there`);
    assert.ok(!everything.includes(mark(other)), `${me.profile.name}'s export mentions ${other.profile.name}`);
    assert.ok(!everything.includes(other.email) && !everything.includes(other.id));
    assert.ok(![...files.values()].some((data) => data.equals(theirs.original)), "another user's photo file");
    assert.ok([...files.values()].some((data) => data.equals(mine.original)));
  }
});

test("the export still works when a photo's file is missing from the disk", async () => {
  const alice = await makeUser("Alice");
  const lost = await addPhoto(alice.id);
  const kept = await addPhoto(alice.id);
  await storage.remove(alice.id, lost.photo.file);
  await signInAs(alice);

  const res = await exportAccount();
  assert.equal(res.status, 200);
  const files = readZip(Buffer.from(await res.arrayBuffer()));
  // The download says what's missing, so the owner knows it's incomplete.
  assert.deepEqual([...files.keys()], ["account.json", `photos/002-${kept.photo.id}.jpg`, "MISSING-FILES.txt"]);
  assert.match(files.get("MISSING-FILES.txt")!.toString(), new RegExp(`photos/001-${lost.photo.id}\\.jpg`));
  assert.equal(JSON.parse(files.get("account.json")!.toString()).photos.length, 2, "the record is still listed");
});

test("the export has no MISSING-FILES.txt when every photo was read", async () => {
  const alice = await makeUser("Alice");
  await addPhoto(alice.id);
  await signInAs(alice);
  const files = readZip(Buffer.from(await (await exportAccount()).arrayBuffer()));
  assert.ok(!files.has("MISSING-FILES.txt"));
});

// ── /api/uploads/<user>/<file> ──────────────────────────────────────────

test("anyone can fetch a site's web-size photos, and browsers may keep them forever", async () => {
  const alice = await makeUser("Alice");
  const { photo } = await addPhoto(alice.id);
  const file = webCopyOf(alice.id, photo);
  signOut();

  const res = await getUpload(alice.id, file);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "image/webp");
  assert.match(res.headers.get("cache-control")!, /public.*immutable/);
  assert.ok(Buffer.from(await res.arrayBuffer()).equals(await storage.get(alice.id, file)));
});

test("original photos are never served, not even to their owner", async () => {
  const alice = await makeUser("Alice");
  const { photo, original } = await addPhoto(alice.id);
  await signInAs(alice);
  for (const file of [photo.file, photo.file.replace(".orig.", ".ORIG."), photo.file.replace(".orig.", ".Orig.")]) {
    const res = await getUpload(alice.id, file);
    assert.equal(res.status, 404, file);
    assert.ok(!Buffer.from(await res.arrayBuffer()).equals(original));
  }
});

test("only image files are served, whatever else is in a user's folder", async () => {
  const alice = await makeUser("Alice");
  const folder = path.join(UPLOAD_DIR, alice.id);
  mkdirSync(folder, { recursive: true });
  const names = ["notes.html", "data.json", "script.js", "logo.svg", "readme.txt", "no-extension", "x.constructor", "x.toString", "x.__proto__"];
  for (const name of names) writeFileSync(path.join(folder, name), "secret");
  for (const name of names) {
    assert.equal((await getUpload(alice.id, name)).status, 404, name);
  }
});

test("a photo is only found under its owner's folder", async () => {
  const alice = await makeUser("Alice");
  const bob = await makeUser("Bob");
  const { photo } = await addPhoto(alice.id);
  const file = webCopyOf(alice.id, photo);
  assert.equal((await getUpload(alice.id, file)).status, 200);
  assert.equal((await getUpload(bob.id, file)).status, 404);
});

test("missing photos are a plain 404", async () => {
  const alice = await makeUser("Alice");
  assert.equal((await getUpload(alice.id, "nothing-here-640.webp")).status, 404);
  assert.equal((await getUpload("no-such-user", "nothing-here-640.webp")).status, 404);
});

test("addresses that try to climb out of the photo folders find nothing", async () => {
  const alice = await makeUser("Alice");
  const bob = await makeUser("Bob");
  const { photo } = await addPhoto(bob.id);
  const bobsFile = webCopyOf(bob.id, photo);
  // Files that exist but are outside any user's folder.
  mkdirSync(UPLOAD_DIR, { recursive: true });
  writeFileSync(path.join(DATA_DIR, "outside.webp"), "secret");
  writeFileSync(path.join(UPLOAD_DIR, "outside.webp"), "secret");

  const attempts: [string, string][] = [
    ["..", "outside.webp"],
    [".", "outside.webp"],
    ["", "outside.webp"],
    [alice.id, "../outside.webp"],
    [alice.id, "..\\outside.webp"],
    [alice.id, `../${bob.id}/${bobsFile}`],
    [alice.id, `..\\${bob.id}\\${bobsFile}`],
    [alice.id, ".."],
    [alice.id, "."],
  ];
  for (const [userId, file] of attempts) {
    const res = await getUpload(userId, file);
    assert.equal(res.status, 404, `${userId} / ${file}`);
  }
});

test("the export leaves out client gallery passwords", async () => {
  const alice = await makeUser("Alice");
  await updateUser(alice.id, (u) => {
    u.galleries = [{ id: "g1", slug: "abc", title: "Maya & Dan", passwordHash: "gallerysalt:galleryhash", photoIds: [], createdAt: new Date().toISOString() }];
  });
  await signInAs(alice);
  const text = readZip(Buffer.from(await (await exportAccount()).arrayBuffer())).get("account.json")!.toString();
  assert.ok(text.includes("Maya & Dan"), "the gallery itself is in the export");
  assert.ok(!text.includes("galleryhash"));
});
