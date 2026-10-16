"use client";

import { useActionState } from "react";
import { sendInquiry } from "@/app/actions/site";

// Colors come from the site's CSS variables (see SiteRenderer).
export function ContactForm({ subdomain, preview }: { subdomain: string; preview?: boolean }) {
  const [state, action, pending] = useActionState(sendInquiry.bind(null, subdomain), {});
  const field =
    "w-full rounded-md border border-[var(--muted)]/40 bg-transparent px-3 py-2 text-sm text-[var(--fg)] outline-none focus:border-[var(--fg)]";
  const muted = "text-[var(--muted)]";

  if (state.ok) return <p className="py-6 text-left font-sans" aria-live="polite">{state.ok}</p>;

  return (
    <form action={action} className="grid w-full max-w-xl gap-3 text-left font-sans sm:grid-cols-2">
      <label className="block text-sm">
        Name
        <input name="name" required autoComplete="name" className={`mt-1 ${field}`} />
      </label>
      <label className="block text-sm">
        Email
        <input name="email" type="email" required autoComplete="email" className={`mt-1 ${field}`} />
      </label>
      <label className="block text-sm sm:col-span-2">
        Date or timeframe <span className={muted}>(optional)</span>
        <input name="date" placeholder="e.g. June 14, 2027" className={`mt-1 ${field}`} />
      </label>
      <label className="block text-sm sm:col-span-2">
        Message
        <textarea name="message" required rows={4} className={`mt-1 ${field}`} />
      </label>
      {/* Hidden from people; bots that fill it in are ignored. */}
      <div aria-hidden="true" className="absolute -left-[9999px]">
        <label>
          Company
          <input name="company" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button
          type="submit"
          disabled={pending || preview}
          className="rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-medium text-[var(--bg)] hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Sending…" : "Send message"}
        </button>
        {preview && <span className={`text-sm ${muted}`}>Visitors can send you messages here.</span>}
        {state.error && <p role="alert" className="text-sm text-red-500">{state.error}</p>}
      </div>
    </form>
  );
}
