// Uploading from Google Drive (lib/google-drive.ts): the browser downloads
// each picked photo from Drive, then the ordinary uploader takes over.
import { test } from "node:test";
import assert from "node:assert/strict";
import { photoType } from "../lib/compress-image.ts";
import { downloadDriveFile, driveConfig, isDriveFile, pickedFiles, type DriveFile } from "../lib/google-drive.ts";
import { UploadError } from "../lib/photo-upload.ts";
import { contentPolicy } from "../lib/security-headers.ts";

const CLIENT_ID = "123456789012-abc.apps.googleusercontent.com";

const picked = (extra: Partial<DriveFile> = {}): DriveFile => ({
  drive: true,
  id: "file1",
  name: "beach.jpg",
  type: "image/jpeg",
  size: 3,
  token: "tok",
  ...extra,
});

test("the Drive button needs both the Google client and the picker key", () => {
  assert.equal(driveConfig({}), null);
  assert.equal(driveConfig({ GOOGLE_CLIENT_ID: CLIENT_ID }), null);
  assert.equal(driveConfig({ GOOGLE_PICKER_API_KEY: "key" }), null);
  assert.deepEqual(driveConfig({ GOOGLE_CLIENT_ID: CLIENT_ID, GOOGLE_PICKER_API_KEY: "key" }), {
    clientId: CLIENT_ID,
    apiKey: "key",
    appId: "123456789012",
  });
  assert.equal(driveConfig({ GOOGLE_CLIENT_ID: "not-a-client-id", GOOGLE_PICKER_API_KEY: "key" }), null, "no project number in it");
});

test("the content policy lets Google Drive in only when it's switched on", () => {
  const off = contentPolicy({});
  assert.doesNotMatch(off, /google/);
  const on = contentPolicy({ GOOGLE_CLIENT_ID: CLIENT_ID, GOOGLE_PICKER_API_KEY: "key" });
  assert.match(on, /script-src [^;]*https:\/\/apis\.google\.com/);
  assert.match(on, /script-src [^;]*https:\/\/accounts\.google\.com/);
  assert.match(on, /frame-src [^;]*https:\/\/docs\.google\.com/);
  assert.match(on, /connect-src [^;]*https:\/\/www\.googleapis\.com/);
  assert.match(on, /frame-ancestors 'self'/, "still can't be framed by other sites");
});

test("picked files keep what's needed to check and download them", () => {
  const files = pickedFiles(
    [
      { id: "a", name: "IMG_1.HEIC", mimeType: "image/heif", sizeBytes: "2048", resourceKey: "rk" },
      { id: "b", mimeType: "image/png" },
      { name: "no id" },
    ],
    "tok",
  );
  assert.equal(files.length, 2, "an entry without an id is skipped");
  assert.deepEqual(files[0], { drive: true, id: "a", name: "IMG_1.HEIC", type: "image/heif", size: 2048, resourceKey: "rk", token: "tok" });
  assert.equal(files[1].name, "photo from Google Drive");
  assert.ok(isDriveFile(files[0]));
  assert.ok(!isDriveFile(new File([], "x.jpg")));
  assert.equal(photoType(files[0]), "image/heif", "checked like any other photo before downloading");
});

test("a picked photo is downloaded with the Google sign-in and becomes an ordinary file", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () => new Response(new Uint8Array([1, 2, 3])));
  const file = await downloadDriveFile(picked({ id: "a b", resourceKey: "rk" }));
  const [url, init] = fetch.mock.calls[0].arguments as [string, RequestInit];
  assert.equal(url, "https://www.googleapis.com/drive/v3/files/a%20b?alt=media&supportsAllDrives=true");
  const headers = init.headers as Record<string, string>;
  assert.equal(headers.Authorization, "Bearer tok");
  assert.equal(headers["X-Goog-Drive-Resource-Keys"], "a b/rk");
  assert.ok(file instanceof File);
  assert.equal(file.name, "beach.jpg");
  assert.equal(file.type, "image/jpeg");
  assert.equal(file.size, 3);
});

test("a Drive download that fails says why, and whether trying again might help", async (t) => {
  const failure = async (answer: () => Promise<Response>) => {
    t.mock.method(globalThis, "fetch", answer);
    const err = await downloadDriveFile(picked()).then(
      () => assert.fail("should have failed"),
      (e: unknown) => e,
    );
    assert.ok(err instanceof UploadError);
    t.mock.restoreAll();
    return err;
  };
  const offline = await failure(async () => {
    throw new TypeError("network");
  });
  assert.equal(offline.retry, true);
  assert.equal((await failure(async () => new Response("", { status: 503 }))).retry, true);
  assert.equal((await failure(async () => new Response("", { status: 429 }))).retry, true);
  const expired = await failure(async () => new Response("", { status: 401 }));
  assert.equal(expired.retry, false);
  assert.match(expired.message, /choose it from Drive again/);
  const forbidden = await failure(async () => new Response("", { status: 403 }));
  assert.equal(forbidden.retry, false);
  assert.match(forbidden.message, /wouldn't let Folio/);
});
