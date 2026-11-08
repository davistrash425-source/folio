"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
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

// A <details> drop-down menu: closes on an outside click, Escape closes it and
// returns to its button, and Up and Down move through its items.
function useMenu() {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const details = ref.current!;
    const onClick = (e: globalThis.MouseEvent) => {
      if (!details.contains(e.target as Node)) details.removeAttribute("open");
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  const onKeyDown = (e: KeyboardEvent<HTMLDetailsElement>) => {
    const details = ref.current!;
    if (e.key === "Escape" && details.open) {
      e.preventDefault();
      details.removeAttribute("open");
      details.querySelector("summary")?.focus();
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const items = Array.from(details.querySelectorAll<HTMLElement>("button:not([disabled]), a[href]"));
    if (items.length === 0) return;
    e.preventDefault();
    if (!details.open) details.setAttribute("open", "");
    const at = items.indexOf(document.activeElement as HTMLElement);
    const next = e.key === "ArrowDown" ? (at + 1) % items.length : (at <= 0 ? items.length : at) - 1;
    items[next].focus();
  };
  return { ref, onKeyDown };
}

// The Account menu in the dashboard header (app/dashboard/layout.tsx).
export function Menu({ className, children }: { className?: string; children: ReactNode }) {
  const { ref, onKeyDown } = useMenu();
  return (
    <details ref={ref} onKeyDown={onKeyDown} className={className}>
      {children}
    </details>
  );
}

// For admins, who can have several sites: which one the dashboard is showing,
// and a menu to switch to another or start a new one.
export function SiteSwitcher({ current, sites }: { current: string; sites: SiteChoice[] }) {
  const { ref, onKeyDown } = useMenu();
  const close = (e: MouseEvent<HTMLElement>) => e.currentTarget.closest("details")?.removeAttribute("open");
  return (
    <details ref={ref} onKeyDown={onKeyDown} className="relative">
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

// The preview button's default wording; the layout passes the real one
// ("Preview draft" or "Preview live site") once it has read the account.
const DEFAULT_PREVIEW_LABEL = "Preview website";

// Reading the URL needs a Suspense boundary; the *View versions render the
// same links without it (nothing highlighted) as the fallback.
export function DashboardTabs({ previewLabel }: { previewLabel?: string }) {
  return <DashboardTabsView pathname={usePathname()} previewLabel={previewLabel} />;
}

export function DashboardTabsView({ pathname, previewLabel = DEFAULT_PREVIEW_LABEL }: { pathname: string; previewLabel?: string }) {
  const managing = pathname.startsWith("/dashboard/manage");
  const previewing = pathname.startsWith("/dashboard/preview");
  return (
    <nav aria-label="Dashboard">
      <ul className="flex items-center gap-6">
        <li>
          <Link
            href="/dashboard/manage/photos"
            aria-current={managing ? "page" : undefined}
            className={`block border-b-2 py-4 text-sm font-medium transition-colors ${
              managing ? "border-accent text-ink" : "border-transparent text-ink-soft hover:text-ink"
            }`}
          >
            Manage website
          </Link>
        </li>
        <li>
          {/* A button rather than a tab: it opens the site as visitors would
              see it, and says whether that's the draft or the live site. */}
          <Link
            href="/dashboard/preview"
            aria-current={previewing ? "page" : undefined}
            className={`block border px-3 py-1.5 text-sm font-medium transition-colors ${
              previewing ? "border-ink bg-ink text-paper" : "border-ink text-ink hover:bg-ink hover:text-paper"
            }`}
          >
            {previewLabel}
          </Link>
        </li>
      </ul>
    </nav>
  );
}

// The tabs down the left of the workspace. Design covers everything about
// building the site (see DESIGN_SECTIONS); the rest are separate places.
const DESIGN_HREF = "/dashboard/manage/design";

const TABS = [
  { href: DESIGN_HREF, label: "Design" },
  { href: "/dashboard/manage/galleries", label: "Client galleries" },
  { href: "/dashboard/manage/messages", label: "Messages" },
  { href: "/dashboard/manage/billing", label: "Plan" },
];

// Only for accounts with Folio AGENTS switched on (agentsAllowed).
const AGENT_TABS = [
  { href: "/dashboard/manage/approvals", label: "Approvals" },
  { href: "/dashboard/manage/calendar", label: "Calendar" },
  { href: "/dashboard/manage/business", label: "Your business" },
];

const ACCOUNT_TAB = { href: "/dashboard/manage/account", label: "Account" };

// The sections inside Design, shown as a tab row at the top of each of them.
const DESIGN_SECTIONS = [
  { href: "/dashboard/manage/design", label: "Site design" },
  { href: "/dashboard/manage/photos", label: "All photos" },
  { href: "/dashboard/manage/upload", label: "Upload" },
  { href: "/dashboard/manage/albums", label: "Albums" },
  { href: "/dashboard/manage/publish", label: "Go live" },
];

const inSection = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);
const inDesign = (pathname: string) => DESIGN_SECTIONS.some((s) => inSection(pathname, s.href));

export type AgentNav = { pending: number };

export function SideNav({ unread, agents }: { unread: number; agents?: AgentNav }) {
  return <SideNavView unread={unread} agents={agents} pathname={usePathname()} />;
}

export function SideNavView({ unread, agents, pathname }: { unread: number; agents?: AgentNav; pathname: string }) {
  const tab = (t: { href: string; label: string }) => {
    const active = t.href === DESIGN_HREF ? inDesign(pathname) : inSection(pathname, t.href);
    return (
      <li key={t.href} className="shrink-0">
        <Link
          href={t.href}
          aria-current={active ? "page" : undefined}
          className={`flex items-baseline gap-3 whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors md:border-b-0 md:border-l-2 md:py-1.5 ${
            active ? "border-accent font-medium text-accent" : "border-transparent text-ink-soft hover:text-ink"
          }`}
        >
          <span className="flex-1">{t.label}</span>
          {t.label === "Messages" && unread > 0 && <span className="label bg-accent px-1.5 text-paper">{unread} new</span>}
          {t.label === "Approvals" && agents && agents.pending > 0 && (
            <span className="label bg-accent px-1.5 text-paper">{agents.pending} new</span>
          )}
        </Link>
      </li>
    );
  };
  const divider = <li aria-hidden="true" className="hidden md:my-3 md:block md:border-t md:border-rule" />;
  return (
    <nav aria-label="Workspace">
      {/* A list down the side on wide screens; one scrolling row on phones. */}
      <ul className="flex gap-1 overflow-x-auto [scrollbar-width:none] md:flex-col md:gap-0 md:overflow-visible">
        {TABS.map(tab)}
        {agents && AGENT_TABS.map(tab)}
        {divider}
        {tab(ACCOUNT_TAB)}
      </ul>
    </nav>
  );
}

// The row of sections at the top of the Design workspace. Renders nothing on
// any other page.
export function DesignTabs() {
  return <DesignTabsView pathname={usePathname()} />;
}

export function DesignTabsView({ pathname }: { pathname: string }) {
  if (!inDesign(pathname)) return null;
  return (
    <nav aria-label="Design sections" className="-mx-6 overflow-x-auto [scrollbar-width:none] border-b border-rule px-6 md:mx-0 md:px-0">
      <ul className="flex items-center gap-6">
        {DESIGN_SECTIONS.map((s) => {
          const active = inSection(pathname, s.href);
          return (
            <li key={s.href} className="shrink-0">
              <Link
                href={s.href}
                aria-current={active ? "page" : undefined}
                className={`block whitespace-nowrap border-b-2 py-3 text-sm font-medium transition-colors ${
                  active ? "border-accent text-ink" : "border-transparent text-ink-soft hover:text-ink"
                }`}
              >
                {s.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
