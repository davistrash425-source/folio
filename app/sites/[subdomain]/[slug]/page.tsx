import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { loadSite } from "@/lib/public-site";
import { siteMetadata } from "../metadata";
import { SiteRenderer } from "../renderer";

// name.yourapp.com/about → /sites/name/about (a page or an album)
export async function generateMetadata({ params }: PageProps<"/sites/[subdomain]/[slug]">): Promise<Metadata> {
  const { subdomain, slug } = await params;
  return siteMetadata(subdomain, await loadSite(subdomain, slug));
}

export default function SitePathPage({ params }: PageProps<"/sites/[subdomain]/[slug]">) {
  return (
    <Suspense fallback={<div className="flex-1" />}>
      <SitePath params={params} />
    </Suspense>
  );
}

async function SitePath({ params }: { params: PageProps<"/sites/[subdomain]/[slug]">["params"] }) {
  const { subdomain, slug } = await params;
  const site = await loadSite(subdomain, slug);
  if (!site) notFound();
  return <SiteRenderer site={site} />;
}
