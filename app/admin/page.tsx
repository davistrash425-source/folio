import Link from "next/link";
import { Suspense } from "react";
import { addRightsToOlderPhotos } from "@/app/actions/admin";
import { Card, Loading, PageHeader } from "@/app/dashboard/manage/section";
import { Button, Input } from "@/app/ui/form";
import { requireAdmin } from "@/lib/admin";
import { UNVERIFIED_ATTENTION_DAYS, adminOverview, photosWithoutRights } from "@/lib/db";
import { REASON_LABELS } from "@/lib/reports";
import { Done, Stat, ViewerNote, day, when } from "./parts";

// Adding copyright details to older photos takes a while.
export const maxDuration = 60;

export default function AdminPage({ searchParams }: PageProps<"/admin">) {
  return (
    <>
      <PageHeader title="Overview" subtitle="How Folio is doing, and what needs you." />
      <Suspense fallback={<Loading />}>
        <Overview searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Overview({ searchParams }: { searchParams: PageProps<"/admin">["searchParams"] }) {
  const staff = await requireAdmin();
  const [o, withoutRights, { done }] = await Promise.all([adminOverview(), photosWithoutRights(), searchParams]);
  const nothingNeedsYou = !o.oldestOpenReports.length && !o.staleUnverified.length && !o.suspendedSites.length;
  return (
    <>
      {staff.role === "viewer" && <ViewerNote />}
      <Done message={done} />

      <Card title="Accounts">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Accounts" value={o.accounts} href="/admin/accounts" />
          <Stat label="Live sites" value={o.live} href="/admin/accounts?status=live" />
          <Stat label="Drafts" value={o.draft} href="/admin/accounts?status=draft" />
          <Stat label="Suspended" value={o.suspended} href="/admin/accounts?status=suspended" alert={o.suspended > 0} />
          <Stat label="Email not confirmed" value={o.unverified} href="/admin/accounts?status=unverified" />
          <Stat label="With strikes" value={o.withStrikes} href="/admin/accounts?status=strikes" alert={o.withStrikes > 0} />
          <Stat label="On legal hold" value={o.onHold} href="/admin/accounts?status=hold" />
          <Stat label="Photos" value={o.photos.toLocaleString("en-US")} />
          <Stat label="New in 7 days" value={o.signups7} />
          <Stat label="New in 30 days" value={o.signups30} />
          <Stat label="Open reports" value={o.openReports} href="/admin/reports" alert={o.openReports > 0} />
          <Stat label="Open copyright notices" value={o.openCopyright} href="/admin/reports" alert={o.openCopyright > 0} />
        </div>
      </Card>

      <Card title="Needs attention">
        {nothingNeedsYou ? (
          <p className="text-sm text-ink-soft">Nothing right now.</p>
        ) : (
          <div className="space-y-6 text-sm">
            {o.oldestOpenReports.length > 0 && (
              <div>
                <h3 className="label mb-2 text-ink-soft">Open reports, oldest first</h3>
                <ul className="divide-y divide-rule border-y border-rule">
                  {o.oldestOpenReports.map((r) => (
                    <li key={r.id}>
                      <Link href={`/admin/reports/${r.id}`} className="flex flex-wrap gap-x-4 py-2 hover:bg-ink/5">
                        <span className="font-medium">{r.subdomain}</span>
                        <span>{REASON_LABELS[r.reason] ?? r.reason}</span>
                        <span className="ml-auto text-ink-soft">{when(r.createdAt)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {o.staleUnverified.length > 0 && (
              <div>
                <h3 className="label mb-2 text-ink-soft">Email still not confirmed after {UNVERIFIED_ATTENTION_DAYS} days</h3>
                <ul className="divide-y divide-rule border-y border-rule">
                  {o.staleUnverified.map((u) => (
                    <li key={u.subdomain}>
                      <Link href={`/admin/sites/${u.subdomain}`} className="flex flex-wrap gap-x-4 py-2 hover:bg-ink/5">
                        <span className="font-medium">{u.subdomain}</span>
                        <span>{u.email}</span>
                        <span className="ml-auto text-ink-soft">joined {day(u.createdAt)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {o.suspendedSites.length > 0 && (
              <div>
                <h3 className="label mb-2 text-ink-soft">Suspended sites</h3>
                <ul className="divide-y divide-rule border-y border-rule">
                  {o.suspendedSites.map((s) => (
                    <li key={s.subdomain}>
                      <Link href={`/admin/sites/${s.subdomain}`} className="flex flex-wrap gap-x-4 py-2 hover:bg-ink/5">
                        <span className="font-medium">{s.subdomain}</span>
                        <span>{s.reason}</span>
                        <span className="ml-auto text-ink-soft">{when(s.at)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Card>

      <Card title="Look up a site">
        <form action="/admin/sites" className="flex max-w-md gap-3">
          <Input name="name" required placeholder="the name before the dot" aria-label="Site name" />
          <Button type="submit">Open</Button>
        </form>
      </Card>

      {withoutRights > 0 && staff.role === "admin" && (
        <Card title="Older photos">
          <form action={addRightsToOlderPhotos} className="flex flex-wrap items-center gap-4">
            <p className="text-sm">
              {withoutRights === 1 ? "1 photo was" : `${withoutRights} photos were`} uploaded before photos carried their
              photographer’s name and copyright notice.
            </p>
            <Button type="submit">Add it to them</Button>
          </form>
        </Card>
      )}
    </>
  );
}
