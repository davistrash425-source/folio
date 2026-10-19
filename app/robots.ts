import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { appUrl, siteSubdomain, siteUrl } from "@/lib/site";

// One robots.txt per host: a photographer's site may be crawled in full; the
// app keeps its private and duplicate addresses out of search results.
export default async function robots(): Promise<MetadataRoute.Robots> {
  const subdomain = siteSubdomain((await headers()).get("host") ?? "");
  if (subdomain) {
    return { rules: { userAgent: "*", allow: "/" }, sitemap: `${siteUrl(subdomain)}/sitemap.xml` };
  }
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // /sites/<name> is each site again under the app's address.
      disallow: ["/dashboard", "/admin", "/api/", "/site-preview", "/sites/", "/reset-password", "/verify-email"],
    },
    sitemap: appUrl("/sitemap.xml"),
  };
}
