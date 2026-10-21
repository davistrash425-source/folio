import Link from "next/link";
import { Suspense } from "react";
import { logout } from "@/app/actions/auth";
import { requireUser } from "@/lib/auth";
import { isLive, isPublished, siteUrl } from "@/lib/site";
import { DashboardTabs, DashboardTabsView, StickyBar } from "./nav";
import { PublishToggle } from "./panels";

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <div className="flex flex-1 flex-col">
      {/* On phones the two wrappers drop out (`contents`), so the tabs pin to
          the top of the screen on their own and the site status scrolls away
          beneath them. From md up the whole bar is pinned. */}
      <StickyBar className="contents md:sticky md:top-0 md:z-40 md:block md:border-b md:border-ink md:bg-paper">
        <div className="contents md:mx-auto md:flex md:max-w-7xl md:flex-wrap md:items-center md:justify-between md:gap-x-6 md:px-6">
          <header className="sticky top-0 z-40 flex items-center gap-x-6 border-b border-ink bg-paper px-6 md:static md:flex-wrap md:gap-x-10 md:border-0 md:bg-transparent md:px-0">
            <Link href="/dashboard/manage/photos" className="font-display text-2xl italic">Folio</Link>
            <Suspense fallback={<DashboardTabsView pathname="" />}>
              <DashboardTabs />
            </Suspense>
          </header>
          <div className="flex flex-wrap items-center gap-4 border-b border-rule px-6 py-2 text-sm md:border-0 md:px-0">
            <Suspense fallback={null}>
              <SiteStatus />
            </Suspense>
            <form action={logout}>
              <button className="text-ink-soft underline-offset-4 hover:text-ink hover:underline">Log out</button>
            </form>
          </div>
        </div>
      </StickyBar>
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
