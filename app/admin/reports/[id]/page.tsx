import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { closeReport, reopenReport } from "@/app/actions/admin";
import { Card, Loading, PageHeader } from "@/app/dashboard/manage/section";
import { Button, Field, Input, SecondaryButton } from "@/app/ui/form";
import { requireAdmin } from "@/lib/admin";
import { findReport, findUserBySubdomain } from "@/lib/db";
import { REASON_LABELS, noticeText } from "@/lib/reports";
import { siteUrl } from "@/lib/site";
import { ViewerNote } from "../../parts";

export default function AdminReportPage({ params, searchParams }: PageProps<"/admin/reports/[id]">) {
  return (
    <Suspense fallback={<Loading />}>
      <ReportView params={params} searchParams={searchParams} />
    </Suspense>
  );
}

const when = (iso: string) => `${new Date(iso).toUTCString().slice(5, 22)} UTC`;

async function ReportView({ params, searchParams }: PageProps<"/admin/reports/[id]">) {
  const staff = await requireAdmin();
  const { id } = await params;
  const { done } = await searchParams;
  const report = await findReport(id);
  if (!report) notFound();
  const owner = await findUserBySubdomain(report.subdomain);
  const copyright = report.reason === "copyright";

  return (
    <>
      <PageHeader
        title={REASON_LABELS[report.reason] ?? report.reason}
        subtitle={`About ${report.subdomain} · received ${when(report.createdAt)} · ${report.status}`}
      />
      {typeof done === "string" && <p className="border-l-2 border-ink bg-card px-5 py-3 text-sm">{done}</p>}

      <Card title="The site">
        {owner ? (
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <span>{owner.profile.name}</span>
            <a href={siteUrl(owner.subdomain)} target="_blank" rel="noopener noreferrer" className="underline">
              {siteUrl(owner.subdomain).replace(/^https?:\/\//, "")} ↗
            </a>
            <Link href={`/admin/sites/${owner.subdomain}?report=${report.id}`} className="font-medium underline">
              Manage this site →
            </Link>
          </p>
        ) : (
          <p className="text-sm text-ink-soft">That site no longer exists.</p>
        )}
      </Card>

      <Card title={copyright ? "The notice" : "The report"} subtitle={`From ${report.reporterEmail}`}>
        <pre className="whitespace-pre-wrap break-words font-sans text-sm">
          {report.notice ? noticeText(report.notice) : report.details}
        </pre>
        {copyright && (
          <p className="border-l-2 border-accent bg-card px-5 py-3 text-sm">
            {report.notice
              ? "If the photos it lists are on the site, take them down from “Manage this site”, with this report chosen. That emails the photographer the notice and records a strike."
              : "This older report has no full notice. Reply to the sender for the missing details before taking anything down."}
          </p>
        )}
      </Card>

      {staff.role !== "admin" && <ViewerNote />}
      {(staff.role === "admin" || report.status === "closed") && (
        <Card title={report.status === "open" ? "Close it" : "Closed"}>
          {report.status === "open" ? (
            <form action={closeReport} className="flex max-w-xl flex-wrap items-end gap-3">
              <input type="hidden" name="reportId" value={report.id} />
              <div className="min-w-60 flex-1">
                <Field label="What you did (kept with the report)">
                  <Input name="note" placeholder="e.g. Not on the site any more" />
                </Field>
              </div>
              <Button type="submit">Close report</Button>
            </form>
          ) : (
            <form action={reopenReport} className="space-y-3">
              <input type="hidden" name="reportId" value={report.id} />
              <p className="text-sm">
                {report.note || "No note."} {report.closedAt && <span className="text-ink-soft">Closed {when(report.closedAt)}.</span>}
              </p>
              {staff.role === "admin" && <SecondaryButton type="submit">Reopen</SecondaryButton>}
            </form>
          )}
        </Card>
      )}
    </>
  );
}
