"use client";

/* eslint-disable @next/next/no-img-element -- user uploads are served by our own route */
import { useActionState, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { sendInquiry } from "@/app/actions/site";
import { INQUIRE_EVENT, INQUIRE_KEY } from "./lightbox";

const never = () => () => {};
const inquireInUrl = () => new URLSearchParams(window.location.search).get("inquire");
const storedPhoto = () => {
  try {
    return sessionStorage.getItem(INQUIRE_KEY);
  } catch {
    return null;
  }
};
const onServer = () => null;

// Colors come from the site's CSS variables (see SiteRenderer).
export function ContactForm({ subdomain, preview }: { subdomain: string; preview?: boolean }) {
  const [state, action, pending] = useActionState(sendInquiry.bind(null, subdomain), {});
  const formRef = useRef<HTMLFormElement>(null);
  // The photo asked about with the lightbox's "Inquire" button: from the
  // address when it came from another page, or from its event on this one.
  // undefined means "whatever the address says"; null, none.
  const fromUrl = useSyncExternalStore(never, inquireInUrl, onServer);
  const [picked, setPicked] = useState<string | null | undefined>(undefined);
  const photoId = picked === undefined ? fromUrl : picked;
  const stored = useSyncExternalStore(never, storedPhoto, onServer);
  let photo: { id: string; src?: string; label?: string } | null = photoId ? { id: photoId } : null;
  if (photoId && stored) {
    try {
      const saved = JSON.parse(stored);
      if (saved.id === photoId) photo = saved;
    } catch {}
  }

  useEffect(() => {
    const onInquire = (e: Event) => {
      setPicked((e as CustomEvent<string>).detail);
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      formRef.current?.querySelector<HTMLInputElement>("input[name=name]")?.focus({ preventScroll: true });
    };
    window.addEventListener(INQUIRE_EVENT, onInquire);
    return () => window.removeEventListener(INQUIRE_EVENT, onInquire);
  }, []);

  const field =
    "w-full rounded-md border border-[var(--muted)]/40 bg-transparent px-3 py-2 text-sm text-[var(--fg)] outline-none focus:border-[var(--fg)]";
  const muted = "text-[var(--muted)]";

  if (state.ok) return <p className="py-6 text-left font-sans" aria-live="polite">{state.ok}</p>;

  return (
    <form ref={formRef} id="inquire" action={action} className="grid w-full max-w-xl scroll-mt-24 gap-3 text-left font-sans sm:grid-cols-2">
      {photo && (
        <div className="flex items-center gap-3 rounded-md border border-[var(--muted)]/40 p-2 text-sm sm:col-span-2">
          <input type="hidden" name="photoId" value={photo.id} />
          {photo.src && <img src={photo.src} alt="" className="h-12 w-12 rounded object-cover" />}
          <span className="min-w-0 flex-1 truncate">
            About this photo{photo.label ? <span className={muted}>: {photo.label}</span> : null}
          </span>
          <button type="button" onClick={() => setPicked(null)} className={`px-2 ${muted} hover:text-[var(--fg)]`} aria-label="Don’t ask about this photo">
            ×
          </button>
        </div>
      )}
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
