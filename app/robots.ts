import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { loadSite } from "@/lib/public-site";
import { AI_TRAINING_CRAWLERS, appUrl, siteSubdomain, siteUrl } from "@/lib/site";

// One robots.txt per host. A photographer's site may be crawled in full by
// search engines, but unless they allow it, the crawlers that collect pages
// for training AI are asked to stay away. The app keeps its private and
// duplicate addresses out of search results.
export default async function robots(): Promise<MetadataRoute.Robots> {
  const subdomain = siteSubdomain((await headers()).get("host") ?? "");
  if (subdomain) {
    const site = await loadSite(subdomain);
    const everyone = { userAgent: "*", allow: "/" };
    return {
      rules: site && !site.allowAiTraining ? [{ userAgent: AI_TRAINING_CRAWLERS, disallow: "/" }, everyone] : everyone,
      sitemap: `${siteUrl(subdomain)}/sitemap.xml`,
    };
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
