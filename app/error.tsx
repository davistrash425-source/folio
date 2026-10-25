"use client";

import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { useEffect } from "react";

// Shown when a page crashes (the root layout still works; global-error.tsx
// covers the rest). Reports the error to Sentry.
export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <title>Something went wrong · Folio</title>
      <Link href="/" className="mb-10 font-display text-4xl italic">Folio</Link>
      <div className="w-full max-w-md border-t border-ink pt-8">
        <h1 className="font-display text-3xl">Something went wrong</h1>
        <p className="mt-2 text-ink-soft">We’ve been told about it. Please try again.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => retry()} className="bg-ink px-5 py-2.5 text-sm text-paper hover:bg-accent">
            Try again
          </button>
          <Link href="/" className="border border-ink px-5 py-2.5 text-sm hover:bg-ink/5">Go to the home page</Link>
        </div>
      </div>
    </div>
  );
}
