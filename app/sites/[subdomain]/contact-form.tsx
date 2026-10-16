"use client";

import { useActionState } from "react";
import { sendInquiry } from "@/app/actions/site";

const tones = {
  light: {
    input: "border-zinc-300 bg-white text-zinc-900 focus:border-zinc-900",
    button: "bg-zinc-900 text-white hover:bg-zinc-700",
    muted: "text-zinc-500",
  },
  dark: {
    input: "border-zinc-700 bg-zinc-950 text-zinc-100 focus:border-zinc-300",
    button: "bg-zinc-100 text-black hover:bg-white",
    muted: "text-zinc-500",
  },
  serif: {
    input: "border-stone-300 bg-white text-stone-900 focus:border-stone-900",
    button: "bg-stone-900 text-white hover:bg-stone-700",
    muted: "text-stone-500",
  },
};

export function ContactForm({
  subdomain,
  tone,
  preview,
}: {
  subdomain: string;
  tone: keyof typeof tones;
  preview?: boolean;
}) {
  const [state, action, pending] = useActionState(sendInquiry.bind(null, subdomain), {});
  const t = tones[tone];
  const field = `w-full rounded-md border px-3 py-2 text-sm outline-none ${t.input}`;

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
        Date or timeframe <span className={t.muted}>(optional)</span>
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
          className={`rounded-full px-5 py-2 text-sm font-medium disabled:opacity-50 ${t.button}`}
        >
          {pending ? "Sending…" : "Send message"}
        </button>
        {preview && <span className={`text-sm ${t.muted}`}>Visitors can send you messages here.</span>}
        {state.error && <p role="alert" className="text-sm text-red-500">{state.error}</p>}
      </div>
    </form>
  );
}
