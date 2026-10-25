import { Suspense } from "react";
import { redirect } from "next/navigation";
import { readGoogleSignup } from "@/lib/google";
import { GoogleSignupForm } from "./form";

// The step after Google's callback for a brand-new account: the person picks
// their name and site address (their email is already confirmed by Google).
// Visiting without a fresh Google sign-in bounces back to sign-up. The cookie
// read is inside Suspense so the page can still be prerendered.
export default function GoogleSignupPage() {
  return (
    <Suspense fallback={<p className="label text-ink-faint">Loading…</p>}>
      <WithIdentity />
    </Suspense>
  );
}

async function WithIdentity() {
  const identity = await readGoogleSignup();
  if (!identity) redirect("/signup");
  return <GoogleSignupForm name={identity.name} email={identity.email} />;
}
