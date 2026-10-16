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
      <ul className="flex gap-6">
        {TABS.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href === "/dashboard/manage" ? "/dashboard/manage/photos" : tab.href}
                aria-current={active ? "page" : undefined}
                className={`block border-b-2 py-4 text-sm font-medium transition-colors ${
                  active ? "border-accent text-ink" : "border-transparent text-ink-soft hover:text-ink"
                }`}
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
  // Numbered like frames on a contact sheet.
  const item = (s: { href: string; label: string }, n: number) => {
    const active = pathname.startsWith(s.href);
    return (
      <li key={s.href} className="shrink-0">
        <Link
          href={s.href}
          aria-current={active ? "page" : undefined}
          className={`flex items-baseline gap-3 border-b-2 py-2 text-sm transition-colors md:border-b-0 md:border-l-2 md:py-1.5 md:pl-3 ${
            active ? "border-accent font-medium text-ink" : "border-transparent text-ink-soft hover:text-ink"
          }`}
        >
          <span className={`label ${active ? "text-accent" : "text-ink-faint"}`}>{String(n).padStart(2, "0")}</span>
          <span className="flex-1">{s.label}</span>
          {s.label === "Messages" && unread > 0 && (
            <span className="label bg-accent px-1.5 text-paper">{unread} new</span>
          )}
        </Link>
      </li>
    );
  };
  return (
    <nav aria-label="Manage website" className="md:sticky md:top-8">
      {/* A sidebar on wide screens; a scrolling row of links on phones. */}
      <ul className="-mx-6 flex gap-5 overflow-x-auto border-b border-rule px-6 md:mx-0 md:flex-col md:gap-0.5 md:overflow-visible md:border-b-0 md:px-0">
        {SECTIONS.map((s, i) => item(s, i + 1))}
        <li aria-hidden="true" className="hidden md:my-4 md:block md:border-t md:border-rule" />
        {SECONDARY.map((s, i) => item(s, SECTIONS.length + i + 1))}
      </ul>
    </nav>
  );
}
