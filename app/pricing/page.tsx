import Link from "next/link";
import { buttonClass, secondaryButtonClass } from "@/app/ui/form";
import {
  FREE_PHOTO_LIMIT,
  PRO_GALLERY_LIMIT,
  PRO_PHOTO_LIMIT,
  PRO_PRICE_MONTH,
  PRO_PRICE_YEAR,
  PRO_STORAGE_LIMIT,
} from "@/lib/plans";
import { ROOT_DOMAIN, SUPPORT_EMAIL } from "@/lib/site";

export const metadata = {
  title: "Pricing — Folio",
  description: `Folio is free for up to ${FREE_PHOTO_LIMIT} photos. Folio Pro adds more photos, private client galleries and special themes.`,
};

const GB = 1024 ** 3;
const yearlySaving = PRO_PRICE_MONTH * 12 - PRO_PRICE_YEAR;

const free = [
  `Up to ${FREE_PHOTO_LIMIT} photos`,
  `Your own address, yourname.${ROOT_DOMAIN}`,
  "Every standard theme and the full design editor",
  "Albums, pages, captions and a contact form",
  "Web copies stripped of location data, with your name and copyright written in",
];

const pro = [
  `Up to ${PRO_PHOTO_LIMIT.toLocaleString("en-US")} photos`,
  `${PRO_STORAGE_LIMIT / GB} GB of storage`,
  `Up to ${PRO_GALLERY_LIMIT} private client galleries, with a password, an expiry date, favourites and zip download`,
  "Special themes (Contact sheet, Monograph) and extra options on the others",
  "No “Made with Folio” line on client galleries",
];

const questions = [
  [
    "What happens if I stop paying?",
    `Nothing is deleted. Your account goes back to Free: your site and photos stay online, and the Pro features pause until you subscribe again. If you have more than ${FREE_PHOTO_LIMIT} photos you keep them, but you can't add more until you are under the limit.`,
  ],
  [
    "Can I cancel any time?",
    "Yes, from Account → Plan. You keep Pro until the end of the period you have paid for.",
  ],
  [
    "Who takes the payment?",
    "Payments are handled by Polar, our payment provider. Folio never sees your card number.",
  ],
  ["Which currency?", "US dollars."],
];

export default function PricingPage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-ink">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="font-display text-2xl italic">
            Folio
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/login" className="text-ink-soft underline-offset-4 hover:text-ink hover:underline">
              Log in
            </Link>
            <Link href="/signup" className={`${buttonClass} h-9 px-4`}>
              Start free
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-16">
        <p className="label text-ink-faint">Pricing</p>
        <h1 className="mt-2 font-display text-5xl">Free to start. Pro when you need more room.</h1>
        <p className="mt-4 max-w-xl text-ink-soft">
          Every account gets a real website. Pro is for photographers with a bigger archive, or who share
          private galleries with clients.
        </p>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <section className="flex flex-col border border-ink p-6">
            <h2 className="font-display text-2xl">Free</h2>
            <p className="mt-2 font-display text-5xl">$0</p>
            <p className="label mt-1 text-ink-faint">Always</p>
            <ul className="mt-6 flex-1 space-y-2 text-sm text-ink-soft">
              {free.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <Link href="/signup" className={`${secondaryButtonClass} mt-8 h-12 px-6`}>
              Start free
            </Link>
          </section>

          <section className="flex flex-col border border-ink bg-ink/5 p-6">
            <h2 className="font-display text-2xl">Folio Pro</h2>
            <p className="mt-2 font-display text-5xl">
              ${PRO_PRICE_MONTH}
              <span className="text-lg text-ink-soft"> / month</span>
            </p>
            <p className="label mt-1 text-ink-faint">
              or ${PRO_PRICE_YEAR} a year (two months free, ${yearlySaving} saved)
            </p>
            <ul className="mt-6 flex-1 space-y-2 text-sm text-ink-soft">
              <li className="text-ink">Everything in Free, plus:</li>
              {pro.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <Link href="/signup" className={`${buttonClass} mt-8 h-12 px-6`}>
              Sign up, then go Pro
            </Link>
            <p className="mt-3 text-xs text-ink-faint">
              Already have an account? Upgrade from Account → Plan.
            </p>
          </section>
        </div>

        <section className="mt-16">
          <h2 className="font-display text-3xl">Questions</h2>
          <dl className="mt-6 space-y-6 text-sm">
            {questions.map(([q, a]) => (
              <div key={q}>
                <dt className="text-ink">{q}</dt>
                <dd className="mt-1 max-w-2xl text-ink-soft">{a}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-8 text-sm text-ink-soft">
            Something else?{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="underline underline-offset-4">
              {SUPPORT_EMAIL}
            </a>
          </p>
        </section>
      </main>

      <footer className="border-t border-ink">
        <nav className="mx-auto flex max-w-6xl flex-wrap gap-x-6 gap-y-2 px-6 py-8 text-sm text-ink-soft">
          <Link href="/terms" className="underline-offset-4 hover:text-ink hover:underline">
            Terms
          </Link>
          <Link href="/privacy" className="underline-offset-4 hover:text-ink hover:underline">
            Privacy
          </Link>
          <Link href="/copyright" className="underline-offset-4 hover:text-ink hover:underline">
            Copyright
          </Link>
        </nav>
      </footer>
    </div>
  );
}
