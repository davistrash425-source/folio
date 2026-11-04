// What a verified Polar webhook does to an account. Kept out of the route so
// tests can call it directly.
import { findUserById, updateUser } from "./db";
import { billingConfigured, grantsPro, revokeSubscription } from "./billing";
import { sendEmail } from "./email";
import { SUPPORT_EMAIL } from "./site";

type Subscription = {
  id?: string;
  status?: string;
  recurring_interval?: string;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean;
  created_at?: string | null;
  modified_at?: string | null;
  metadata?: Record<string, unknown>;
  customer?: { external_id?: string | null };
};

// The parts of a Polar order Folio reads (order.refunded / order.updated).
type Order = {
  id?: string;
  status?: string; // paid, refunded, partially_refunded, ...
  subscription_id?: string | null;
  metadata?: Record<string, unknown>;
  customer?: { external_id?: string | null };
};

export type PolarEvent = { type?: string; data?: Subscription & Order };

// Returns a short word for logs and tests: what happened to the event.
export async function applyBillingEvent(eventId: string, event: PolarEvent) {
  if (event.type === "order.refunded" || event.type === "order.updated") return applyRefund(eventId, event.data);
  if (!event.type?.startsWith("subscription.")) return "ignored";
  const sub = event.data;
  if (!sub?.id || !sub.status) return "ignored";
  const status = sub.status;

  // The account id we sent when the checkout was made; never the email.
  const userId = String(sub.customer?.external_id ?? sub.metadata?.userId ?? "");
  if (!userId || !(await findUserById(userId))) return "unknown account";

  // Polar leaves modified_at empty until a subscription first changes, so its
  // creation time stands in. Without either, the event can't be ordered.
  const modifiedAt = sub.modified_at ?? sub.created_at ?? undefined;
  let outcome = "recorded";
  let downgraded = false;
  try {
    await updateUser(userId, (u) => {
      const last = u.billing;
      if (last?.lastEventId === eventId) {
        outcome = "duplicate";
        return;
      }
      // Webhooks can arrive out of order: don't let an old one undo a newer state.
      // That includes an older subscription's event after a newer one changed.
      if (last?.updatedAt && modifiedAt && Date.parse(modifiedAt) < Date.parse(last.updatedAt)) {
        outcome = "stale";
        return;
      }

      // The subscriptions that still grant Pro. Starts from the previous list
      // (or the single subscription on older accounts), then follows this event.
      const activeIds = new Set<string>(
        last?.activeSubscriptionIds ?? (last && grantsPro(last.status) ? [last.subscriptionId] : []),
      );
      const refunded = new Set(last?.refundedSubscriptionIds ?? []);
      if (grantsPro(status) && !refunded.has(sub.id!)) activeIds.add(sub.id!);
      else activeIds.delete(sub.id!);

      u.billing = {
        subscriptionId: sub.id!,
        status,
        interval: sub.recurring_interval === "year" ? "year" : "month",
        currentPeriodEnd: sub.current_period_end ?? undefined,
        cancelAtPeriodEnd: sub.cancel_at_period_end ?? undefined,
        lastEventId: eventId,
        updatedAt: modifiedAt ?? last?.updatedAt, // never forget the newest time seen
        activeSubscriptionIds: [...activeIds],
        refundedSubscriptionIds: last?.refundedSubscriptionIds,
      };
      // An admin's manual choice stands. Otherwise the subscriptions decide:
      // the account is Pro while any one of them grants it.
      if (u.planSource === "manual") return;
      const pro = activeIds.size > 0;
      downgraded = u.plan === "pro" && !pro;
      u.plan = pro ? "pro" : "free";
      u.planSource = "billing";
    });
  } catch (err) {
    if ((err as Error).message === "USER_NOT_FOUND") return "unknown account";
    throw err;
  }

  if (downgraded) await sendDowngradeEmail(userId);
  return outcome;
}

// A payment refunded in full ends Pro right away (owner's decision, Nov 4,
// 2026): Polar's own refund only stops renewal, so Folio ends the subscription
// in Polar and drops the account to Free now. Nothing is deleted, as with any
// downgrade. A partial refund changes nothing.
async function applyRefund(eventId: string, order: Order | undefined) {
  if (order?.status !== "refunded" || !order.subscription_id) return "ignored";
  const subscriptionId = order.subscription_id;
  const userId = String(order.customer?.external_id ?? order.metadata?.userId ?? "");
  const user = userId ? await findUserById(userId) : undefined;
  if (!user) return "unknown account";
  if (user.billing?.refundedSubscriptionIds?.includes(subscriptionId)) return "duplicate";

  // End it in Polar first, so the customer isn't charged again. Already
  // ended counts as done. If Polar can't, throw: the webhook answers 500 and
  // Polar retries later.
  if (billingConfigured()) {
    try {
      await revokeSubscription(subscriptionId);
    } catch (err) {
      const { status, message } = err as Error & { status?: number };
      if (!(status === 404 || /already (canceled|cancelled|revoked)/i.test(message))) throw err;
    }
  }

  let downgraded = false;
  await updateUser(userId, (u) => {
    if (!u.billing) return; // no subscription on record: nothing grants Pro
    const refunded = new Set(u.billing.refundedSubscriptionIds ?? []);
    refunded.add(subscriptionId);
    const activeIds = new Set(
      u.billing.activeSubscriptionIds ?? (grantsPro(u.billing.status) ? [u.billing.subscriptionId] : []),
    );
    activeIds.delete(subscriptionId);
    u.billing = { ...u.billing, lastEventId: eventId, activeSubscriptionIds: [...activeIds], refundedSubscriptionIds: [...refunded] };
    if (u.billing.subscriptionId === subscriptionId) u.billing.status = "revoked";
    if (u.planSource === "manual") return;
    const pro = activeIds.size > 0;
    downgraded = u.plan === "pro" && !pro;
    u.plan = pro ? "pro" : "free";
    u.planSource = "billing";
  });
  if (downgraded) await sendDowngradeEmail(userId);
  return "refunded";
}

async function sendDowngradeEmail(userId: string) {
  const user = await findUserById(userId);
  if (!user) return;
  await sendEmail({
    to: user.email,
    replyTo: SUPPORT_EMAIL,
    subject: "Your Folio Pro plan has ended",
    text: `Hi ${user.profile.name},

Your Folio Pro subscription has ended, so your account is back on the Free plan. Nothing was deleted: your photos and site stay as they are. Pro-only features (client galleries, special themes, uploads beyond 150 photos) are paused until you subscribe again from Account → Plan.

Questions? Reply to this email.

Folio`,
  }).catch((err) => console.error("Downgrade email failed", err));
}
