import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { billingConfigured } from "@/lib/billing";
import { FREE_PHOTO_LIMIT, PRO_GALLERY_LIMIT, PRO_PHOTO_LIMIT } from "@/lib/plans";
import { Card, Loading, PageHeader } from "../section";
import { BillingButtons } from "./buttons";

export const metadata = { title: "Plan — Folio" };

export default function BillingPage({ searchParams }: PageProps<"/dashboard/manage/billing">) {
  return (
    <>
      <PageHeader title="Plan" />
      <Suspense fallback={<Loading />}>
        <Plan searchParams={searchParams} />
      </Suspense>
    </>
  );
}

const date = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "";

async function Plan({ searchParams }: { searchParams: PageProps<"/dashboard/manage/billing">["searchParams"] }) {
  const user = await requireUser();
  const { welcome } = await searchParams;
  const pro = user.plan === "pro";
  const b = user.billing;
  return (
    <>
      {welcome === "1" && (
        <p className="border-l-2 border-ink bg-card px-5 py-3 text-sm">
          Thanks! Your payment is being confirmed. Pro switches on within a minute; refresh this page if it hasn’t yet.
        </p>
      )}
      <Card title={pro ? "Folio Pro" : "Free"} subtitle={pro ? "Your subscription is active." : "Up to 150 photos."}>
        {b && (
          <p className="text-sm">
            {b.cancelAtPeriodEnd
              ? `Your plan ends on ${date(b.currentPeriodEnd)}. You keep Pro until then.`
              : b.status === "past_due"
                ? "Your last payment didn’t go through. Update your card in the billing page to keep Pro."
                : pro && b.currentPeriodEnd
                  ? `Renews on ${date(b.currentPeriodEnd)} (${b.interval === "year" ? "yearly" : "monthly"}).`
                  : ""}
          </p>
        )}
        {user.planSource === "manual" && pro && <p className="text-sm">Pro was added to your account by Folio.</p>}
        {!pro && (
          <p className="text-sm">
            Pro gives you up to {PRO_PHOTO_LIMIT.toLocaleString("en-US")} photos (Free: {FREE_PHOTO_LIMIT}),{" "}
            {PRO_GALLERY_LIMIT} private client galleries, special themes and 50 GB of storage.
          </p>
        )}
        {user.managedBy ? (
          <p className="text-sm">Billing belongs to the main account.</p>
        ) : billingConfigured() ? (
          <BillingButtons subscribed={Boolean(b)} pro={pro} />
        ) : (
          <p className="text-sm text-ink-soft">Paid plans aren’t open yet.</p>
        )}
      </Card>
    </>
  );
}
