import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { siteData } from "@/lib/public-site";
import { SiteTemplate } from "@/app/sites/[subdomain]/templates";

export const metadata = { title: "Preview — Folio", robots: { index: false } };

// Shows the signed-in photographer their site, published or not.
export default function PreviewPage({ searchParams }: PageProps<"/dashboard/preview">) {
  return (
    <Suspense fallback={<div className="flex-1" />}>
      <Preview searchParams={searchParams} />
    </Suspense>
  );
}

async function Preview({ searchParams }: { searchParams: PageProps<"/dashboard/preview">["searchParams"] }) {
  const user = await requireUser();
  const { album } = await searchParams;
  const site = siteData(user, { preview: true, album: typeof album === "string" ? album : undefined });
  if (!site) notFound();
  return (
    <>
      <p className="sticky top-0 z-40 bg-amber-100 px-4 py-2 text-center font-sans text-sm text-amber-900">
        Preview{user.published === false ? " — your site is a draft and not visible to others yet" : ""}
      </p>
      <SiteTemplate site={site} />
    </>
  );
}
