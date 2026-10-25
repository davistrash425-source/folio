import { googleRedirectUri, startGoogleAuth } from "@/lib/google";

// Step one of "Continue with Google": the sign-up and log-in pages link here,
// we remember the PKCE verifier, and bounce to Google.
export async function GET(req: Request) {
  try {
    const url = await startGoogleAuth(googleRedirectUri(req.url));
    return Response.redirect(url, 302);
  } catch (err) {
    // Missing GOOGLE_CLIENT_ID/SECRET is a config problem, not a user one.
    console.error("Google sign-in is not configured", err);
    return new Response("Google sign-in isn't set up.", { status: 503 });
  }
}
