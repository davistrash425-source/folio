import { redirect } from "next/navigation";
import { findUserByEmail, updateUser } from "@/lib/db";
import { createSession } from "@/lib/session";
import { exchangeAndVerify, googleRedirectUri, stashGoogleSignup, takeStateVerifier } from "@/lib/google";

// Step two: Google bounces back here with a code. We verify the id_token, then
// either sign in (the email already has an account) or remember the identity
// and send the person to the "pick your address" step.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return redirect("/login?error=google");

  const verifier = await takeStateVerifier(state);
  if (!verifier) return redirect("/login?error=google");

  const identity = await exchangeAndVerify(code, googleRedirectUri(req.url), verifier);
  if (!identity) return redirect("/login?error=google");

  const existing = await findUserByEmail(identity.email);
  if (existing) {
    if (!existing.googleId) {
      // Google has confirmed this address. If the account's email was never
      // confirmed, whoever created it with a password may not be the owner, so
      // that password goes and every other session is signed out. A confirmed
      // account's owner already proved the address, so they keep their password.
      await updateUser(existing.id, (u) => {
        const unconfirmed = u.emailVerified !== true;
        u.googleId = identity.googleId;
        u.emailVerified = true;
        if (unconfirmed) {
          u.passwordHash = "";
          u.sessionsValidFrom = Date.now();
        }
      });
    }
    await createSession(existing.id);
    return redirect("/dashboard");
  }

  await stashGoogleSignup(identity);
  return redirect("/signup/google");
}
