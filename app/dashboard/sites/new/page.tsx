import { notFound } from "next/navigation";
import { Suspense } from "react";
import { currentAdmin, requireUser } from "@/lib/auth";
import { ROOT_DOMAIN } from "@/lib/site";
import { Loading, PageHeader } from "../../manage/section";
import { NewSiteForm } from "../../panels";

export const metadata = { title: "New site — Folio" };

// Only admins can have more than one site.
export default function NewSitePage() {
  return (
    <div className="mx-auto w-full max-w-2xl flex-1 space-y-8 px-6 py-12">
      <PageHeader
        title="New site"
        subtitle="Another site with its own address, photos and design. Switch between your sites from the Site menu at the top."
      />
      <Suspense fallback={<Loading />}>
        <NewSite />
      </Suspense>
    </div>
  );
}

async function NewSite() {
  if (!(await currentAdmin())) {
    await requireUser();
    notFound();
  }
  return <NewSiteForm domain={ROOT_DOMAIN} />;
}
