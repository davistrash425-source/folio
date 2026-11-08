import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { agentsAllowed } from "@/lib/plans";
import { Card, Loading, PageHeader } from "../section";
import { BusinessForm } from "./business-form";

export const metadata = { title: "Your business — Folio" };

export default function BusinessPage() {
  return (
    <>
      <PageHeader title="Your business" subtitle="Your agents use this when they draft replies. Nothing is sent without your approval." />
      <Suspense fallback={<Loading />}>
        <Business />
      </Suspense>
    </>
  );
}

async function Business() {
  const user = await requireUser();
  if (!agentsAllowed(user)) notFound();
  return (
    <Card>
      <BusinessForm business={user.business} />
    </Card>
  );
}
