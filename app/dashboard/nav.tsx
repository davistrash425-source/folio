"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard/manage", label: "Manage website" },
  { href: "/dashboard/preview", label: "Preview website" },
];

// Reading the URL needs a Suspense boundary; the *View versions render the
// same links without it (nothing highlighted) as the fallback.
export function DashboardTabs() {
  return <DashboardTabsView pathname={usePathname()} />;
}

export function DashboardTabsView({ pathname }: { pathname: string }) {
  return (
    <nav aria-label="Dashboard">
      <ul className="flex gap-1 rounded-full bg-zinc-100 p-1 text-sm">
        {TABS.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href === "/dashboard/manage" ? "/dashboard/manage/photos" : tab.href}
                aria-current={active ? "page" : undefined}
                className={`block rounded-full px-4 py-1.5 font-medium ${active ? "bg-white shadow-sm ring-1 ring-zinc-200" : "text-zinc-600 hover:text-black"}`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

const SECTIONS = [
  { href: "/dashboard/manage/upload", label: "Upload photos" },
  { href: "/dashboard/manage/photos", label: "All photos" },
  { href: "/dashboard/manage/albums", label: "Albums" },
  { href: "/dashboard/manage/design", label: "Web design" },
];

const SECONDARY = [
  { href: "/dashboard/manage/messages", label: "Messages" },
  { href: "/dashboard/manage/account", label: "Account" },
];

export function SideNav({ unread }: { unread: number }) {
  return <SideNavView unread={unread} pathname={usePathname()} />;
}

export function SideNavView({ unread, pathname }: { unread: number; pathname: string }) {
  const item = (s: { href: string; label: string }) => {
    const active = pathname.startsWith(s.href);
    return (
      <li key={s.href} className="shrink-0">
        <Link
          href={s.href}
          aria-current={active ? "page" : undefined}
          className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm ${
            active ? "bg-white font-medium shadow-sm ring-1 ring-zinc-200" : "text-zinc-600 hover:bg-zinc-100 hover:text-black"
          }`}
        >
          {s.label}
          {s.label === "Messages" && unread > 0 && (
            <span className="rounded-full bg-blue-600 px-1.5 text-xs font-medium text-white">{unread}</span>
          )}
        </Link>
      </li>
    );
  };
  return (
    <nav aria-label="Manage website" className="md:sticky md:top-6">
      {/* A sidebar on wide screens; a scrolling row of links on phones. */}
      <ul className="-mx-6 flex gap-1 overflow-x-auto px-6 pb-2 md:mx-0 md:flex-col md:overflow-visible md:px-0">
        {SECTIONS.map(item)}
        <li aria-hidden="true" className="hidden md:my-3 md:block md:border-t md:border-zinc-200" />
        {SECONDARY.map(item)}
      </ul>
    </nav>
  );
}
