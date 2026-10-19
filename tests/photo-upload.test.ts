// The browser side of uploading (lib/photo-upload.ts), run against the real
// routes with a fake network: one that drops connections the way phones do.
import { beforeEach, test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { POST as finishRoute } from "../app/api/photos/finish/route.ts";
import { POST as startRoute } from "../app/api/photos/start/route.ts";
import { MAX_EDGE, MAX_PIXELS, PHONE_MAX_PIXELS, fitWithin, isHeic, photoType } from "../lib/compress-image.ts";
import { findUserById } from "../lib/db.ts";
import { UploadError, postJson, retrying, uploadDirect } from "../lib/photo-upload.ts";
import { storage } from "../lib/uploads.ts";
import { makeUser, resetRequest, signInAs, signOut } from "./helpers.ts";

beforeEach(resetRequest);

const noWait = [0, 0, 0];

test("a file's real type comes from its name when the browser doesn't say", () => {
  const of = (name: string, type = "") => photoType({ name, type });
  assert.equal(of("IMG_1234.HEIC"), "image/heic");
  assert.equal(of("photo.heif"), "image/heif");
  assert.equal(of("scan.JPG"), "image/jpeg");
  assert.equal(of("old.jfif"), "image/jpeg");
  assert.equal(of("pic.avif", "application/octet-stream"), "image/avif");
  assert.equal(of("pic.jpg", "image/jpg"), "image/jpeg", "a common misspelling");
  assert.equal(of("pic.jpg", "image/pjpeg"), "image/jpeg");
  assert.equal(of("pic.png", "image/png"), "image/png");
  assert.equal(of("IMG_1.HEIC", "image/heic"), "image/heic");
  assert.equal(of("notes.txt", "text/plain"), "text/plain", "anything else stays what it is, and is refused");
  assert.equal(of("x.constructor"), "", "only real extensions count");
  assert.equal(of("no-extension"), "");
});

test("HEIC is recognised in all its spellings", () => {
  for (const type of ["image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence"]) assert.ok(isHeic(type), type);
  for (const type of ["image/jpeg", "", "image/heicx"]) assert.ok(!isHeic(type), type);
});

test("on a phone, photos are never drawn bigger than Safari on an iPhone can manage", () => {
  assert.equal(PHONE_MAX_PIXELS, 16_777_216);
  const iphone48 = fitWithin(8064, 6048, MAX_EDGE, PHONE_MAX_PIXELS);
  assert.ok(iphone48.width * iphone48.height <= 16_777_216);
  assert.deepEqual(fitWithin(4032, 3024, MAX_EDGE, PHONE_MAX_PIXELS), { width: 4032, height: 3024 }, "a normal iPhone photo is untouched");
  assert.deepEqual(fitWithin(6000, 4000, MAX_EDGE, MAX_PIXELS), { width: 6000, height: 4000 }, "a computer keeps more");
});

test("only errors that may pass are retried, and not forever", async () => {
  let calls = 0;
  await assert.rejects(
    retrying(async () => {
      calls++;
      throw new UploadError("the connection dropped", true);
    }, noWait),
    /connection dropped/,
  );
  assert.equal(calls, 4, "the first try and three more");

  calls = 0;
  await assert.rejects(
    retrying(async () => {
      calls++;
      throw new UploadError("not a JPG");
    }, noWait),
  );
  assert.equal(calls, 1, "a bad photo isn't retried");

  calls = 0;
  const result = await retrying(async () => {
    if (++calls < 3) throw new UploadError("hiccup", true);
    return "ok";
  }, noWait);
  assert.equal(result, "ok");
});

test("answers from the app are sorted into retry or give up", async (t) => {
  const answer = (res: Response | Error) =>
    t.mock.method(globalThis, "fetch", async () => {
      if (res instanceof Error) throw res;
      return res;
    });
  const failure = async () => {
    try {
      await postJson("/api/x", {});
    } catch (err) {
      assert.ok(err instanceof UploadError);
      return { message: err.message, retry: err.retry };
    }
    assert.fail("should have failed");
  };

  answer(new TypeError("Load failed")); // Safari's words for a dropped connection
  assert.deepEqual(await failure(), { message: "the connection dropped", retry: true });
  t.mock.restoreAll();

  answer(Response.json({ error: "couldn't be saved, try again in a minute" }, { status: 503 }));
  assert.deepEqual(await failure(), { message: "couldn't be saved, try again in a minute", retry: true });
  t.mock.restoreAll();

  answer(new Response("<html>Gateway timeout</html>", { status: 504 }));
  assert.deepEqual(await failure(), { message: "the server didn’t answer", retry: true });
  t.mock.restoreAll();

  answer(Response.json({ error: "you've been signed out — log in again" }, { status: 401 }));
  assert.deepEqual(await failure(), { message: "you've been signed out — log in again", retry: false });
  t.mock.restoreAll();

  answer(new Response("<html>a login page</html>", { status: 200 }));
  assert.equal((await failure()).retry, false);
});

// The app's routes behind a fake network. `drop` decides, per request,
// whether the connection fails instead.
function fakeNetwork(t: TestContext, drop: (path: string, n: number) => boolean = () => false) {
  const count: Record<string, number> = {};
  t.mock.method(globalThis, "fetch", async (input: string, init: RequestInit) => {
    const path = new URL(input, "http://localhost").pathname;
    count[path] = (count[path] ?? 0) + 1;
    if (drop(path, count[path])) throw new TypeError("Load failed");
    const route = path === "/api/photos/start" ? startRoute : path === "/api/photos/finish" ? finishRoute : null;
    if (!route) return new Response("Not found", { status: 404 });
    return route(new Request(`http://localhost${path}`, init));
  });
  return count;
}

// Storage that takes direct uploads, like R2, but on the test's disk.
function directStorage(t: TestContext, userId: string, drop: (n: number) => boolean = () => false) {
  storage.uploadUrl = async (u, file) => `https://storage.test/${u}/${file}`;
  t.after(() => delete storage.uploadUrl);
  let puts = 0;
  const send = async (url: string, file: Blob, _type: string, progress: (sent: number) => void) => {
    progress(Math.floor(file.size / 2));
    if (drop(++puts)) throw new UploadError("the connection dropped", true);
    await storage.put(userId, url.split("/").pop()!, Buffer.from(await file.arrayBuffer()));
    progress(file.size);
  };
  return { send, puts: () => puts };
}

const photo = async () =>
  new Blob([new Uint8Array(await sharp({ create: { width: 1600, height: 1200, channels: 3, background: "#a63" } }).jpeg().toBuffer())]);

test("a photo goes up and is added to the account, with progress along the way", async (t) => {
  const alice = await makeUser("Alice");
  await signInAs(alice);
  fakeNetwork(t);
  const { send } = directStorage(t, alice.id);
  const progress: number[] = [];
  let finishing = false;
  const file = await photo();

  assert.equal(await uploadDirect(file, "image/jpeg", { progress: (n) => progress.push(n), finishing: () => (finishing = true), send, delays: noWait }), true);
  assert.equal((await findUserById(alice.id))!.photos.length, 1);
  assert.equal(progress.at(-1), file.size);
  assert.ok(finishing);
});

test("a connection that drops mid-upload is retried with a fresh address, and the photo is added once", async (t) => {
  const alice = await makeUser("Alice");
  await signInAs(alice);
  const count = fakeNetwork(t);
  const storageSide = directStorage(t, alice.id, (n) => n <= 2); // the first two attempts fail

  await uploadDirect(await photo(), "image/jpeg", { progress() {}, finishing() {}, send: storageSide.send, delays: noWait });
  assert.equal(storageSide.puts(), 3);
  assert.equal(count["/api/photos/start"], 3, "a new address for each try");
  assert.equal((await findUserById(alice.id))!.photos.length, 1);
});

test("a dropped connection while finishing is retried, and the photo is still added once", async (t) => {
  const alice = await makeUser("Alice");
  await signInAs(alice);
  // The first finish reaches the server, but its answer is lost on the way back.
  let lostAnswer = true;
  const count: Record<string, number> = {};
  t.mock.method(globalThis, "fetch", async (input: string, init: RequestInit) => {
    const path = new URL(input, "http://localhost").pathname;
    count[path] = (count[path] ?? 0) + 1;
    const res = await (path === "/api/photos/start" ? startRoute : finishRoute)(new Request(`http://localhost${path}`, init));
    if (path === "/api/photos/finish" && lostAnswer) {
      lostAnswer = false;
      throw new TypeError("Load failed");
    }
    return res;
  });
  const { send } = directStorage(t, alice.id);

  assert.equal(await uploadDirect(await photo(), "image/jpeg", { progress() {}, finishing() {}, send, delays: noWait }), true);
  assert.equal(count["/api/photos/finish"], 2);
  assert.equal((await findUserById(alice.id))!.photos.length, 1, "finishing twice adds it once");
});

test("a refused photo isn't retried", async (t) => {
  const alice = await makeUser("Alice");
  await signInAs(alice);
  const count = fakeNetwork(t);
  const { send, puts } = directStorage(t, alice.id);

  await assert.rejects(
    uploadDirect(new Blob(["x"]), "image/svg+xml", { progress() {}, finishing() {}, send, delays: noWait }),
    /not a JPG, PNG, WebP, GIF or AVIF/,
  );
  assert.equal(count["/api/photos/start"], 1);
  assert.equal(puts(), 0);

  // Something that says it's a JPEG but isn't.
  t.mock.method(console, "warn", () => {});
  await assert.rejects(
    uploadDirect(new Blob(["<html>"]), "image/jpeg", { progress() {}, finishing() {}, send, delays: noWait }),
    /couldn't be read as an image/,
  );
  assert.equal(count["/api/photos/finish"], 1);
  assert.equal((await findUserById(alice.id))!.photos.length, 0);
});

test("being signed out stops the upload with a clear reason", async (t) => {
  await makeUser("Alice");
  signOut();
  fakeNetwork(t);
  await assert.rejects(
    uploadDirect(await photo(), "image/jpeg", { progress() {}, finishing() {}, delays: noWait }),
    /signed out/,
  );
});

test("an upload that keeps failing gives up with the reason", async (t) => {
  const alice = await makeUser("Alice");
  await signInAs(alice);
  fakeNetwork(t);
  const { send, puts } = directStorage(t, alice.id, () => true);
  await assert.rejects(
    uploadDirect(await photo(), "image/jpeg", { progress() {}, finishing() {}, send, delays: noWait }),
    /connection dropped/,
  );
  assert.equal(puts(), 4);
  assert.equal((await findUserById(alice.id))!.photos.length, 0);
});

test("without direct uploads (the local disk) nothing is sent, so the app path is used", async (t) => {
  const alice = await makeUser("Alice");
  await signInAs(alice);
  fakeNetwork(t);
  let sent = false;
  const result = await uploadDirect(await photo(), "image/jpeg", {
    progress() {},
    finishing() {},
    send: async () => void (sent = true),
    delays: noWait,
  });
  assert.equal(result, false);
  assert.equal(sent, false);
});

test("three photos uploading at once all arrive", async (t) => {
  const alice = await makeUser("Alice");
  await signInAs(alice);
  fakeNetwork(t, (path, n) => path === "/api/photos/finish" && n % 2 === 1); // every other finish drops
  const { send } = directStorage(t, alice.id);
  const files = await Promise.all([photo(), photo(), photo()]);
  await Promise.all(files.map((f) => uploadDirect(f, "image/jpeg", { progress() {}, finishing() {}, send, delays: noWait })));
  assert.equal((await findUserById(alice.id))!.photos.length, 3);
});
