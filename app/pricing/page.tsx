import Link from "next/link";
import { Suspense } from "react";
import { buttonClass, secondaryButtonClass } from "@/app/ui/form";
import { currentUser } from "@/lib/auth";
import { billingConfigured } from "@/lib/billing";
import { PRO_THEMES } from "@/lib/design";
import {
  FREE_PHOTO_LIMIT,
  PRO_GALLERY_LIMIT,
  PRO_PHOTO_LIMIT,
  PRO_PRICE_MONTHLY,
  PRO_PRICE_YEARLY,
  PRO_STORAGE_LIMIT,
} from "@/lib/plans";
import { SUPPORT_EMAIL } from "@/lib/site";

export const metadata = {
  title: "Pricing — Folio",
  description: "Folio is free to start. Folio Pro adds more photos, private client galleries and special themes.",
};

const GB = 1024 ** 3;
const n = (x: number) => x.toLocaleString("en-US");

const rows: [string, string, string][] = [
  ["Your own address", "Yes", "Yes"],
  ["Photos", n(FREE_PHOTO_LIMIT), n(PRO_PHOTO_LIMIT)],
  ["Storage", "Enough for your photos", `${PRO_STORAGE_LIMIT / GB} GB`],
  ["Standard themes", "Yes", "Yes"],
  ["Special themes", "No", `${PRO_THEMES.length} extra (Contact sheet, Monograph, Tag, Mosaic, Studio)`],
  ["Private client galleries", "No", `Up to ${PRO_GALLERY_LIMIT}`],
  ["“Made with Folio” on client galleries", "Shown", "Removed"],
];

export default function Pricing() {
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
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-16 sm:py-24">
        <p className="label text-accent">Pricing</p>
        <h1 className="mt-5 font-display text-4xl leading-[1.05] tracking-tight sm:text-6xl">
          Free to start. <em className="text-accent">Pro</em> when you need more room.
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-soft">
          Every account gets a portfolio site at its own address. Pro adds more photos, private galleries for clients
          and extra themes.
        </p>

        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          <section className="border border-ink p-6">
            <h2 className="font-display text-3xl">Free</h2>
            <p className="mt-2 font-display text-4xl">$0</p>
            <p className="mt-1 text-sm text-ink-soft">Up to {n(FREE_PHOTO_LIMIT)} photos.</p>
            <div className="mt-6">
              <Suspense fallback={<span className={`${secondaryButtonClass} h-11 px-5 opacity-60`}>Get started free</span>}>
                <Cta plan="free" />
              </Suspense>
            </div>
          </section>
          <section className="border-2 border-ink bg-card p-6">
            <h2 className="font-display text-3xl">Folio Pro</h2>
            <p className="mt-2 font-display text-4xl">
              ${PRO_PRICE_MONTHLY}
              <span className="text-lg text-ink-soft"> / month</span>
            </p>
            <p className="mt-1 text-sm text-ink-soft">
              or ${PRO_PRICE_YEARLY} a year. Up to {n(PRO_PHOTO_LIMIT)} photos.
            </p>
            <div className="mt-6">
              <Suspense fallback={<span className={`${buttonClass} h-11 px-5 opacity-60`}>Go Pro</span>}>
                <Cta plan="pro" />
              </Suspense>
            </div>
            {!billingConfigured() && <p className="mt-3 text-sm text-ink-soft">Paid plans aren’t open yet.</p>}
          </section>
        </div>

        <div className="mt-12 overflow-x-auto">
          <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
            <caption className="sr-only">Free compared with Folio Pro</caption>
            <thead>
              <tr className="border-b border-ink">
                <th scope="col" className="py-3 pr-4 font-normal text-ink-faint">What you get</th>
                <th scope="col" className="py-3 pr-4 font-display text-lg">Free</th>
                <th scope="col" className="py-3 font-display text-lg">Pro</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([what, free, pro]) => (
                <tr key={what} className="border-b border-ink/20">
                  <th scope="row" className="py-3 pr-4 font-normal">{what}</th>
                  <td className="py-3 pr-4 text-ink-soft">{free}</td>
                  <td className="py-3 text-ink-soft">{pro}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-8 text-sm text-ink-soft">
          Client gallery links are private, but the image files are the same web copies as your portfolio. Questions?
          Write to <a href={`mailto:${SUPPORT_EMAIL}`} className="underline">{SUPPORT_EMAIL}</a>.
        </p>
      </main>

      <footer className="border-t border-ink">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-6 text-sm text-ink-soft">
          <Link href="/" className="font-display text-2xl italic text-ink">Folio</Link>
          <nav className="flex flex-wrap gap-x-6 gap-y-2">
            <Link href="/terms" className="underline-offset-4 hover:text-ink hover:underline">Terms</Link>
            <Link href="/privacy" className="underline-offset-4 hover:text-ink hover:underline">Privacy</Link>
            <Link href="/copyright" className="underline-offset-4 hover:text-ink hover:underline">Copyright</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

// Signed-in visitors go to their Plan page; everyone else to sign-up.
async function Cta({ plan }: { plan: "free" | "pro" }) {
  const user = await currentUser();
  const href = user ? "/dashboard/manage/billing" : "/signup";
  if (plan === "free") {
    return (
      <Link href={href} className={`${secondaryButtonClass} h-11 px-5`}>
        {user ? "Your plan" : "Get started free"}
      </Link>
    );
  }
  return (
    <Link href={href} className={`${buttonClass} h-11 px-5`}>
      {user ? (user.plan === "pro" ? "Your plan" : "Go Pro") : "Sign up to go Pro"}
    </Link>
  );
}
