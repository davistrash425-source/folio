// Folio Pro billing through Polar (a merchant of record: it sells the
// subscription, handles tax and refunds, and pays Folio). This is the only
// file that talks to Polar, the way lib/email.ts is for email.
//
// Switched on by POLAR_ACCESS_TOKEN, POLAR_WEBHOOK_SECRET, POLAR_PRODUCT_MONTHLY
// and POLAR_PRODUCT_YEARLY. POLAR_SERVER is "sandbox" (the default, fake cards
// only) or "production". Without them, billing is off and nobody can check out.
import { createHmac, timingSafeEqual } from "crypto";
import type { User } from "./db";

export type Interval = "month" | "year";
export type Billing = NonNullable<User["billing"]>;

function apiBase() {
  return process.env.POLAR_SERVER === "production" ? "https://api.polar.sh/v1" : "https://sandbox-api.polar.sh/v1";
}

export function billingConfigured() {
  const env = process.env;
  return Boolean(env.POLAR_ACCESS_TOKEN && env.POLAR_WEBHOOK_SECRET && env.POLAR_PRODUCT_MONTHLY && env.POLAR_PRODUCT_YEARLY);
}

async function polar(path: string, init: { method: string; body?: unknown }) {
  const res = await fetch(`${apiBase()}${path}`, {
    method: init.method,
    headers: { Authorization: `Bearer ${process.env.POLAR_ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (!res.ok) {
    throw Object.assign(new Error(`Polar answered ${res.status} for ${init.method} ${path}: ${await res.text()}`), { status: res.status });
  }
  return (await res.json()) as Record<string, unknown>;
}

// A hosted Polar checkout page for this account. The account id travels in
// the metadata and as Polar's external customer id; the webhook finds the
// account from that, never from an email address.
export async function createCheckout(user: Pick<User, "id" | "email">, interval: Interval, origin: string) {
  const product = interval === "year" ? process.env.POLAR_PRODUCT_YEARLY : process.env.POLAR_PRODUCT_MONTHLY;
  const checkout = await polar("/checkouts/", {
    method: "POST",
    body: {
      products: [product],
      external_customer_id: user.id,
      customer_email: user.email,
      success_url: `${origin}/dashboard/manage/billing?welcome=1`,
      metadata: { userId: user.id },
    },
  });
  return String(checkout.url);
}

// Polar's page where the customer cancels, changes card and sees invoices.
export async function createPortalUrl(user: Pick<User, "id">, origin: string) {
  const session = await polar("/customer-sessions/", {
    method: "POST",
    body: { external_customer_id: user.id, return_url: `${origin}/dashboard/manage/billing` },
  });
  return String(session.customer_portal_url);
}

// Ends a subscription right away (used when an account is deleted).
export async function revokeSubscription(subscriptionId: string) {
  await polar(`/subscriptions/${encodeURIComponent(subscriptionId)}`, { method: "DELETE" });
}

// Used before an account is deleted, so nobody keeps paying for it. If Polar
// can't end the subscription this throws, and the caller must not delete the
// account. Polar saying it's already gone (404, or "already canceled/revoked")
// counts as ended.
export async function cancelSubscriptionFor(user: Pick<User, "id" | "billing">) {
  if (!user.billing || !billingConfigured()) return;
  try {
    await revokeSubscription(user.billing.subscriptionId);
  } catch (err) {
    const { status, message } = err as Error & { status?: number };
    if (status === 404 || /already (canceled|cancelled|revoked)/i.test(message)) return;
    throw err;
  }
}

// Polar signs webhooks with the Standard Webhooks scheme: HMAC-SHA256 over
// "<webhook-id>.<webhook-timestamp>.<body>", sent base64 as "v1,<signature>".
// Secrets starting "whsec_" carry a base64 key; older ones use the text itself.
const TOLERANCE_SECONDS = 5 * 60;

export function verifyWebhook(body: string, headers: Pick<Headers, "get">, now = Date.now()) {
  const secret = process.env.POLAR_WEBHOOK_SECRET;
  const id = headers.get("webhook-id");
  const timestamp = headers.get("webhook-timestamp");
  const signatures = headers.get("webhook-signature");
  if (!secret || !id || !timestamp || !signatures) return false;
  if (!/^\d+$/.test(timestamp) || Math.abs(now / 1000 - Number(timestamp)) > TOLERANCE_SECONDS) return false;

  const keys = [Buffer.from(secret, "utf8")];
  if (secret.startsWith("whsec_")) keys.unshift(Buffer.from(secret.slice("whsec_".length), "base64"));
  const signed = `${id}.${timestamp}.${body}`;
  const given = signatures
    .split(" ")
    .filter((s) => s.startsWith("v1,"))
    .map((s) => Buffer.from(s.slice(3)));
  return keys.some((key) => {
    const expected = Buffer.from(createHmac("sha256", key).update(signed).digest("base64"));
    return given.some((g) => g.length === expected.length && timingSafeEqual(g, expected));
  });
}

// Does a subscription in this state still get Pro? A failed payment (past_due)
// keeps Pro while Polar retries; canceled-but-paid-up subscriptions stay
// "active" until the period ends, then arrive as revoked.
export function grantsPro(status: string) {
  return status === "active" || status === "trialing" || status === "past_due";
}
