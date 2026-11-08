// The "Book a date" section every theme can use, like Classic's contact
// section. It draws nothing unless the owner has Folio AGENTS on
// (site.bookingsOpen), so a saved section never shows a form that refuses.
import type { SiteData } from "@/lib/site-data";
import { BookingForm } from "./booking-form";

export function BookingSection({ site, title }: { site: Pick<SiteData, "subdomain" | "preview" | "bookingsOpen">; title: string }) {
  if (!site.bookingsOpen) return null;
  return (
    <section id="booking" className="mx-auto max-w-3xl px-6 py-16">
      <h2 className="mb-6 text-center text-sm uppercase tracking-widest text-[var(--muted)]">{title}</h2>
      <div className="flex justify-center">
        <BookingForm subdomain={site.subdomain} preview={site.preview} />
      </div>
    </section>
  );
}
