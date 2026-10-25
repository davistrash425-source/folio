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
      await updateUser(existing.id, (u) => {
        u.googleId = identity.googleId;
      });
    }
    await createSession(existing.id);
    return redirect("/dashboard");
  }

  await stashGoogleSignup(identity);
  return redirect("/signup/google");
}
