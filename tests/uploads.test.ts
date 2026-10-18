import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, writeFileSync } from "fs";
import path from "path";
import sharp from "sharp";
import { DATA_DIR, type Photo } from "../lib/db.ts";
import {
  MAX_PHOTO_BYTES,
  UPLOAD_DIR,
  deletePhotoFiles,
  isPrivateFile,
  photoSource,
  savePhoto,
  storage,
} from "../lib/uploads.ts";

const jpeg = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: "#808080" } }).jpeg().toBuffer();

test("photos are stored in the test data folder, one folder per user", () => {
  assert.equal(UPLOAD_DIR, path.join(DATA_DIR, "uploads"));
});

test("storage saves, reads and removes a user's files", async () => {
  await storage.put("user-a", "x.webp", Buffer.from("one"));
  assert.equal((await storage.get("user-a", "x.webp")).toString(), "one");
  await storage.remove("user-a", "x.webp");
  await assert.rejects(storage.get("user-a", "x.webp"));
  await storage.remove("user-a", "never-existed.webp"); // no error
});

test("file names can't reach outside the user's own folder", async () => {
  writeFileSync(path.join(DATA_DIR, "outside.jpg"), "secret");
  await storage.put("user-b", "mine.jpg", Buffer.from("b"));
  for (const [userId, file] of [
    ["..", "outside.jpg"],
    [".", "mine.jpg"],
    ["user-b/..", "outside.jpg"],
    ["user-a", "../user-b/mine.jpg"],
    ["user-a", "..\\user-b\\mine.jpg"],
    ["user-a", ".."],
    ["", "outside.jpg"],
  ]) {
    await assert.rejects(storage.get(userId, file), `read ${userId} / ${file}`);
  }
  assert.equal(existsSync(path.join(DATA_DIR, "outside.jpg")), true);
});

test("removing everything for a user can't delete other folders", async () => {
  await storage.put("user-c", "keep.jpg", Buffer.from("c"));
  for (const userId of ["..", ".", ""]) await assert.rejects(storage.removeAll(userId));
  assert.equal(existsSync(UPLOAD_DIR), true);
  assert.equal((await storage.get("user-c", "keep.jpg")).toString(), "c");
  await storage.removeAll("user-c");
  assert.equal(existsSync(path.join(UPLOAD_DIR, "user-c")), false);
});

test("originals are private however the name is written", () => {
  assert.equal(isPrivateFile("abc.orig.jpg"), true);
  assert.equal(isPrivateFile("abc.ORIG.jpg"), true);
  assert.equal(isPrivateFile("abc.Orig.png"), true);
  assert.equal(isPrivateFile("abc-1280.webp"), false);
  assert.equal(isPrivateFile("abc.jpg"), false);
});

test("savePhoto keeps the original and makes web copies, which can then be deleted", async () => {
  const file = new File([await jpeg(3000, 2000)], "beach.jpg", { type: "image/jpeg" });
  const photo = await savePhoto("user-d", file);
  assert.match(photo.file, /^[0-9a-f-]{36}\.orig\.jpg$/);
  assert.equal(photo.width, 3000);
  assert.ok(photo.variants!.length > 0);
  const files = readdirSync(path.join(UPLOAD_DIR, "user-d"));
  assert.equal(files.length, photo.variants!.length + 1);

  await deletePhotoFiles("user-d", { ...photo, createdAt: "" });
  assert.deepEqual(readdirSync(path.join(UPLOAD_DIR, "user-d")), []);
});

test("savePhoto refuses other file types, oversized files and fake images", async () => {
  const gif = await sharp({ create: { width: 2, height: 2, channels: 3, background: "#000" } }).gif().toBuffer();
  await assert.rejects(savePhoto("user-e", new File(["x"], "a.svg", { type: "image/svg+xml" })), /UNSUPPORTED_TYPE/);
  await assert.rejects(savePhoto("user-e", new File(["x"], "a.txt", { type: "text/plain" })), /UNSUPPORTED_TYPE/);
  const huge = new File([new Uint8Array(MAX_PHOTO_BYTES + 1)], "big.jpg", { type: "image/jpeg" });
  await assert.rejects(savePhoto("user-e", huge), /TOO_LARGE/);
  await assert.rejects(savePhoto("user-e", new File(["<html>"], "fake.jpg", { type: "image/jpeg" })));
  assert.equal(existsSync(path.join(UPLOAD_DIR, "user-e")), false, "nothing should be written");
  await savePhoto("user-e", new File([gif], "ok.gif", { type: "image/gif" }));
});

test("photoSource serves web copies, never the original", () => {
  const photo: Photo = {
    id: "p1",
    file: "p1.orig.jpg",
    createdAt: "2026-01-01",
    description: "Dunes",
    variants: [640, 1280, 2048],
  };
  const src = photoSource("user-f", photo);
  assert.equal(src.src, "/api/uploads/user-f/p1-1280.webp");
  assert.ok(!src.srcSet!.includes(".orig."));
  assert.equal(src.srcSet!.split(", ").length, 3);
  assert.equal(src.alt, "Dunes", "alt falls back to the description");

  const small = photoSource("user-f", { ...photo, variants: [400, 800] });
  assert.equal(small.src, "/api/uploads/user-f/p1-800.webp", "largest copy when none is 1280+");

  const old = photoSource("user-f", { ...photo, file: "legacy.jpg", variants: undefined });
  assert.equal(old.src, "/api/uploads/user-f/legacy.jpg");
});
