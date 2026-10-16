import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { siteData } from "@/lib/public-site";
import { LivePreview } from "./live-preview";

export const metadata = { title: "Preview — Folio", robots: { index: false } };

// The signed-in photographer's site with their draft design, published or
// not. Shown inside the dashboard's preview frames.
export default function SitePreviewPage({ searchParams }: PageProps<"/site-preview">) {
  return (
    <Suspense fallback={<div className="flex-1" />}>
      <Preview searchParams={searchParams} />
    </Suspense>
  );
}

async function Preview({ searchParams }: { searchParams: PageProps<"/site-preview">["searchParams"] }) {
  const user = await requireUser();
  const { path } = await searchParams;
  const site = siteData(user, { preview: true, path: typeof path === "string" ? path : "" });
  if (!site) notFound();
  return <LivePreview site={site} />;
}
