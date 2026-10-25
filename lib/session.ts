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
  // Accounts made through Google have no password; nothing can match.
  if (!stored) return false;
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
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

export async function getSessionUserId(): Promise<string | null> {
  return (await getSession())?.userId ?? null;
}

export async function deleteSession() {
  (await cookies()).delete(COOKIE_NAME);
  await clearManager();
}
