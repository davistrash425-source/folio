import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { photoSource } from "@/lib/uploads";
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
  const inquiries = user.inquiries ?? [];
  const asked = new Set(inquiries.map((q) => q.photoId));
  const photos = Object.fromEntries(
    user.photos
      .filter((p) => asked.has(p.id) && !p.removed)
      .map((p) => {
        const source = photoSource(user.id, p);
        return [p.id, { src: source.srcSet?.split(",")[0].trim().split(" ")[0] ?? source.src, label: p.description ?? "" }];
      }),
  );
  return (
    <div className="bg-card border border-rule">
      <Inbox inquiries={inquiries} photos={photos} />
    </div>
  );
}
