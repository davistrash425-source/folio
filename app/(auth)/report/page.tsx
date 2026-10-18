import { Suspense } from "react";
import { ReportForm } from "./form";

export const metadata = { title: "Report a site — Folio", robots: { index: false } };

export default function ReportPage({ searchParams }: PageProps<"/report">) {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl">Report a site</h1>
      <p className="text-sm text-ink-soft">
        Tell us about photos used without permission, or anything illegal or harmful. The site’s owner isn’t told who
        reported it.
      </p>
      <Suspense fallback={<ReportForm site="" />}>
        <WithSite searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function WithSite({ searchParams }: { searchParams: PageProps<"/report">["searchParams"] }) {
  const { site } = await searchParams;
  return <ReportForm site={typeof site === "string" ? site.slice(0, 63) : ""} />;
}
