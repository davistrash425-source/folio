import Link from "next/link";

// Folio's staff pages: reports, takedowns and suspensions. Each page checks
// for an admin itself (lib/admin.ts); everyone else gets "not found".
export const metadata = { title: "Admin — Folio", robots: { index: false } };

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-ink">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-2 px-6 py-4">
          <Link href="/admin" className="font-display text-2xl italic">
            Folio admin
          </Link>
          <nav className="flex gap-6 text-sm">
            <Link href="/admin" className="underline-offset-4 hover:underline">
              Reports
            </Link>
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
