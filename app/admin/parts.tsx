import Link from "next/link";
import type { ReactNode } from "react";
import type { AccountRow } from "@/lib/db";

// Small pieces the admin pages share.

export const when = (iso: string) => `${new Date(iso).toUTCString().slice(5, 22)} UTC`;
export const day = (iso: string) => new Date(iso).toISOString().slice(0, 10);

export function statusOf(a: Pick<AccountRow, "suspended" | "verified" | "published" | "live">) {
  if (a.suspended) return "Suspended";
  if (!a.verified) return "Unverified";
  if (!a.published) return "Draft";
  return a.live ? "Live" : "Draft";
}

// A page-width note shown to read-only staff.
export function ViewerNote() {
  return (
    <p className="border-l-2 border-ink-faint bg-card px-5 py-3 text-sm text-ink-soft">
      You have read-only access. You can look at everything here, but not change anything.
    </p>
  );
}

export function Done({ message }: { message: unknown }) {
  return typeof message === "string" ? <p className="border-l-2 border-ink bg-card px-5 py-3 text-sm">{message}</p> : null;
}

export function Stat({ label, value, href, alert = false }: { label: string; value: ReactNode; href?: string; alert?: boolean }) {
  const body = (
    <>
      <span className={`block font-display text-3xl ${alert ? "text-accent" : ""}`}>{value}</span>
      <span className="label text-ink-soft">{label}</span>
    </>
  );
  const box = "block border border-rule bg-card p-4";
  return href ? (
    <Link href={href} className={`${box} hover:border-ink`}>
      {body}
    </Link>
  ) : (
    <div className={box}>{body}</div>
  );
}

// Previous / next links that keep the other filters in the address.
export function Pager({ path, params, page, pages, total }: { path: string; params: Record<string, string>; page: number; pages: number; total: number }) {
  const link = (p: number) => {
    const query = new URLSearchParams({ ...params, ...(p > 1 ? { page: String(p) } : {}) });
    return `${path}${query.size ? `?${query}` : ""}`;
  };
  return (
    <nav aria-label="Pages" className="flex flex-wrap items-center gap-4 text-sm">
      <span className="text-ink-soft">
        {total} {total === 1 ? "result" : "results"} · page {page} of {pages}
      </span>
      {page > 1 && (
        <Link href={link(page - 1)} className="underline">
          ← Newer
        </Link>
      )}
      {page < pages && (
        <Link href={link(page + 1)} className="underline">
          Older →
        </Link>
      )}
    </nav>
  );
}
