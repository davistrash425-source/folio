import { appUrl } from "@/lib/site";
import type { SiteData } from "@/lib/site-data";

// The small "Report" link in every theme's footer, to the report form on
// the app. Not shown in the dashboard preview.
export function ReportLink({ site, className = "" }: { site: Pick<SiteData, "subdomain" | "preview">; className?: string }) {
  if (site.preview) return null;
  return (
    <a href={appUrl(`/report?site=${encodeURIComponent(site.subdomain)}`)} rel="nofollow" className={`underline-offset-4 hover:underline ${className}`}>
      Report
    </a>
  );
}
