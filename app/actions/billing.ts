"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { impersonationBlock, requireUser } from "@/lib/auth";
import { billingConfigured, createCheckout, createPortalUrl } from "@/lib/billing";
import { rateLimit } from "@/lib/rate-limit";

type FormState = { error?: string };

// This site's own address, for the pages Polar sends the customer back to.
async function origin() {
  const h = await headers();
  const host = h.get("host") ?? "";
  return `${h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")}://${host}`;
}

async function guard(): Promise<{ error: string } | { user: Awaited<ReturnType<typeof requireUser>> }> {
  const user = await requireUser();
  const blocked = await impersonationBlock();
  if (blocked) return { error: blocked };
  if (user.managedBy) return { error: "Billing belongs to the main account, not an extra site." };
  if (!billingConfigured()) return { error: "Paid plans aren't open yet." };
  if (!(await rateLimit(`billing:${user.id}`, 10, 15 * 60 * 1000))) return { error: "Too many tries. Wait a few minutes." };
  return { user };
}

// Sends the photographer to Polar's checkout. Already subscribed accounts go
// to the portal instead, so nobody pays twice.
export async function startCheckout(interval: "month" | "year"): Promise<FormState> {
  const g = await guard();
  if ("error" in g) return g;
  const subscribed = g.user.billing && ["active", "trialing", "past_due"].includes(g.user.billing.status);
  let url: string;
  try {
    url = subscribed
      ? await createPortalUrl(g.user, await origin())
      : await createCheckout(g.user, interval === "year" ? "year" : "month", await origin());
  } catch (err) {
    console.error("Checkout failed", err);
    return { error: "Couldn't open the payment page. Try again in a moment." };
  }
  redirect(url);
}

// Polar's page for cancelling, changing the card and downloading invoices.
export async function openBillingPortal(): Promise<FormState> {
  const g = await guard();
  if ("error" in g) return g;
  if (!g.user.billing) return { error: "There's no subscription on this account yet." };
  let url: string;
  try {
    url = await createPortalUrl(g.user, await origin());
  } catch (err) {
    console.error("Billing portal failed", err);
    return { error: "Couldn't open the billing page. Try again in a moment." };
  }
  redirect(url);
}
