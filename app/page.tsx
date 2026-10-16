import Link from "next/link";
import { buttonClass } from "@/app/ui/form";
import { ROOT_DOMAIN } from "@/lib/site";

// Laid out like a strip of frames on a contact sheet.
const steps = [
  ["Claim your address", `Sign up and pick yourname.${ROOT_DOMAIN}.`],
  ["Upload your work", "Photos are resized for the web and stripped of location data."],
  ["Describe & sort", "Add captions and locations, and group photos into albums."],
  ["Design your pages", "Home, galleries, about, contact — your theme, your layout."],
  ["Publish", "Preview on desktop and phone, then put it live."],
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-ink">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <span className="font-display text-2xl italic">Folio</span>
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/login" className="text-ink-soft underline-offset-4 hover:text-ink hover:underline">
              Log in
            </Link>
            <Link href="/signup" className={`${buttonClass} h-9 px-4`}>
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 pb-24">
        <section className="grid gap-10 py-16 sm:py-24 lg:grid-cols-[1fr_18rem] lg:items-end">
          <div>
            <p className="label text-accent">Portfolio sites for photographers</p>
            <h1 className="mt-4 max-w-3xl font-display text-5xl leading-[1.05] tracking-tight sm:text-7xl">
              Your work, on <em>your</em> own site — not lost in a feed.
            </h1>
          </div>
          <div className="space-y-6 lg:pb-3">
            <p className="text-ink-soft">
              No code and no hosting to set up. Upload your photos, shape the pages, and share one link
              with clients.
            </p>
            <Link href="/signup" className={`${buttonClass} h-12 px-6`}>
              Create your site →
            </Link>
          </div>
        </section>

        <ol className="grid border-t border-ink sm:grid-cols-5">
          {steps.map(([title, text], i) => (
            <li key={title} className="border-b border-rule py-6 sm:border-b-0 sm:border-r sm:px-5 sm:first:pl-0 sm:last:border-r-0">
              <span className="label text-ink-faint">Frame {String(i + 1).padStart(2, "0")}</span>
              <h2 className="mt-3 font-display text-2xl leading-tight">{title}</h2>
              <p className="mt-2 text-sm text-ink-soft">{text}</p>
            </li>
          ))}
        </ol>
      </main>

      <footer className="border-t border-rule">
        <p className="label mx-auto max-w-6xl px-6 py-6 text-ink-faint">Folio — made for people who make pictures</p>
      </footer>
    </div>
  );
}
