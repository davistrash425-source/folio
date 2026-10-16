import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { loadSite } from "@/lib/public-site";
import { siteMetadata } from "../metadata";
import { SiteTemplate } from "../templates";

// name.yourapp.com/weddings → /sites/name/weddings
export async function generateMetadata({ params }: PageProps<"/sites/[subdomain]/[album]">): Promise<Metadata> {
  const { subdomain, album } = await params;
  return siteMetadata(subdomain, await loadSite(subdomain, album));
}

export default function AlbumPage({ params }: PageProps<"/sites/[subdomain]/[album]">) {
  return (
    <Suspense fallback={<div className="flex-1" />}>
      <Album params={params} />
    </Suspense>
  );
}

async function Album({ params }: { params: PageProps<"/sites/[subdomain]/[album]">["params"] }) {
  const { subdomain, album } = await params;
  const site = await loadSite(subdomain, album);
  if (!site) notFound();
  return <SiteTemplate site={site} />;
}
