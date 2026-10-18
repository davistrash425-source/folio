import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { visibleAlbums } from "@/lib/design";
import { loadSite } from "@/lib/public-site";
import { appUrl, siteSubdomain, siteUrl } from "@/lib/site";

// One sitemap per host: a photographer's pages and albums, or the app's
// public pages. Offline and missing sites list nothing.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const subdomain = siteSubdomain((await headers()).get("host") ?? "");
  if (!subdomain) {
    return ["/", "/signup", "/login"].map((path) => ({ url: appUrl(path) }));
  }
  const site = await loadSite(subdomain);
  if (!site) return [];
  const base = siteUrl(subdomain);
  const pageSlugs = new Set(site.design.pages.map((p) => p.slug));
  return [
    ...site.design.pages.map((p) => ({ url: p.slug ? `${base}/${p.slug}` : base })),
    // An album sharing a page's address is hidden behind the page.
    ...visibleAlbums(site.design, site.albums)
      .filter((a) => !pageSlugs.has(a.slug))
      .map((a) => ({ url: `${base}/${a.slug}` })),
  ];
}
