import Link from "next/link";
import { Suspense } from "react";
import { Card, Loading, PageHeader } from "@/app/dashboard/manage/section";
import { requireAdmin } from "@/lib/admin";
import { listReports } from "@/lib/db";
import { REASON_LABELS } from "@/lib/reports";
import { ViewerNote } from "../parts";

export const metadata = { title: "Reports — Folio admin" };

export default function AdminReportsPage() {
  return (
    <>
      <PageHeader title="Reports" subtitle="Open reports first. Act on copyright notices within a day or two." />
      <Suspense fallback={<Loading />}>
        <Reports />
      </Suspense>
    </>
  );
}

async function Reports() {
  const staff = await requireAdmin();
  const reports = await listReports();
  return (
    <>
      {staff.role === "viewer" && <ViewerNote />}
      <Card title={`${reports.filter((r) => r.status === "open").length} open`}>
        {reports.length === 0 ? (
          <p className="text-sm text-ink-soft">No reports yet.</p>
        ) : (
          <ul className="divide-y divide-rule border-y border-rule">
            {reports.map((report) => (
              <li key={report.id}>
                <Link href={`/admin/reports/${report.id}`} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3 hover:bg-ink/5">
                  <span className={`label w-16 ${report.status === "open" ? "text-accent" : "text-ink-faint"}`}>{report.status}</span>
                  <span className="font-medium">{report.subdomain}</span>
                  <span className="text-sm">{REASON_LABELS[report.reason] ?? report.reason}</span>
                  <span className="ml-auto text-sm text-ink-soft">{new Date(report.createdAt).toUTCString().slice(5, 22)} UTC</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
