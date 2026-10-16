import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { Inbox } from "../../panels";
import { Loading, PageHeader } from "../section";

export const metadata = { title: "Messages — Folio" };

export default function MessagesPage() {
  return (
    <>
      <PageHeader title="Messages" subtitle="Inquiries sent through the contact form on your site." />
      <Suspense fallback={<Loading />}>
        <Messages />
      </Suspense>
    </>
  );
}

async function Messages() {
  const user = await requireUser();
  return (
    <div className="rounded-2xl bg-white ring-1 ring-zinc-200">
      <Inbox inquiries={user.inquiries ?? []} />
    </div>
  );
}
