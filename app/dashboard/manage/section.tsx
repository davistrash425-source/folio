import type { ReactNode } from "react";

// Title row and white card used by every Manage page.
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Card({ title, subtitle, children, id }: { title?: string; subtitle?: string; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="rounded-2xl bg-white p-6 ring-1 ring-zinc-200">
      {title && <h2 className="text-lg font-semibold">{title}</h2>}
      {subtitle && <p className="mb-5 text-sm text-zinc-500">{subtitle}</p>}
      <div className="space-y-5">{children}</div>
    </section>
  );
}

export function Loading() {
  return <p className="text-sm text-zinc-500">Loading…</p>;
}
