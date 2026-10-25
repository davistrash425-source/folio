import Link from "next/link";
import { Suspense } from "react";
import { Card, Loading, PageHeader } from "@/app/dashboard/manage/section";
import { Button, Input, inputClass } from "@/app/ui/form";
import { requireAdmin } from "@/lib/admin";
import { adminLogChoices, listAdminLog } from "@/lib/db";
import { Pager, ViewerNote, when } from "../parts";

export const metadata = { title: "Log — Folio admin" };

export default function AdminLogPage({ searchParams }: PageProps<"/admin/log">) {
  return (
    <>
      <PageHeader title="Log" subtitle="Everything staff did or looked at, newest first." />
      <Suspense fallback={<Loading />}>
        <Log searchParams={searchParams} />
      </Suspense>
    </>
  );
}

const first = (value: string | string[] | undefined) => (typeof value === "string" ? value.trim().slice(0, 200) : "");

async function Log({ searchParams }: { searchParams: PageProps<"/admin/log">["searchParams"] }) {
  const staff = await requireAdmin();
  const query = await searchParams;
  const admin = first(query.admin);
  const action = first(query.action);
  const subdomain = first(query.site);
  const [{ rows, total, page, pages }, choices] = await Promise.all([
    listAdminLog({ admin, action, subdomain, page: Number(first(query.page)) || 1 }),
    adminLogChoices(),
  ]);
  const kept: Record<string, string> = {
    ...(admin ? { admin } : {}),
    ...(action ? { action } : {}),
    ...(subdomain ? { site: subdomain } : {}),
  };

  return (
    <>
      {staff.role === "viewer" && <ViewerNote />}
      <Card>
        <form action="/admin/log" className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="label text-ink-soft">Who</span>
            <select name="admin" defaultValue={admin} className={`mt-1 ${inputClass}`}>
              <option value="">Anyone</option>
              {choices.admins.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="label text-ink-soft">What</span>
            <select name="action" defaultValue={action} className={`mt-1 ${inputClass}`}>
              <option value="">Anything</option>
              {choices.actions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-40 text-sm">
            <span className="label text-ink-soft">Site</span>
            <Input name="site" defaultValue={subdomain} placeholder="site address" className="mt-1" />
          </label>
          <Button type="submit">Filter</Button>
        </form>
      </Card>
      <Card>
        {rows.length === 0 ? (
          <p className="text-sm text-ink-soft">Nothing logged yet.</p>
        ) : (
          <ul className="divide-y divide-rule border-y border-rule text-sm">
            {rows.map((entry, i) => (
              <li key={i} className="flex flex-wrap gap-x-4 gap-y-1 py-2">
                <span className="w-44 shrink-0 text-ink-soft">{when(entry.at)}</span>
                <span className="w-48 shrink-0 break-all">{entry.adminEmail}</span>
                <span className="label w-40 shrink-0 text-ink-soft">{entry.action}</span>
                <span className="min-w-60 flex-1">
                  <Link href={`/admin/sites/${entry.subdomain}`} className="mr-2 font-medium underline">
                    {entry.subdomain}
                  </Link>
                  {entry.detail}
                </span>
              </li>
            ))}
          </ul>
        )}
        <Pager path="/admin/log" params={kept} page={page} pages={pages} total={total} />
      </Card>
    </>
  );
}
