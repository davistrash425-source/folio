import Link from "next/link";

// Folio's staff pages: overview, reports, accounts and the log. Each page
// checks for staff itself (lib/admin.ts); everyone else gets "not found".
export const metadata = { title: "Admin — Folio", robots: { index: false } };

const LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/accounts", label: "Accounts" },
  { href: "/admin/accounts/all", label: "All accounts" },
  { href: "/admin/log", label: "Log" },
];

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-ink">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-2 px-6 py-4">
          <Link href="/admin" className="font-display text-2xl italic">
            Folio admin
          </Link>
          <nav aria-label="Admin" className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="underline-offset-4 hover:underline">
                {l.label}
              </Link>
            ))}
            <Link href="/dashboard" className="text-ink-soft underline-offset-4 hover:text-ink hover:underline">
              Your dashboard
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-10 px-6 py-10">{children}</main>
    </div>
  );
}
