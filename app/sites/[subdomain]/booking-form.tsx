"use client";

import { useActionState } from "react";
import { submitBookingRequest } from "@/app/actions/booking-request";
import { Turnstile } from "@/app/ui/turnstile";
import { keepFields } from "@/app/ui/keep-fields";

// Colors come from the site's CSS variables (see SiteRenderer).
export function BookingForm({ subdomain, preview }: { subdomain: string; preview?: boolean }) {
  const [state, action, pending] = useActionState(keepFields(submitBookingRequest.bind(null, subdomain)), {});
  const f = state.fields ?? {};

  const field =
    "w-full rounded-md border border-[var(--muted)]/40 bg-transparent px-3 py-2 text-sm text-[var(--fg)] outline-none focus:border-[var(--fg)]";
  const muted = "text-[var(--muted)]";

  if (state.ok) return <p className="py-6 text-left font-sans" aria-live="polite">{state.ok}</p>;

  return (
    <form action={action} className="grid w-full max-w-xl gap-3 text-left font-sans sm:grid-cols-2">
      <label className="block text-sm">
        Name
        <input name="name" required maxLength={80} autoComplete="name" defaultValue={f.name} className={`mt-1 ${field}`} />
      </label>
      <label className="block text-sm">
        Email
        <input name="email" type="email" required maxLength={120} autoComplete="email" defaultValue={f.email} className={`mt-1 ${field}`} />
      </label>
      <label className="block text-sm sm:col-span-2">
        Date
        <input name="date" type="date" required defaultValue={f.date} className={`mt-1 ${field}`} />
      </label>
      <label className="block text-sm sm:col-span-2">
        What are you planning? <span className={muted}>(optional)</span>
        <textarea name="message" rows={4} maxLength={2000} defaultValue={f.message} className={`mt-1 ${field}`} />
      </label>
      {/* Hidden from people; bots that fill it in are ignored. */}
      <div aria-hidden="true" className="absolute -left-[9999px]">
        <label>
          Company
          <input name="company" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      {!preview && <Turnstile resetKey={state} />}
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button
          type="submit"
          disabled={pending || preview}
          className="rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-medium text-[var(--bg)] hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Sending…" : "Request this date"}
        </button>
        {preview && <span className={`text-sm ${muted}`}>Visitors can ask for a date here.</span>}
        {state.error && <p role="alert" className="text-sm text-red-500">{state.error}</p>}
      </div>
      <p className={`text-xs sm:col-span-2 ${muted}`}>This asks for the date. Nothing is booked until the photographer confirms.</p>
    </form>
  );
}
