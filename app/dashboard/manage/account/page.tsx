import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { ProfileForm } from "../../editor";
import { AccountSettings, AiTrainingForm } from "../../panels";
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
        <p className="border-l-2 border-ink bg-card px-5 py-3 text-sm">Thanks — your email is confirmed.</p>
      )}
      {verified === "expired" && !user.emailVerified && (
        <p className="border-l-2 border-accent bg-card px-5 py-3 text-sm text-accent">
          That confirmation link has expired or was already used. Send a new one from the banner above.
        </p>
      )}
      <Card title="About you" subtitle="Your name, bio and contact details, shown on your site.">
        <ProfileForm profile={user.profile} />
      </Card>
      <Card title="AI training" subtitle="Whether AI companies may collect your site and photos.">
        <AiTrainingForm blocked={!user.allowAiTraining} />
      </Card>
      <Card title="Account" subtitle={`Signed in as ${user.email}.`}>
        <AccountSettings />
      </Card>
    </>
  );
}
