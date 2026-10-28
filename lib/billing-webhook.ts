// What a verified Polar webhook does to an account. Kept out of the route so
// tests can call it directly.
import { findUserById, updateUser } from "./db";
import { grantsPro } from "./billing";
import { sendEmail } from "./email";
import { SUPPORT_EMAIL } from "./site";

type Subscription = {
  id?: string;
  status?: string;
  recurring_interval?: string;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean;
  modified_at?: string | null;
  metadata?: Record<string, unknown>;
  customer?: { external_id?: string | null };
};

export type PolarEvent = { type?: string; data?: Subscription };

// Returns a short word for logs and tests: what happened to the event.
export async function applyBillingEvent(eventId: string, event: PolarEvent) {
  if (!event.type?.startsWith("subscription.")) return "ignored";
  const sub = event.data;
  if (!sub?.id || !sub.status) return "ignored";
  const status = sub.status;

  // The account id we sent when the checkout was made; never the email.
  const userId = String(sub.customer?.external_id ?? sub.metadata?.userId ?? "");
  if (!userId || !(await findUserById(userId))) return "unknown account";

  const modifiedAt = sub.modified_at ?? undefined;
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
      if (last && last.updatedAt && modifiedAt && modifiedAt < last.updatedAt) {
        outcome = "stale";
        return;
      }
      u.billing = {
        subscriptionId: sub.id!,
        status,
        interval: sub.recurring_interval === "year" ? "year" : "month",
        currentPeriodEnd: sub.current_period_end ?? undefined,
        cancelAtPeriodEnd: sub.cancel_at_period_end ?? undefined,
        lastEventId: eventId,
        updatedAt: modifiedAt,
      };
      // An admin's manual choice stands. Otherwise the subscription decides.
      if (u.planSource === "manual") return;
      // A second, older subscription ending must not cancel a newer one.
      if (last && last.subscriptionId !== sub.id && grantsPro(last.status) && !grantsPro(status)) {
        u.billing = last;
        outcome = "other subscription";
        return;
      }
      const pro = grantsPro(status);
      downgraded = u.plan === "pro" && !pro;
      u.plan = pro ? "pro" : "free";
      u.planSource = "billing";
    });
  } catch (err) {
    if ((err as Error).message === "USER_NOT_FOUND") return "unknown account";
    throw err;
  }

  if (downgraded) {
    const user = await findUserById(userId);
    if (user) {
      await sendEmail({
        to: user.email,
        replyTo: SUPPORT_EMAIL,
        subject: "Your Folio Pro plan has ended",
        text: `Hi ${user.profile.name},\n\nYour Folio Pro subscription has ended, so your account is back on the Free plan. Nothing was deleted: your photos and site stay as they are. Pro-only features (client galleries, special themes, uploads beyond 150 photos) are paused until you subscribe again from Account → Plan.\n\nQuestions? Reply to this email.\n\nFolio`,
      }).catch((err) => console.error("Downgrade email failed", err));
    }
  }
  return outcome;
}
