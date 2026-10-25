import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { galleryLimit } from "@/lib/plans";
import { siteUrl } from "@/lib/site";
import { CreateGalleryForm } from "../../galleries";
import { Card, Loading, PageHeader } from "../section";

export const metadata = { title: "Client galleries — Folio" };

export default function GalleriesPage() {
  return (
    <>
      <PageHeader
        title="Client galleries"
        subtitle="Share a private set of photos with one client. They open a link and type the password you chose."
      />
      <Suspense fallback={<Loading />}>
        <GalleryList />
      </Suspense>
    </>
  );
}

async function GalleryList() {
  const user = await requireUser();
  const galleries = user.galleries ?? [];
  const limit = galleryLimit(user);
  return (
    <>
      {limit === 0 && (
        <Card>
          <div className="max-w-xl space-y-2 py-4">
            <h2 className="font-display text-2xl">Part of Folio Pro</h2>
            <p className="text-ink-soft">
              Client galleries are included with Folio Pro, which isn’t open yet. Your portfolio and its four themes stay
              free.
            </p>
          </div>
        </Card>
      )}
      {galleries.length > 0 && (
        <ul className="divide-y divide-rule border-y border-rule">
          {galleries.map((g) => (
            <li key={g.id}>
              <Link href={`/dashboard/manage/galleries/${g.id}`} className="flex items-baseline justify-between gap-4 py-3 hover:bg-card">
                <span className="font-medium">{g.title}</span>
                <span className="text-sm text-ink-soft">
                  {g.photoIds.length} photo{g.photoIds.length === 1 ? "" : "s"} · {siteUrl(user.subdomain).replace(/^https?:\/\//, "")}/g/{g.slug}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {limit > 0 && galleries.length < limit && (
        <Card title="New gallery" subtitle={`${galleries.length} of ${limit} used`}>
          <CreateGalleryForm />
        </Card>
      )}
    </>
  );
}
