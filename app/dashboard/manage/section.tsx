import type { ReactNode } from "react";

// Title row and ruled section used by every Manage page.
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 pb-2">
      <div className="max-w-2xl">
        <h1 className="font-display text-4xl tracking-tight sm:text-5xl">{title}</h1>
        {subtitle && <p className="mt-2 text-ink-soft">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Card({ title, subtitle, children, id }: { title?: string; subtitle?: string; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="border-t border-ink pt-4">
      {(title || subtitle) && (
        <div className="mb-6 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          {title && <h2 className="label text-ink">{title}</h2>}
          {subtitle && <p className="text-sm text-ink-soft">{subtitle}</p>}
        </div>
      )}
      <div className="space-y-5">{children}</div>
    </section>
  );
}

export function Loading() {
  return <p className="label text-ink-faint">Loading…</p>;
}
