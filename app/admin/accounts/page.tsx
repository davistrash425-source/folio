import Link from "next/link";
import { Suspense } from "react";
import { Card, Loading, PageHeader } from "@/app/dashboard/manage/section";
import { Button, Input, inputClass } from "@/app/ui/form";
import { requireAdmin } from "@/lib/admin";
import { adminEmails } from "@/lib/auth";
import { isAccountFilter, listAccounts } from "@/lib/db";
import { Done, Pager, ViewerNote, day, statusOf } from "../parts";

export const metadata = { title: "Accounts — Folio admin" };

const FILTER_LABELS = {
  live: "Live",
  draft: "Draft",
  suspended: "Suspended",
  unverified: "Email not confirmed",
  strikes: "Has strikes",
  hold: "On legal hold",
  admin: "Admins",
} as const;

export default function AdminAccountsPage({ searchParams }: PageProps<"/admin/accounts">) {
  return (
    <>
      <PageHeader title="Accounts" subtitle="Everyone with a site, newest first." />
      <Suspense fallback={<Loading />}>
        <Accounts searchParams={searchParams} />
      </Suspense>
    </>
  );
}

const first = (value: string | string[] | undefined) => (typeof value === "string" ? value : "");

async function Accounts({ searchParams }: { searchParams: PageProps<"/admin/accounts">["searchParams"] }) {
  const staff = await requireAdmin();
  const query = await searchParams;
  const q = first(query.q).trim().slice(0, 100);
  const status = first(query.status);
  const filter = isAccountFilter(status) ? status : undefined;
  const { rows, total, page, pages } = await listAccounts({
    q,
    filter,
    page: Number(first(query.page)) || 1,
    admins: adminEmails(),
  });
  const kept: Record<string, string> = { ...(q ? { q } : {}), ...(filter ? { status: filter } : {}) };

  return (
    <>
      {staff.role === "viewer" && <ViewerNote />}
      <Done message={query.done} />
      <Card>
        <form action="/admin/accounts" className="flex flex-wrap items-end gap-3">
          <label className="min-w-60 flex-1 text-sm">
            <span className="label text-ink-soft">Search</span>
            <Input name="q" defaultValue={q} placeholder="name, email or site address" className="mt-1" />
          </label>
          <label className="text-sm">
            <span className="label text-ink-soft">Show</span>
            <select name="status" defaultValue={filter ?? ""} className={`mt-1 ${inputClass}`}>
              <option value="">Everyone</option>
              {Object.entries(FILTER_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit">Search</Button>
        </form>
        <p className="text-sm">
          <Link href="/admin/accounts/all" className="underline">
            See every account in one table →
          </Link>
        </p>
      </Card>

      <Card>
        {rows.length === 0 ? (
          <p className="text-sm text-ink-soft">No accounts match.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="label text-ink-soft">
                <tr>
                  <th className="py-2 pr-4 font-normal">Site</th>
                  <th className="py-2 pr-4 font-normal">Name</th>
                  <th className="py-2 pr-4 font-normal">Email</th>
                  <th className="py-2 pr-4 font-normal">Status</th>
                  <th className="py-2 pr-4 text-right font-normal">Photos</th>
                  <th className="py-2 font-normal">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule border-y border-rule">
                {rows.map((a) => (
                  <tr key={a.id}>
                    <td className="py-2 pr-4 font-medium">
                      <Link href={`/admin/sites/${a.subdomain}`} className="underline">
                        {a.subdomain}
                      </Link>
                      {a.extraSite && <span className="label ml-2 text-ink-faint">extra site</span>}
                    </td>
                    <td className="py-2 pr-4">{a.name}</td>
                    <td className="py-2 pr-4 break-all">{a.email}</td>
                    <td className="py-2 pr-4">
                      {statusOf(a)}
                      {a.strikes > 0 && <span className="ml-2 text-accent">{a.strikes} strike{a.strikes === 1 ? "" : "s"}</span>}
                      {a.hold && <span className="ml-2 text-ink-soft">hold</span>}
                    </td>
                    <td className="py-2 pr-4 text-right">{a.photos}</td>
                    <td className="py-2 text-ink-soft">{day(a.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager path="/admin/accounts" params={kept} page={page} pages={pages} total={total} />
      </Card>
    </>
  );
}
