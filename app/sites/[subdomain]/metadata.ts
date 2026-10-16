import type { Metadata } from "next";
import type { SiteData } from "@/lib/public-site";
import { siteUrl } from "@/lib/site";

// Metadata for the site home page and album pages.
export function siteMetadata(subdomain: string, site: SiteData | null): Metadata {
  if (!site) return { title: "Site not found" };
  const title = site.album
    ? `${site.album.title} — ${site.profile.name}`
    : `${site.profile.name} — Photography`;
  const cover = site.photos[0];
  return {
    title,
    description: site.profile.bio.slice(0, 160) || `Photography by ${site.profile.name}`,
    // Photo URLs are relative; link previews need them absolute.
    metadataBase: new URL(siteUrl(subdomain)),
    openGraph: cover
      ? { title, images: [{ url: cover.src, alt: cover.alt }] }
      : { title },
  };
}
