// One-time links for password resets and email verification.
import { createHash, randomBytes } from "crypto";
import { addToken, takeToken, type Token } from "./db";

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createToken(userId: string, kind: Token["kind"], ttlMs: number) {
  const token = randomBytes(32).toString("base64url");
  await addToken({ hash: hash(token), userId, kind, expiresAt: new Date(Date.now() + ttlMs).toISOString() });
  return token;
}

// Returns the user id the token belongs to, and uses the token up.
export async function redeemToken(token: string, kind: Token["kind"]) {
  if (!token) return null;
  return (await takeToken(hash(token), kind))?.userId ?? null;
}
