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
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  // A damaged hash decodes short (even to nothing, which would match any
  // password), so only a full-length one counts.
  if (expected.length !== KEY_LENGTH) return false;
  const actual = await scrypt(password, salt, expected.length);
  return timingSafeEqual(expected, actual);
}

export async function createSession(userId: string) {
  const expires = Date.now() + MAX_AGE * 1000;
  const payload = `${userId}.${expires}`;
  (await cookies()).set(COOKIE_NAME, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function getSessionUserId(): Promise<string | null> {
  await connection(); // the expiry check depends on the current time
  const raw = (await cookies()).get(COOKIE_NAME)?.value;
  if (!raw) return null;
  const [userId, expires, sig] = raw.split(".");
  if (!userId || !expires || !sig) return null;
  const expected = Buffer.from(sign(`${userId}.${expires}`));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return null;
  }
  if (Number(expires) < Date.now()) return null;
  return userId;
}

export async function deleteSession() {
  (await cookies()).delete(COOKIE_NAME);
}
