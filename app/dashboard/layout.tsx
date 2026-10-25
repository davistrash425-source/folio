import Link from "next/link";
import { Suspense } from "react";
import { logout } from "@/app/actions/auth";
import { currentAdmin, requireUser } from "@/lib/auth";
import { managedSites } from "@/lib/db";
import { isLive, isPublished, siteUrl } from "@/lib/site";
import { ImpersonationBanner } from "./impersonation-banner";
import { DashboardTabs, DashboardTabsView, SiteSwitcher, StickyBar } from "./nav";

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
              <SiteMenu />
            </Suspense>
            <Suspense fallback={null}>
              <SiteStatus />
            </Suspense>
            <AccountMenu />
          </div>
        </div>
      </StickyBar>
      {children}
      <ImpersonationBanner />
    </div>
  );
}

// Admins can have several sites; this menu switches between them.
async function SiteMenu() {
  const admin = await currentAdmin();
  if (!admin) return null;
  const user = await requireUser();
  const sites = [admin, ...(await managedSites(admin.id))];
  return <SiteSwitcher current={user.id} sites={sites.map((s) => ({ id: s.id, subdomain: s.subdomain, name: s.profile.name }))} />;
}

// Where the site stands, as a link: view it when it's live, otherwise go to
// the Go live page (which also covers confirming your email).
async function SiteStatus() {
  const user = await requireUser();
  const published = isPublished(user);
  const url = siteUrl(user.subdomain);
  if (user.suspended) {
    return (
      <span className="flex items-center gap-2 text-accent">
        <span className="label border border-accent px-1.5">Suspended</span>
        <span className="hidden sm:inline">Visitors can’t see your site</span>
      </span>
    );
  }
  if (isLive(user)) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-2 text-ink">
        <span className="label bg-ink px-1.5 text-paper">Live</span>
        <span className="underline-offset-4 group-hover:underline">{url.replace(/^https?:\/\//, "")} ↗</span>
      </a>
    );
  }
  return (
    <Link href="/dashboard/manage/publish" className="flex items-center gap-2 text-ink-soft hover:text-ink">
      <span className="label border border-ink-faint px-1.5 text-ink-soft">{published ? "Not live yet" : "Draft"}</span>
      <span className="underline-offset-4 hover:underline">{published ? "Confirm email →" : "Go live →"}</span>
    </Link>
  );
}

// "Log out" and the account settings, in one small menu instead of their own
// header row. Uses <details> like SiteSwitcher, so it needs no JavaScript.
function AccountMenu() {
  return (
    <details className="relative">
      <summary className="flex h-8 cursor-pointer list-none items-center gap-1 text-ink-soft hover:text-ink">
        Account <span aria-hidden="true" className="text-ink-faint">▾</span>
      </summary>
      <div className="absolute right-0 top-full z-50 mt-1 w-48 border border-ink bg-paper py-1 shadow-lg">
        <Link href="/dashboard/manage/account" className="block px-3 py-2 text-sm hover:bg-card">
          Account settings
        </Link>
        <form action={logout}>
          <button className="block w-full px-3 py-2 text-left text-sm hover:bg-card">Log out</button>
        </form>
      </div>
    </details>
  );
}
