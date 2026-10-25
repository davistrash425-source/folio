import Link from "next/link";
import { Suspense } from "react";
import { Card, Loading, PageHeader } from "@/app/dashboard/manage/section";
import { requireAdmin } from "@/lib/admin";
import { listAllAccounts } from "@/lib/db";
import { siteUrl } from "@/lib/site";
import { ViewerNote, day, statusOf } from "../../parts";

export const metadata = { title: "All accounts — Folio admin" };

// Every account in one plain table, no paging or search: fine while Folio is
// small. Use /admin/accounts once it isn't.
export default function AllAccountsPage() {
  return (
    <>
      <PageHeader title="All accounts" subtitle={<Link href="/admin/accounts" className="underline">← Search and filter instead</Link>} />
      <Suspense fallback={<Loading />}>
        <AllAccounts />
      </Suspense>
    </>
  );
}

async function AllAccounts() {
  const staff = await requireAdmin();
  const accounts = await listAllAccounts();
  return (
    <>
      {staff.role === "viewer" && <ViewerNote />}
      <Card title={`${accounts.length} ${accounts.length === 1 ? "account" : "accounts"}`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="label text-ink-soft">
              <tr>
                <th className="py-2 pr-4 font-normal">Site</th>
                <th className="py-2 pr-4 font-normal">Name</th>
                <th className="py-2 pr-4 font-normal">Email</th>
                <th className="py-2 pr-4 font-normal">Status</th>
                <th className="py-2 pr-4 text-right font-normal">Photos</th>
                <th className="py-2 pr-4 font-normal">Joined</th>
                <th className="py-2 font-normal">Links</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule border-y border-rule">
              {accounts.map((a) => (
                <tr key={a.id}>
                  <td className="py-2 pr-4 font-medium">{a.subdomain}</td>
                  <td className="py-2 pr-4">{a.name}</td>
                  <td className="py-2 pr-4 break-all">{a.email}</td>
                  <td className="py-2 pr-4">{statusOf(a)}</td>
                  <td className="py-2 pr-4 text-right">{a.photos}</td>
                  <td className="py-2 pr-4 text-ink-soft">{day(a.createdAt)}</td>
                  <td className="py-2 whitespace-nowrap">
                    <Link href={`/admin/sites/${a.subdomain}`} className="underline">
                      Admin
                    </Link>{" "}
                    ·{" "}
                    <a href={siteUrl(a.subdomain)} target="_blank" rel="noopener noreferrer" className="underline">
                      Site ↗
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
