import Link from "next/link";
import type { ReactNode } from "react";
import { LEGAL_DRAFT, LEGAL_UPDATED } from "@/lib/legal";

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
      <Link href="/" className="font-display text-4xl italic">
        Folio
      </Link>
      {LEGAL_DRAFT && (
        <p className="mt-8 border border-accent p-3 text-sm text-ink-soft">
          Draft: this text is waiting for a legal review and may change.
        </p>
      )}
      <article className="mt-8 space-y-4 border-t border-ink pt-8 text-sm leading-relaxed text-ink-soft [&_a]:underline [&_h1]:font-display [&_h1]:text-3xl [&_h1]:text-ink [&_h2]:pt-4 [&_h2]:font-display [&_h2]:text-xl [&_h2]:text-ink [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
        {children}
        <p className="label text-ink-faint">Last updated {LEGAL_UPDATED}</p>
      </article>
      <nav className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-soft">
        <Link href="/terms" className="hover:underline">Terms</Link>
        <Link href="/privacy" className="hover:underline">Privacy</Link>
        <Link href="/copyright" className="hover:underline">Copyright</Link>
        <Link href="/report" className="hover:underline">Report a site</Link>
      </nav>
    </div>
  );
}
