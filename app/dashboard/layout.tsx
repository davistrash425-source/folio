import Link from "next/link";
import { Suspense } from "react";
import { logout } from "@/app/actions/auth";
import { requireUser } from "@/lib/auth";
import { isPublished, siteUrl } from "@/lib/site";
import { DashboardTabs, DashboardTabsView } from "./nav";
import { PublishToggle } from "./panels";

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-3">
          <div className="flex flex-wrap items-center gap-6">
            <Link href="/dashboard/manage/photos" className="font-semibold tracking-tight">Folio</Link>
            <Suspense fallback={<DashboardTabsView pathname="" />}>
              <DashboardTabs />
            </Suspense>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Suspense fallback={null}>
              <SiteStatus />
            </Suspense>
            <form action={logout}>
              <button className="rounded-full px-3 py-2 text-zinc-600 hover:bg-zinc-100">Log out</button>
            </form>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}

// Whether the site is visible to the public, with a switch and a link to it.
async function SiteStatus() {
  const user = await requireUser();
  const published = isPublished(user);
  const url = siteUrl(user.subdomain);
  return (
    <>
      {published ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-full px-3 py-2 text-zinc-700 hover:bg-zinc-100">
          <span className="h-2 w-2 rounded-full bg-green-600" aria-hidden="true" />
          Live at {url.replace(/^https?:\/\//, "")} ↗
        </a>
      ) : (
        <span className="flex items-center gap-2 px-3 py-2 text-zinc-600">
          <span className="h-2 w-2 rounded-full bg-zinc-400" aria-hidden="true" />
          Site is offline
        </span>
      )}
      <PublishToggle published={published} />
    </>
  );
}
