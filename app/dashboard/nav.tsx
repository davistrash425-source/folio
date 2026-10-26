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

// For admins, who can have several sites: which one the dashboard is showing,
// and a menu to switch to another or start a new one. Closes on outside click
// (the browser already closes it on Escape).
export function SiteSwitcher({ current, sites }: { current: string; sites: SiteChoice[] }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const details = ref.current!;
    const onClick = (e: globalThis.MouseEvent) => {
      if (!details.contains(e.target as Node)) details.removeAttribute("open");
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  const close = (e: MouseEvent<HTMLElement>) => e.currentTarget.closest("details")?.removeAttribute("open");
  // Up and Down move through the sites; Escape closes the menu and returns to its button.
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
  { href: "/dashboard/manage/galleries", label: "Client galleries" },
  { href: "/dashboard/manage/messages", label: "Messages" },
  { href: "/dashboard/manage/billing", label: "Plan" },
  { href: "/dashboard/manage/account", label: "Account" },
];

export function SideNav({ unread, done }: { unread: number; done?: boolean[] }) {
  return <SideNavView unread={unread} done={done} pathname={usePathname()} />;
}

export function SideNavView({ unread, done = [], pathname }: { unread: number; done?: boolean[]; pathname: string }) {
  const finished = done.filter(Boolean).length;
  // Numbered like frames on a contact sheet, each in its own box so they read
  // as steps. Finished steps tick themselves off; the boxes are all one size
  // (tall enough for a two-line hint) rather than fitting their text.
  const step = (s: (typeof STEPS)[number], n: number) => {
    const active = pathname.startsWith(s.href);
    const isDone = Boolean(done[n - 1]);
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
          <span className={`label ${active || isDone ? "text-accent" : "text-ink-faint"}`}>
            {isDone ? "✓" : String(n).padStart(2, "0")}
          </span>
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
      {/* A sidebar on wide screens; a wrapping row of steps on phones. */}
      <p className="mb-3 hidden text-xs text-ink-faint md:block">
        {finished} of {STEPS.length} done
      </p>
      <ul className="flex flex-wrap gap-2 md:flex-col md:gap-0">
        {STEPS.map((s, i) => step(s, i + 1))}
        <li aria-hidden="true" className="hidden md:my-3 md:block md:border-t md:border-rule" />
        {SECONDARY.map(other)}
      </ul>
    </nav>
  );
}
