// Direct uploads: the browser sends a photo straight to storage (R2 in
// production), then app/api/photos/finish checks it and adds it to the account.
import { beforeEach, test } from "node:test";
import { FREE_PHOTO_LIMIT, FREE_STORAGE_LIMIT } from "../lib/plans.ts";
import assert from "node:assert/strict";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { findUserById } from "../lib/db.ts";
import { MAX_PHOTO_BYTES, r2Storage, storage } from "../lib/uploads.ts";
import { POST as finishRoute } from "../app/api/photos/finish/route.ts";
import { POST as startRoute, UPLOAD_STARTS_PER_HOUR } from "../app/api/photos/start/route.ts";
import { deleteUser, updateUser } from "../lib/db.ts";
import { databaseText, filesOf, finishUpload, makeUser, postJson, resetRequest, signInAs, signOut, startUpload } from "./helpers.ts";

beforeEach(resetRequest);

const original = () => `${randomUUID()}.orig.jpg`;
const jpeg = () => sharp({ create: { width: 1600, height: 1000, channels: 3, background: "#446688" } }).jpeg().toBuffer();

const LIMIT_MESSAGE = "You've reached the limit of 150 photos. Delete some to make room.";

test("on the local disk there's no direct address, so the browser uploads through the app", async () => {
  await signInAs(await makeUser("Alice"));
  assert.deepEqual(await startUpload("image/jpeg", 5_000_000), {});
});

test("one account can only start so many uploads an hour, and others aren't held up by it", async () => {
  await signInAs(await makeUser("Alice"));
  for (let i = 0; i < UPLOAD_STARTS_PER_HOUR; i++) await startUpload("image/jpeg", 1000);
  const refused = await startUpload("image/jpeg", 1000);
  assert.match(String((refused as { error?: string }).error), /started a lot of uploads/);

  await signInAs(await makeUser("Bob"));
  assert.deepEqual(await startUpload("image/jpeg", 1000), {});
});

test("only photos of an allowed type and size are given an upload address", async () => {
  await signInAs(await makeUser("Alice"));
  assert.deepEqual(await startUpload("image/svg+xml", 1000), { error: "not a JPG, PNG, WebP, GIF or AVIF" });
  assert.deepEqual(await startUpload("image/jpeg", MAX_PHOTO_BYTES + 1), { error: "over 20 MB" });
  assert.deepEqual(await startUpload("image/jpeg", -1), { error: "over 20 MB" }, "nonsense sizes too");
});

test("finishing an upload adds the photo with its web copies, once however often it's called", async () => {
  const alice = await makeUser("Alice");
  await signInAs(alice);
  const file = original();
  await storage.put(alice.id, file, await jpeg()); // what the browser sent

  assert.deepEqual(await finishUpload(file), { ok: "Uploaded 1 photo." });
  await finishUpload(file);
  const photos = (await findUserById(alice.id))!.photos;
  assert.equal(photos.length, 1);
  assert.equal(photos[0].file, file);
  assert.equal(photos[0].id, file.split(".")[0]);
  assert.deepEqual(photos[0].variants, [640, 1280, 1600]);
  assert.equal(filesOf(alice.id).length, 4, "the original and three web copies");
});

test("a file that isn't an image is refused and deleted", async () => {
  const alice = await makeUser("Alice");
  await signInAs(alice);
  const file = original();
  await storage.put(alice.id, file, Buffer.from("<html>not a photo</html>"));
  assert.deepEqual(await finishUpload(file), { error: "couldn't be read as an image" });
  assert.deepEqual(filesOf(alice.id), []);
  assert.equal((await findUserById(alice.id))!.photos.length, 0);
});

test("a storage failure isn't blamed on the photo", async (t) => {
  const alice = await makeUser("Alice");
  await signInAs(alice);
  const file = original();
  await storage.put(alice.id, file, await jpeg());
  t.mock.method(storage, "put", async () => {
    throw new Error("R2 PUT failed: 403");
  });
  t.mock.method(console, "error", () => {});
  assert.deepEqual(await finishUpload(file), { error: "couldn't be saved, try again in a minute" });
  assert.equal((await findUserById(alice.id))!.photos.length, 0);

  t.mock.restoreAll();
  assert.ok(filesOf(alice.id).includes(file), "the upload is kept, so trying again can work");
  assert.deepEqual(await finishUpload(file), { ok: "Uploaded 1 photo." });
});

test("only names the server hands out can be finished", async () => {
  const alice = await makeUser("Alice");
  await signInAs(alice);
  for (const name of ["../x.orig.jpg", "photo.jpg", `${randomUUID()}-640.webp`, `${randomUUID()}.orig.svg`, "nothing-uploaded"]) {
    assert.deepEqual(await finishUpload(name), { error: "couldn't be read as an image" }, name);
  }
  assert.deepEqual(await finishUpload(original()), { error: "couldn't be read as an image" }, "never uploaded");
  assert.equal((await findUserById(alice.id))!.photos.length, 0);
});

test("a photo uploaded to someone else's folder can't be claimed", async () => {
  const alice = await makeUser("Alice");
  const bob = await makeUser("Bob");
  const file = original();
  await storage.put(alice.id, file, await jpeg());
  await signInAs(bob);
  assert.deepEqual(await finishUpload(file), { error: "couldn't be read as an image" });
  assert.equal((await findUserById(bob.id))!.photos.length, 0);
  assert.equal(filesOf(alice.id).length, 1, "Alice's file is untouched");
});

test("R2 upload addresses go to the private bucket, are signed, expire, and fix the type and size", async () => {
  const r2 = r2Storage({
    accountId: "acct",
    accessKeyId: "key",
    secretAccessKey: "secret",
    publicBucket: "folio-public",
    privateBucket: "folio-private",
    publicUrl: "https://photos.example.com",
  });
  const url = new URL(await r2.uploadUrl!("u1", "abc.orig.jpg", "image/jpeg", 12345));
  assert.equal(`${url.origin}${url.pathname}`, "https://acct.r2.cloudflarestorage.com/folio-private/u1/abc.orig.jpg");
  assert.equal(url.searchParams.get("X-Amz-Expires"), "600");
  assert.ok(url.searchParams.get("X-Amz-Signature"));
  assert.deepEqual(url.searchParams.get("X-Amz-SignedHeaders")?.split(";").sort(), ["content-length", "content-type", "host"]);
});

// The browser sends several photos at once, so their finishes overlap.
test("photos finished at the same moment are all added, none lost", async () => {
  const alice = await makeUser("Alice");
  await signInAs(alice);
  const files = Array.from({ length: 6 }, original);
  const data = await jpeg();
  await Promise.all(files.map((file) => storage.put(alice.id, file, data)));

  const results = await Promise.all(files.map((file) => finishUpload(file)));
  assert.deepEqual(results, files.map(() => ({ ok: "Uploaded 1 photo." })));
  const photos = (await findUserById(alice.id))!.photos;
  assert.deepEqual(photos.map((p) => p.file).sort(), [...files].sort());
});

test("photos finished at once near the limit fill it exactly, and the rest are deleted", async () => {
  const alice = await makeUser("Alice");
  await signInAs(alice);
  await updateUser(alice.id, (u) => {
    u.photos = Array.from({ length: FREE_PHOTO_LIMIT - 2 }, (_, i) => ({ id: `p${i}`, file: `p${i}.orig.jpg`, createdAt: "" }));
  });
  const files = Array.from({ length: 5 }, original);
  const data = await jpeg();
  await Promise.all(files.map((file) => storage.put(alice.id, file, data)));

  const results = await Promise.all(files.map((file) => finishUpload(file)));
  assert.equal(results.filter((r) => r.ok).length, 2);
  assert.equal(results.filter((r) => r.error === LIMIT_MESSAGE).length, 3);
  const photos = (await findUserById(alice.id))!.photos;
  assert.equal(photos.length, FREE_PHOTO_LIMIT);
  const kept = photos.slice(-2);
  assert.equal(filesOf(alice.id).length, kept.reduce((n, p) => n + 1 + p.variants!.length, 0), "only the kept photos' files remain");
});

test("a storage failure answers 503, so the browser tries again", async (t) => {
  const alice = await makeUser("Alice");
  await signInAs(alice);
  const file = original();
  await storage.put(alice.id, file, await jpeg());
  t.mock.method(storage, "get", async () => {
    throw new Error("R2 GET failed: 500");
  });
  t.mock.method(console, "error", () => {});
  const res = await postJson(finishRoute, { file });
  assert.equal(res.status, 503);
  // The upload can't be confirmed missing, so it isn't treated as a bad photo.
  t.mock.restoreAll();
  assert.ok(filesOf(alice.id).includes(file), "the upload is kept for the retry");
  assert.deepEqual(await finishUpload(file), { ok: "Uploaded 1 photo." }, "and the retry works");
});

test("signed-out visitors get a 401 from both steps, and nothing changes", async () => {
  const alice = await makeUser("Alice");
  const file = original();
  await storage.put(alice.id, file, await jpeg());
  signOut();
  const before = await databaseText();
  for (const [route, body] of [[startRoute, { type: "image/jpeg", size: 1000 }], [finishRoute, { file }]] as const) {
    const res = await postJson(route, body);
    assert.equal(res.status, 401);
    assert.match((await res.json()).error, /signed out/);
  }
  assert.equal(await databaseText(), before);
  assert.deepEqual(filesOf(alice.id), [file]);
});

test("garbled requests are refused without an error", async () => {
  const alice = await makeUser("Alice");
  await signInAs(alice);
  const raw = (route: typeof startRoute, body: string) =>
    route(new Request("http://localhost/api", { method: "POST", body }));
  for (const body of ["not json", "null", "[]", '{"type":5,"size":"big"}', '{"type":"image/jpeg","size":1e400}', "{}"]) {
    const start = await (await raw(startRoute, body)).json();
    assert.ok(start.error, `start: ${body}`);
    const finish = await (await raw(finishRoute, body)).json();
    assert.deepEqual(finish, { error: "couldn't be read as an image" }, `finish: ${body}`);
  }
  for (const file of [{ toString: () => "x" }, ["a"], 42]) {
    assert.deepEqual(await (await postJson(finishRoute, { file })).json(), { error: "couldn't be read as an image" });
  }
});

test("an account deleted before its upload finished leaves no files behind", async () => {
  const alice = await makeUser("Alice");
  await signInAs(alice);
  const file = original();
  await storage.put(alice.id, file, await jpeg());
  // Deleted while the photo was being processed, as another tab could.
  const realGet = storage.get;
  storage.get = async (...args) => {
    await deleteUser(alice.id);
    return realGet(...args);
  };
  try {
    assert.equal((await postJson(finishRoute, { file })).status, 401);
  } finally {
    storage.get = realGet;
  }
  assert.deepEqual(filesOf(alice.id), []);
});

test("finishing doesn't make the server re-render the page for every photo", async () => {
  const alice = await makeUser("Alice");
  await signInAs(alice);
  const file = original();
  await storage.put(alice.id, file, await jpeg());
  // A route handler can't re-render the page; this only marks the dashboard
  // stale for the next visit. Checks the photo arrives as a plain JSON answer.
  const res = await postJson(finishRoute, { file });
  assert.equal(res.headers.get("content-type"), "application/json");
  assert.deepEqual(await res.json(), { ok: "Uploaded 1 photo." });
});

test("finishing says how long each step took, for diagnosing slow uploads", async () => {
  const alice = await makeUser("Alice");
  await signInAs(alice);
  const file = original();
  await storage.put(alice.id, file, await jpeg());
  const res = await postJson(finishRoute, { file });
  const steps = res.headers.get("server-timing")!.split(", ").map((s) => s.split(";")[0]);
  assert.deepEqual(steps, ["auth", "read", "resize", "store", "save"]);
  assert.match(res.headers.get("server-timing")!, /^auth;dur=\d+, read;dur=\d+/);
});

test("uploads already started count toward storage, so many at once can't pass the limit", async () => {
  const alice = await makeUser("Alice");
  await signInAs(alice);
  const twentyMb = 20 * 1024 * 1024;
  // Nearly full: room for one more 20 MB photo, not two.
  await updateUser(alice.id, (u) => {
    u.photos.push({ id: randomUUID(), file: original(), description: "", location: "", createdAt: "", bytes: FREE_STORAGE_LIMIT - twentyMb - 1000 });
  });
  storage.uploadUrl = async () => "https://upload.example/signed";
  try {
    const first = await startUpload("image/jpeg", twentyMb);
    assert.ok(first.direct, "the first fits");
    const second = await startUpload("image/jpeg", twentyMb);
    assert.match(String(second.error), /storage/, "the second would overfill it");
  } finally {
    delete storage.uploadUrl;
  }
});

test("an upload can't claim a type that's really a JavaScript built-in", async () => {
  await signInAs(await makeUser("Alice"));
  for (const type of ["constructor", "toString", "__proto__"]) {
    assert.deepEqual(await startUpload(type, 1000), { error: "not a JPG, PNG, WebP, GIF or AVIF" }, type);
  }
});
