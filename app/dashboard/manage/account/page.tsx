import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { ProfileForm } from "../../editor";
import { AccountSettings } from "../../panels";
import { Card, Loading, PageHeader } from "../section";

export const metadata = { title: "Account — Folio" };

export default function AccountPage({ searchParams }: PageProps<"/dashboard/manage/account">) {
  return (
    <>
      <PageHeader title="Account" />
      <Suspense fallback={<Loading />}>
        <Account searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Account({ searchParams }: { searchParams: PageProps<"/dashboard/manage/account">["searchParams"] }) {
  const user = await requireUser();
  const { verified } = await searchParams;
  return (
    <>
      {verified === "1" && (
        <p className="rounded-2xl bg-green-50 px-6 py-4 text-sm text-green-800 ring-1 ring-green-200">Thanks — your email is confirmed.</p>
      )}
      {verified === "expired" && !user.emailVerified && (
        <p className="rounded-2xl bg-red-50 px-6 py-4 text-sm text-red-800 ring-1 ring-red-200">
          That confirmation link has expired or was already used. Send a new one from the banner above.
        </p>
      )}
      <Card title="About you" subtitle="Your name, bio and contact details, shown on your site.">
        <ProfileForm profile={user.profile} />
      </Card>
      <Card title="Account" subtitle={`Signed in as ${user.email}.`}>
        <AccountSettings />
      </Card>
    </>
  );
}
