// Shared setup for tests that run server actions and route handlers: people
// with sites and photos on disk, and a fake browser to sign in with.
import type { TestContext } from "node:test";
import assert from "node:assert/strict";
import { randomInt, randomUUID } from "crypto";
import { existsSync, readdirSync } from "fs";
import path from "path";
import { crc32 } from "zlib";
import sharp from "sharp";
import { createUser, updateUser, type Album, type Photo } from "../lib/db.ts";
import { database } from "../lib/pg.ts";
import { createSession, hashPassword } from "../lib/session.ts";
import { slugify } from "../lib/site.ts";
import { UPLOAD_DIR, storePhoto } from "../lib/uploads.ts";
import { cookieJar, requestHeaders } from "./stubs/next-headers.ts";
import { RedirectError } from "./stubs/next-navigation.ts";

let counter = 0;

// A new account with a published site. Give `password` to log in with it
// (hashing is slow, so it's off by default).
export async function makeUser(name: string, opts: { password?: string; published?: boolean } = {}) {
  const n = ++counter;
  const handle = `${name.toLowerCase()}-${n}`;
  return createUser({
    name,
    email: `${handle}@example.com`,
    subdomain: handle,
    passwordHash: opts.password ? await hashPassword(opts.password) : "salt:hash",
    published: opts.published ?? true,
  });
}

// Puts a real photo (a plain-colour JPEG, different every time) in the user's
// account and on disk, the way an upload does. `original` is the file as
// uploaded.
export async function addPhoto(userId: string, extra: Partial<Photo> = {}) {
  const original = await sharp({
    create: { width: 1200, height: 800, channels: 3, background: { r: randomInt(256), g: randomInt(256), b: randomInt(256) } },
  })
    .jpeg()
    .toBuffer();
  const id = randomUUID();
  const photo: Photo = {
    id,
    createdAt: new Date().toISOString(),
    ...(await storePhoto(userId, `${id}.orig.jpg`, original)),
    ...extra,
  };
  await updateUser(userId, (u) => {
    u.photos.push(photo);
  });
  return { photo, original };
}

export async function addAlbum(userId: string, title: string, photoIds: string[] = []) {
  const album: Album = { id: randomUUID(), slug: slugify(title), title, description: "", photoIds };
  await updateUser(userId, (u) => {
    (u.albums ??= []).push(album);
  });
  return album;
}

export async function addInquiry(userId: string, message: string) {
  const inquiry = {
    id: randomUUID(),
    name: "A client",
    email: "client@example.com",
    date: "",
    message,
    createdAt: new Date().toISOString(),
    read: false,
  };
  await updateUser(userId, (u) => {
    (u.inquiries ??= []).unshift(inquiry);
  });
  return inquiry;
}

// The fake browser. Signing in sets the login cookie, as the real login does.
export async function signInAs(user: { id: string }) {
  cookieJar.clear();
  await createSession(user.id);
}

export function signOut() {
  cookieJar.clear();
}

// Pretend the next requests come from this address (the rate limits go by it).
export function fromIp(ip: string) {
  requestHeaders.set("x-forwarded-for", ip);
}

export function resetRequest() {
  cookieJar.clear();
  for (const name of [...requestHeaders.keys()]) requestHeaders.delete(name);
}

// Where the code sent the visitor, or null if it didn't send them anywhere.
// (Next's redirect() works by throwing, so this catches that.)
export async function redirectedTo(run: Promise<unknown>) {
  try {
    await run;
    return null;
  } catch (err) {
    if (err instanceof RedirectError) return err.url;
    throw err;
  }
}

// A photo as the browser would send it from the upload form.
export async function jpegFile(name = "beach.jpg", width = 1200, height = 800) {
  const data = await sharp({ create: { width, height, channels: 3, background: "#336699" } }).jpeg().toBuffer();
  return new File([new Uint8Array(data)], name, { type: "image/jpeg" });
}

// The upload form with these files chosen.
export function formWith(...files: File[]) {
  const data = new FormData();
  for (const file of files) data.append("photos", file);
  return data;
}

export function formOf(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

// Everything in the database, as text, to check that something changed
// nothing (or that a value isn't stored anywhere).
export async function databaseText() {
  const db = await database();
  const users = await db.query("select * from users order by id");
  const tokens = await db.query("select * from tokens order by hash");
  return JSON.stringify([users.rows, tokens.rows]);
}

// A user's stored photo files, by name.
export function filesOf(userId: string) {
  const dir = path.join(UPLOAD_DIR, userId);
  return existsSync(dir) ? readdirSync(dir).sort() : [];
}

// Collects the emails the app "sends" (in development it prints them).
export function captureEmails(t: TestContext) {
  const sent: string[] = [];
  t.mock.method(console, "log", (...args: unknown[]) => void sent.push(args.join(" ")));
  return sent;
}

// Reads a .zip made by lib/zip.ts into name → contents, checking every CRC.
export function readZip(zip: Buffer) {
  const end = zip.length - 22;
  assert.equal(zip.readUInt32LE(end), 0x06054b50, "not a zip file");
  const count = zip.readUInt16LE(end + 10);
  let at = zip.readUInt32LE(end + 16);
  const files = new Map<string, Buffer>();
  for (let i = 0; i < count; i++) {
    assert.equal(zip.readUInt32LE(at), 0x02014b50, "damaged zip directory");
    const crc = zip.readUInt32LE(at + 16);
    const size = zip.readUInt32LE(at + 20);
    const nameLength = zip.readUInt16LE(at + 28);
    const extraLength = zip.readUInt16LE(at + 30);
    const commentLength = zip.readUInt16LE(at + 32);
    const local = zip.readUInt32LE(at + 42);
    const name = zip.subarray(at + 46, at + 46 + nameLength).toString("utf8");
    const dataAt = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
    const data = zip.subarray(dataAt, dataAt + size);
    assert.equal(crc32(data), crc, `${name} is damaged`);
    files.set(name, data);
    at += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}
