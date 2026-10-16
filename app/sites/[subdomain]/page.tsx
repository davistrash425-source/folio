import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { loadSite } from "@/lib/public-site";
import { siteMetadata } from "./metadata";
import { SiteRenderer } from "./renderer";

// Reached through the proxy: name.yourapp.com → /sites/name

export async function generateMetadata({ params }: PageProps<"/sites/[subdomain]">): Promise<Metadata> {
  const { subdomain } = await params;
  return siteMetadata(subdomain, await loadSite(subdomain));
}

export default function SitePage({ params }: PageProps<"/sites/[subdomain]">) {
  return (
    <Suspense fallback={<div className="flex-1" />}>
      <Site params={params} />
    </Suspense>
  );
}

async function Site({ params }: { params: PageProps<"/sites/[subdomain]">["params"] }) {
  const site = await loadSite((await params).subdomain);
  if (!site) notFound();
  return <SiteRenderer site={site} />;
}
