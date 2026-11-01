import Link from "next/link";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-8 sm:py-12">
      <Link href="/" className="mb-6 font-display text-4xl italic">
        Folio
      </Link>
      <div className="w-full max-w-sm border-t border-ink pt-6">
        {children}
      </div>
    </div>
  );
}
