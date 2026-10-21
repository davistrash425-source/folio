"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";
import { switchSite } from "@/app/actions/sites";

// The dashboard's top bar, pinned to the top of the screen. On phones only its
// <header> is pinned; from md up the whole bar is. Whichever part is pinned,
// its height goes in --dash-bar so other pinned things (the side menu, the
// design editor's toolbar) can sit just below it, even when the bar wraps.
export function StickyBar({ className, children }: { className: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const bar = ref.current!;
    const header = bar.querySelector("header")!;
    const measure = () => {
      const pinned = getComputedStyle(bar).position === "sticky" ? bar : header;
      document.documentElement.style.setProperty("--dash-bar", `${pinned.offsetHeight}px`);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

export type SiteChoice = { id: string; subdomain: string; name: string };

// For admins, who can have several sites: which one the dashboard is showing,
// and a menu to switch to another or start a new one.
export function SiteSwitcher({ current, sites }: { current: string; sites: SiteChoice[] }) {
  const close = (e: MouseEvent<HTMLElement>) => e.currentTarget.closest("details")?.removeAttribute("open");
  return (
    <details className="relative">
      <summary className="flex h-8 cursor-pointer list-none items-center gap-2 border border-rule px-2.5 text-sm hover:border-ink">
        <span className="label text-ink-faint">Site</span>
        <span className="font-medium">{sites.find((s) => s.id === current)?.subdomain}</span>
        <span aria-hidden="true" className="text-ink-faint">▾</span>
      </summary>
      <div className="absolute left-0 top-full z-50 mt-1 w-72 border border-ink bg-paper py-1 shadow-lg">
        <p className="label px-3 py-1.5 text-ink-faint">Your sites</p>
        <ul>
          {sites.map((s) => (
            <li key={s.id}>
              <form action={switchSite.bind(null, s.id)}>
                <button
                  disabled={s.id === current}
                  aria-current={s.id === current ? "true" : undefined}
                  className="flex w-full items-baseline gap-2 px-3 py-1.5 text-left text-sm hover:bg-card disabled:cursor-default disabled:hover:bg-transparent"
                >
                  <span className="w-3 text-accent">{s.id === current ? "✓" : ""}</span>
                  <span className="flex-1 truncate font-medium">{s.subdomain}</span>
                  <span className="max-w-[45%] truncate text-xs text-ink-faint">{s.name}</span>
                </button>
              </form>
            </li>
          ))}
        </ul>
        <Link href="/dashboard/sites/new" onClick={close} className="block border-t border-rule px-3 py-2 text-sm hover:bg-card">
          + New site
        </Link>
      </div>
    </details>
  );
}

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

// The steps to a finished site, in order. Each hint is shown under its label
// on wide screens.
const STEPS = [
  { href: "/dashboard/manage/upload", label: "Upload photos", hint: "Add pictures from your computer" },
  { href: "/dashboard/manage/photos", label: "All photos", hint: "Describe each photo" },
  { href: "/dashboard/manage/albums", label: "Albums", hint: "Group photos into collections" },
  { href: "/dashboard/manage/design", label: "Web design", hint: "Choose how your site looks" },
  { href: "/dashboard/manage/publish", label: "Go live", hint: "Put your site online" },
];

const SECONDARY = [
  { href: "/dashboard/manage/messages", label: "Messages" },
  { href: "/dashboard/manage/account", label: "Account" },
];

export function SideNav({ unread }: { unread: number }) {
  return <SideNavView unread={unread} pathname={usePathname()} />;
}

export function SideNavView({ unread, pathname }: { unread: number; pathname: string }) {
  // Numbered like frames on a contact sheet, each in its own box so they read
  // as steps. The boxes are all one size (tall enough for a two-line hint)
  // rather than fitting their text.
  const step = (s: (typeof STEPS)[number], n: number) => {
    const active = pathname.startsWith(s.href);
    return (
      <li key={s.href} className="shrink-0">
        <Link
          href={s.href}
          aria-current={active ? "page" : undefined}
          className={`flex w-40 items-baseline gap-3 border px-3 py-2 text-sm transition-colors md:h-20 md:w-auto md:py-2.5 ${
            active
              ? "border-accent bg-card text-ink"
              : "border-rule text-ink-soft hover:border-ink-faint hover:bg-card hover:text-ink"
          }`}
        >
          <span className={`label ${active ? "text-accent" : "text-ink-faint"}`}>{String(n).padStart(2, "0")}</span>
          <span className="flex-1">
            <span className={`block ${active ? "font-medium" : ""}`}>{s.label}</span>
            <span className="mt-0.5 hidden text-xs leading-snug text-ink-faint md:block">{s.hint}</span>
          </span>
        </Link>
      </li>
    );
  };
  // Messages and Account aren't steps, so they're plain links without numbers.
  const other = (s: (typeof SECONDARY)[number]) => {
    const active = pathname.startsWith(s.href);
    return (
      <li key={s.href} className="shrink-0">
        <Link
          href={s.href}
          aria-current={active ? "page" : undefined}
          className={`flex items-baseline gap-3 px-3 py-2 text-sm transition-colors md:py-1.5 ${
            active ? "font-medium text-accent" : "text-ink-soft hover:text-ink"
          }`}
        >
          <span className="flex-1">{s.label}</span>
          {s.label === "Messages" && unread > 0 && (
            <span className="label bg-accent px-1.5 text-paper">{unread} new</span>
          )}
        </Link>
      </li>
    );
  };
  return (
    <nav aria-label="Manage website" className="md:sticky md:top-[calc(var(--dash-bar,4rem)+2rem)]">
      {/* A sidebar on wide screens; a scrolling row of links on phones. */}
      <ul className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1 md:mx-0 md:flex-col md:overflow-visible md:px-0 md:pb-0">
        {STEPS.map((s, i) => step(s, i + 1))}
        <li aria-hidden="true" className="hidden md:my-3 md:block md:border-t md:border-rule" />
        {SECONDARY.map(other)}
      </ul>
    </nav>
  );
}
