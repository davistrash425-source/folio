// Signed-cookie sessions and password hashing using only Node's crypto.
import { cookies } from "next/headers";
import { connection } from "next/server";
import {
  createHmac,
  randomBytes,
  scrypt as scryptCb,
  timingSafeEqual,
} from "crypto";
import { promisify } from "util";

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: string,
  keylen: number,
) => Promise<Buffer>;

const COOKIE_NAME = "session";
const KEY_LENGTH = 64;
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function secret() {
  const s = process.env.SESSION_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be set in production");
  }
  return "dev-only-insecure-secret";
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = await scrypt(password, salt, KEY_LENGTH);
  return `${salt}:${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) {
    // No password to check (Google accounts, or no such account). Do the same
    // amount of work anyway, so the reply isn't faster for these and doesn't
    // reveal which emails have a password.
    await scrypt(password, "0".repeat(32), KEY_LENGTH);
    return false;
  }
  const expected = Buffer.from(hash, "hex");
  // A damaged hash decodes short (even to nothing, which would match any
  // password), so only a full-length one counts.
  if (expected.length !== KEY_LENGTH) return false;
  const actual = await scrypt(password, salt, expected.length);
  return timingSafeEqual(expected, actual);
}

// An admin working on one of their extra sites is signed in as that site, and
// this second cookie says which admin they are (lib/auth.ts checks it).
const MANAGER_COOKIE = "manager";

// Each kind of cookie is signed differently, so one can't stand in for the
// other. (Login cookies keep the plain form they've always had.)
const signFor = (name: string, payload: string) => sign(name === COOKIE_NAME ? payload : `${name}:${payload}`);

async function setSignedCookie(name: string, userId: string) {
  const expires = Date.now() + MAX_AGE * 1000;
  const payload = `${userId}.${expires}`;
  (await cookies()).set(name, `${payload}.${signFor(name, payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function createSession(userId: string) {
  await setSignedCookie(COOKIE_NAME, userId);
}

// The signed-in user's id and when their login cookie was issued, or null.
// This only checks the cookie; lib/auth.ts also checks the account.
export async function getSession() {
  return readSignedCookie(COOKIE_NAME);
}

export async function setManager(adminId: string) {
  await setSignedCookie(MANAGER_COOKIE, adminId);
}

// The admin who switched to the site that's signed in, from their cookie.
export async function getManager() {
  return readSignedCookie(MANAGER_COOKIE);
}

export async function clearManager() {
  (await cookies()).delete(MANAGER_COOKIE);
}

// ── Admin "log in as this user" ─────────────────────────────────────────
// A separate, short-lived cookie that says which admin is looking at which
// account. The admin's own login cookie is left alone, so stopping drops
// straight back to their own account. lib/auth.ts only honours it while the
// signed-in user is still a full admin.
const IMPERSONATE_COOKIE = "impersonate";
export const IMPERSONATION_MINUTES = 30;

export async function startImpersonation(adminId: string, targetId: string) {
  const expires = Date.now() + IMPERSONATION_MINUTES * 60 * 1000;
  const payload = `${adminId}.${targetId}.${expires}`;
  (await cookies()).set(IMPERSONATE_COOKIE, `${payload}.${signFor(IMPERSONATE_COOKIE, payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: IMPERSONATION_MINUTES * 60,
  });
}

export async function getImpersonation(): Promise<{ adminId: string; targetId: string; expires: number } | null> {
  await connection(); // the expiry check depends on the current time
  const raw = (await cookies()).get(IMPERSONATE_COOKIE)?.value;
  if (!raw) return null;
  const [adminId, targetId, expires, sig] = raw.split(".");
  if (!adminId || !targetId || !expires || !sig) return null;
  const expected = Buffer.from(signFor(IMPERSONATE_COOKIE, `${adminId}.${targetId}.${expires}`));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  if (Number(expires) < Date.now()) return null;
  return { adminId, targetId, expires: Number(expires) };
}

// Whole minutes left until `expires` (ms), at least 1, for the banner.
export const minutesLeft = (expires: number) => Math.max(1, Math.ceil((expires - Date.now()) / 60_000));

export async function clearImpersonation() {
  (await cookies()).delete(IMPERSONATE_COOKIE);
}

async function readSignedCookie(name: string): Promise<{ userId: string; issuedAt: number } | null> {
  await connection(); // the expiry check depends on the current time
  const raw = (await cookies()).get(name)?.value;
  if (!raw) return null;
  const [userId, expires, sig] = raw.split(".");
  if (!userId || !expires || !sig) return null;
  const expected = Buffer.from(signFor(name, `${userId}.${expires}`));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return null;
  }
  if (Number(expires) < Date.now()) return null;
  return { userId, issuedAt: Number(expires) - MAX_AGE * 1000 };
}

// ── Client galleries ────────────────────────────────────────────────────
// Someone who typed a gallery's password gets a cookie for that gallery. It
// is tied to the password, so changing the password closes every open door.
const GALLERY_DAYS = 30;
const galleryCookie = (galleryId: string) => `gallery_${galleryId}`;
const galleryProof = (galleryId: string, passwordHash: string, expires: number) =>
  sign(`gallery:${galleryId}:${passwordHash.slice(-24)}:${expires}`);

export async function grantGalleryAccess(galleryId: string, passwordHash: string) {
  const expires = Date.now() + GALLERY_DAYS * 24 * 60 * 60 * 1000;
  (await cookies()).set(galleryCookie(galleryId), `${expires}.${galleryProof(galleryId, passwordHash, expires)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: GALLERY_DAYS * 24 * 60 * 60,
  });
}

export async function hasGalleryAccess(galleryId: string, passwordHash: string) {
  await connection(); // the expiry check depends on the current time
  const raw = (await cookies()).get(galleryCookie(galleryId))?.value;
  if (!raw) return false;
  const [expires, sig] = raw.split(".");
  if (!expires || !sig || Number(expires) < Date.now()) return false;
  const expected = Buffer.from(galleryProof(galleryId, passwordHash, Number(expires)));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export async function getSessionUserId(): Promise<string | null> {
  return (await getSession())?.userId ?? null;
}

export async function deleteSession() {
  (await cookies()).delete(COOKIE_NAME);
  await clearManager();
  await clearImpersonation();
}
