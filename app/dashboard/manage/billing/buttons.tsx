"use client";

import { useActionState } from "react";
import { openBillingPortal, startCheckout } from "@/app/actions/billing";
import { Button, Message, secondaryButtonClass } from "@/app/ui/form";
import { PRO_PRICE_MONTHLY, PRO_PRICE_YEARLY } from "@/lib/plans";

// Subscribed accounts manage things on Polar's page; the others pick a plan.
export function BillingButtons({ subscribed, pro }: { subscribed: boolean; pro: boolean }) {
  const [monthly, monthlyAction, monthlyPending] = useActionState(async () => startCheckout("month"), {});
  const [yearly, yearlyAction, yearlyPending] = useActionState(async () => startCheckout("year"), {});
  const [portal, portalAction, portalPending] = useActionState(async () => openBillingPortal(), {});
  const error = (monthly as { error?: string }).error ?? (yearly as { error?: string }).error ?? (portal as { error?: string }).error;
  return (
    <div className="flex flex-wrap items-center gap-3">
      {!pro && (
        <>
          <form action={monthlyAction}>
            <Button type="submit" disabled={monthlyPending || yearlyPending}>
              {monthlyPending ? "Opening…" : `Go Pro — $${PRO_PRICE_MONTHLY} a month`}
            </Button>
          </form>
          <form action={yearlyAction}>
            <button type="submit" disabled={monthlyPending || yearlyPending} className={secondaryButtonClass}>
              {yearlyPending ? "Opening…" : `$${PRO_PRICE_YEARLY} a year`}
            </button>
          </form>
        </>
      )}
      {subscribed && (
        <form action={portalAction}>
          <button type="submit" disabled={portalPending} className={secondaryButtonClass}>
            {portalPending ? "Opening…" : "Manage billing"}
          </button>
        </form>
      )}
      <Message error={error} />
    </div>
  );
}
