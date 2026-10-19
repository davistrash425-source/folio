import Link from "next/link";
import { Suspense } from "react";
import { logout } from "@/app/actions/auth";
import { requireUser } from "@/lib/auth";
import { isLive, isPublished, siteUrl } from "@/lib/site";
import { DashboardTabs, DashboardTabsView } from "./nav";
import { PublishToggle } from "./panels";

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-ink">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 px-6">
          <div className="flex flex-wrap items-center gap-x-10">
            <Link href="/dashboard/manage/photos" className="font-display text-2xl italic">Folio</Link>
            <Suspense fallback={<DashboardTabsView pathname="" />}>
              <DashboardTabs />
            </Suspense>
          </div>
          <div className="flex flex-wrap items-center gap-4 py-2 text-sm">
            <Suspense fallback={null}>
              <SiteStatus />
            </Suspense>
            <form action={logout}>
              <button className="text-ink-soft underline-offset-4 hover:text-ink hover:underline">Log out</button>
            </form>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}

// Whether the site is visible to the public, with a switch and a link to it.
// A site Folio has suspended stays offline whatever the switch says.
async function SiteStatus() {
  const user = await requireUser();
  const published = isPublished(user);
  const url = siteUrl(user.subdomain);
  if (user.suspended) {
    return (
      <span className="flex items-center gap-2 text-accent">
        <span className="label border border-accent px-1.5">Suspended</span>
        Visitors can’t see your site
      </span>
    );
  }
  return (
    <>
      {isLive(user) ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-2 text-ink">
          <span className="label bg-ink px-1.5 text-paper">Live</span>
          <span className="underline-offset-4 group-hover:underline">{url.replace(/^https?:\/\//, "")} ↗</span>
        </a>
      ) : published ? (
        <span className="flex items-center gap-2 text-ink-soft">
          <span className="label border border-ink-faint px-1.5 text-ink-soft">Not live yet</span>
          Confirm your email to put it online
        </span>
      ) : (
        <span className="flex items-center gap-2 text-ink-soft">
          <span className="label border border-ink-faint px-1.5 text-ink-soft">Offline</span>
          Visitors can’t see your site
        </span>
      )}
      <PublishToggle published={published} />
    </>
  );
}
