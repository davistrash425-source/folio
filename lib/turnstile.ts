// Cloudflare Turnstile: a "are you a person" check that usually needs no
// clicking. It's switched on by NEXT_PUBLIC_TURNSTILE_SITE_KEY (shown in the
// browser) and TURNSTILE_SECRET_KEY (used here). Without them (development,
// tests) every check passes.
export const TURNSTILE_FIELD = "cf-turnstile-response";
const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

let warned = false;

export function turnstileEnabled() {
  const site = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
  const secret = Boolean(process.env.TURNSTILE_SECRET_KEY);
  // One key alone shows the widget but checks nothing, so say so once.
  if (site !== secret && !warned) {
    warned = true;
    console.error("Turnstile needs both NEXT_PUBLIC_TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY; with one, nothing is checked.");
  }
  return site && secret;
}

// True if the visitor passed. A missing, reused or wrong token fails. If
// Cloudflare itself can't be reached the check passes (and is logged) rather
// than shutting everyone out; the rate limits still apply.
export async function verifyTurnstile(token: FormDataEntryValue | null, ip: string) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!turnstileEnabled() || !secret) return true;
  if (typeof token !== "string" || !token || token.length > 2048) return false;
  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({ secret, response: token, ...(ip !== "local" ? { remoteip: ip } : {}) }),
    });
    if (!res.ok) throw new Error(`Turnstile answered ${res.status}`);
    const answer = (await res.json()) as { success?: boolean };
    return answer.success === true;
  } catch (err) {
    console.error("Turnstile check unavailable; letting this one through", err);
    return true;
  }
}

export const NOT_HUMAN = "We couldn't check that you're a person. Please try again.";
