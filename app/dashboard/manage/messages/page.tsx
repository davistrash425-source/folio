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
    <div className="bg-card border border-rule">
      <Inbox inquiries={user.inquiries ?? []} />
    </div>
  );
}
