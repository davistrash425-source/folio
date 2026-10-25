// "Continue with Google": OAuth 2.0 with PKCE. Google confirms the sign-in by
// sending an id_token, which this file verifies cryptographically before the
// account is trusted. The OAuth state and the pre-account identity are kept in
// short-lived signed cookies, so a forged request can't swap the state or sign
// someone else up.
import { cookies } from "next/headers";
import {
  createHash,
  createHmac,
  createPublicKey,
  randomBytes,
  timingSafeEqual,
  verify as verifyRsa,
} from "crypto";

const AUTHORIZE = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN = "https://oauth2.googleapis.com/token";
const CERTS = "https://www.googleapis.com/oauth2/v3/certs";
const ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
const SCOPE = "openid email profile";
const STATE_COOKIE = "google-oauth-state";
const SIGNUP_COOKIE = "google-signup";
const TEN_MINUTES = 10 * 60 * 1000;

function secret() {
  const s = process.env.SESSION_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET must be set in production");
  return "dev-only-insecure-secret";
}

const sign = (value: string) => createHmac("sha256", secret()).update(value).digest("base64url");

function clientId() {
  const id = process.env.GOOGLE_CLIENT_ID;
  if (!id) throw new Error("GOOGLE_CLIENT_ID is not set");
  return id;
}

function clientSecret() {
  const s = process.env.GOOGLE_CLIENT_SECRET;
  if (!s) throw new Error("GOOGLE_CLIENT_SECRET is not set");
  return s;
}

// The redirect URI Google returns to, from the request's own host, so it's
// localhost in development and folio.cam in production.
export function googleRedirectUri(requestUrl: string) {
  return new URL("/api/auth/google/callback", requestUrl).toString();
}

// A signed, short-lived cookie (the same idea as lib/session.ts). The payload
// carries its own expiry, and the name is folded into the signature so one
// cookie can't stand in for another.
async function setSignedCookie(name: string, data: string, maxAgeMs: number) {
  const payload = `${Date.now() + maxAgeMs}.${data}`;
  (await cookies()).set(name, `${payload}.${sign(`${name}:${payload}`)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(maxAgeMs / 1000),
  });
}

async function readSignedCookie(name: string) {
  const raw = (await cookies()).get(name)?.value;
  if (!raw) return null;
  const lastDot = raw.lastIndexOf(".");
  if (lastDot < 0) return null;
  const payload = raw.slice(0, lastDot);
  const given = Buffer.from(raw.slice(lastDot + 1));
  const expected = Buffer.from(sign(`${name}:${payload}`));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  const sep = payload.indexOf(".");
  if (sep < 0) return null;
  const expires = Number(payload.slice(0, sep));
  if (!Number.isFinite(expires) || expires < Date.now()) return null;
  return payload.slice(sep + 1);
}

async function deleteCookie(name: string) {
  (await cookies()).delete(name);
}

// Builds the Google URL and remembers the PKCE verifier against the state, so
// the callback can prove the code came from this exact request.
export async function startGoogleAuth(redirectUri: string) {
  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  await setSignedCookie(STATE_COOKIE, `${state}.${verifier}`, TEN_MINUTES);
  const url = new URL(AUTHORIZE);
  url.searchParams.set("client_id", clientId());
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPE);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", createHash("sha256").update(verifier).digest("base64url"));
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

// The verifier for this state, and removes the cookie: each state is used once.
export async function takeStateVerifier(state: string) {
  const data = await readSignedCookie(STATE_COOKIE);
  if (!data) return null;
  const [stored, verifier] = data.split(".");
  if (!stored || !verifier || stored !== state) return null;
  await deleteCookie(STATE_COOKIE);
  return verifier;
}

export type GoogleIdentity = { googleId: string; email: string; name: string };

// The verified identity of someone signing up, held between the callback and
// the "pick your address" step.
export async function stashGoogleSignup(identity: GoogleIdentity) {
  await setSignedCookie(SIGNUP_COOKIE, Buffer.from(JSON.stringify(identity)).toString("base64url"), TEN_MINUTES);
}

export async function readGoogleSignup(): Promise<GoogleIdentity | null> {
  const data = await readSignedCookie(SIGNUP_COOKIE);
  if (!data) return null;
  try {
    const parsed = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
    if (
      typeof parsed?.googleId === "string" &&
      typeof parsed?.email === "string" &&
      typeof parsed?.name === "string"
    ) {
      return { googleId: parsed.googleId, email: parsed.email, name: parsed.name };
    }
  } catch {
    // fall through
  }
  return null;
}

export async function clearGoogleSignup() {
  await deleteCookie(SIGNUP_COOKIE);
}

// Exchanges the code Google sent for tokens and verifies the id_token, so we
// can trust its email. Returns the verified identity, or null if anything is
// off (bad code, wrong audience, expired token, spoofed signature).
export async function exchangeAndVerify(
  code: string,
  redirectUri: string,
  verifier: string,
): Promise<GoogleIdentity | null> {
  const tokenRes = await fetch(TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId(),
      client_secret: clientSecret(),
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
  });
  if (!tokenRes.ok) return null;
  const tokens = (await tokenRes.json()) as { id_token?: string };
  if (!tokens.id_token) return null;
  return verifyIdToken(tokens.id_token);
}

async function verifyIdToken(idToken: string): Promise<GoogleIdentity | null> {
  const [headerRaw, payloadRaw, signatureRaw] = idToken.split(".");
  if (!headerRaw || !payloadRaw || !signatureRaw) return null;
  let header: { kid?: string; alg?: string };
  let payload: Record<string, unknown>;
  try {
    header = JSON.parse(Buffer.from(headerRaw, "base64url").toString("utf8"));
    payload = JSON.parse(Buffer.from(payloadRaw, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (header.alg !== "RS256" || !header.kid) return null;

  // The audience must be us, the issuer Google, and it must not be expired.
  if (payload.aud !== clientId()) return null;
  if (!ISSUERS.includes(String(payload.iss))) return null;
  if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) return null;
  if (payload.email_verified !== true) return null;
  if (typeof payload.email !== "string" || typeof payload.sub !== "string") return null;

  const key = await googleKey(header.kid);
  if (!key) return null;
  const ok = verifyRsa(
    "RSA-SHA256",
    Buffer.from(`${headerRaw}.${payloadRaw}`),
    key,
    Buffer.from(signatureRaw, "base64url"),
  );
  if (!ok) return null;

  const name = typeof payload.name === "string" && payload.name ? payload.name : payload.email.split("@")[0];
  return { googleId: payload.sub, email: payload.email.toLowerCase(), name };
}

async function googleKey(kid: string) {
  let keys: { kid: string; kty: string; n: string; e: string }[];
  try {
    const res = await fetch(CERTS);
    if (!res.ok) return null;
    keys = ((await res.json()) as { keys: typeof keys }).keys;
  } catch {
    return null;
  }
  const key = keys.find((k) => k.kid === kid);
  if (!key) return null;
  try {
    return createPublicKey({ key: { kty: key.kty, n: key.n, e: key.e }, format: "jwk" });
  } catch {
    return null;
  }
}
