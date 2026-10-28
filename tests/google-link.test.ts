// "Continue with Google" for an address that already has a password account
// (app/api/auth/google/callback). Google's answer is faked: a test key signs the
// id_token and the token and certificate requests are mocked.
import { afterEach, beforeEach, test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign as signRsa } from "crypto";
import { GET } from "../app/api/auth/google/callback/route.ts";
import { currentUser } from "../lib/auth.ts";
import { createUser, findUserByEmail } from "../lib/db.ts";
import { startGoogleAuth } from "../lib/google.ts";
import { hashPassword, verifyPassword } from "../lib/session.ts";
import { cookieJar } from "./stubs/next-headers.ts";
import { redirectedTo, resetRequest, signInAs } from "./helpers.ts";

const CLIENT_ID = "test-client.apps.googleusercontent.com";
const KID = "test-key";
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });

beforeEach(resetRequest);
afterEach(() => {
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
});

// A Google id_token for this address, signed with the test key.
function idToken(email: string, sub: string) {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", kid: KID })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({ aud: CLIENT_ID, iss: "https://accounts.google.com", exp: Math.floor(Date.now() / 1000) + 600, email, email_verified: true, sub, name: "Vic" }),
  ).toString("base64url");
  const signature = signRsa("RSA-SHA256", Buffer.from(`${header}.${payload}`), privateKey).toString("base64url");
  return `${header}.${payload}.${signature}`;
}

// Google's token endpoint returns this id_token; its key list holds the test key.
function fakeGoogle(t: TestContext, email: string, sub: string) {
  const jwk = { ...publicKey.export({ format: "jwk" }), kid: KID, alg: "RS256", use: "sig" };
  t.mock.method(globalThis, "fetch", async (input: string | URL) => {
    const url = String(input);
    if (url.startsWith("https://oauth2.googleapis.com/token")) return Response.json({ id_token: idToken(email, sub) });
    if (url.startsWith("https://www.googleapis.com/oauth2/v3/certs")) return Response.json({ keys: [jwk] });
    throw new Error(`unexpected request to ${url}`);
  });
}

// Starts a Google sign-in, as the button does, and returns the callback URL Google would send the browser back to.
async function googleCallback() {
  const start = new URL(await startGoogleAuth("http://localhost/api/auth/google/callback"));
  const state = start.searchParams.get("state")!;
  return new Request(`http://localhost/api/auth/google/callback?code=test-code&state=${state}`);
}

test("signing in with Google to an existing password account takes it over: the password goes and other sessions end", async (t) => {
  process.env.GOOGLE_CLIENT_ID = CLIENT_ID;
  process.env.GOOGLE_CLIENT_SECRET = "test-secret";
  const squatter = await createUser({
    name: "Squatter",
    email: "victim@gmail.com",
    subdomain: "victim-link",
    passwordHash: await hashPassword("squatter password"),
    published: false,
  });

  // The squatter is signed in on another device, then the real owner signs in with Google.
  await signInAs(squatter);
  const otherDevice = new Map(cookieJar);
  await new Promise((resolve) => setTimeout(resolve, 5));
  fakeGoogle(t, "victim@gmail.com", "google-victim");

  assert.equal(await redirectedTo(GET(await googleCallback())), "/dashboard");
  const linked = (await findUserByEmail("victim@gmail.com"))!;
  assert.equal(linked.googleId, "google-victim");
  assert.equal(linked.emailVerified, true, "Google confirmed the address");
  assert.equal(linked.passwordHash, "", "the password set before is gone");
  assert.equal(await verifyPassword("squatter password", linked.passwordHash), false);
  assert.equal(typeof linked.sessionsValidFrom, "number", "other sessions are signed out");

  const newSession = new Map(cookieJar);
  cookieJar.clear();
  for (const [name, value] of otherDevice) cookieJar.set(name, value);
  assert.equal(await currentUser(), null, "the old session no longer signs in");

  cookieJar.clear();
  for (const [name, value] of newSession) cookieJar.set(name, value);
  assert.equal((await currentUser())?.id, squatter.id, "the Google sign-in itself works");
});

test("an account already linked to Google is left alone when signing in again", async (t) => {
  process.env.GOOGLE_CLIENT_ID = CLIENT_ID;
  process.env.GOOGLE_CLIENT_SECRET = "test-secret";
  await createUser({
    name: "Linked",
    email: "linked@gmail.com",
    subdomain: "linked-g",
    passwordHash: "",
    published: false,
    googleId: "google-linked",
    emailVerified: true,
  });
  fakeGoogle(t, "linked@gmail.com", "google-linked");

  assert.equal(await redirectedTo(GET(await googleCallback())), "/dashboard");
  const after = (await findUserByEmail("linked@gmail.com"))!;
  assert.equal(after.sessionsValidFrom, undefined, "no sign-out of other sessions on a plain sign-in");
});
