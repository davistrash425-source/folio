import Link from "next/link";
import type { ReactNode } from "react";
import { buttonClass, secondaryButtonClass } from "@/app/ui/form";
import { AddressClaim } from "@/app/ui/address-claim";
import { ContactSheet, homePhoto, Photo } from "@/app/ui/frames";
import { archivo, bebas, cormorant, shareTech, specialElite } from "@/app/sites/[subdomain]/themes/fonts";
import { ROOT_DOMAIN, SUPPORT_EMAIL, siteUrl } from "@/lib/site";

// The example accounts made by scripts/seed-examples.ts.
const EXAMPLE_SITES = [
  { subdomain: "highsierra", name: "Anya Lindqvist", theme: "Exhibition" },
  { subdomain: "streetlight", name: "Mateo Ruiz", theme: "Film strip" },
  { subdomain: "bronco", name: "Dale Whitfield", theme: "Contact sheet" },
];

// Printed along the edge of a roll of film, one frame per step.
const steps = [
  ["Claim your address", `Sign up and pick yourname.${ROOT_DOMAIN}.`],
  ["Upload your work", "Photos are resized for the web and stripped of location data."],
  ["Describe & sort", "Add captions and locations, and group photos into albums."],
  ["Design your pages", "Home, galleries, about, contact — your theme, your layout."],
  ["Publish", "Preview on desktop and phone, then put it live."],
];

// The theme previews use the photos after the hero's 12 (the same ones again until there are more).
const preview = (i: number) => homePhoto(12 + i);

// The theme previews below borrow each theme's own typefaces.
const fontVars = [archivo, bebas, cormorant, shareTech, specialElite].map((f) => f.variable).join(" ");

export default function Home() {
  return (
    <div className={`flex flex-1 flex-col overflow-x-clip ${fontVars}`}>
      <header className="border-b border-ink">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <span className="font-display text-2xl italic">Folio</span>
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/pricing" className="text-ink-soft underline-offset-4 hover:text-ink hover:underline">
              Pricing
            </Link>
            <Link href="/login" className="text-ink-soft underline-offset-4 hover:text-ink hover:underline">
              Log in
            </Link>
            <Link href="/signup" className={`${buttonClass} h-9 px-4`}>
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto grid w-full max-w-6xl gap-10 px-6 pt-6 pb-10 sm:py-24 lg:grid-cols-[1fr_1.05fr] lg:items-center lg:gap-16">
          <div>
            <p className="label text-accent">Portfolio sites for photographers</p>
            <h1 className="mt-5 font-display text-4xl leading-[1.05] tracking-tight sm:text-7xl">
              Give your pictures a <em className="text-accent">room</em> of their own.
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-ink-soft">
              Folio turns a folder of photographs into a portfolio site at your own address. No code, no
              hosting, and no algorithm deciding who gets to see it.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/signup" className={`${buttonClass} h-12 px-6`}>
                Create your site →
              </Link>
              <Link href="#examples" className={`${secondaryButtonClass} h-12 px-6`}>
                See an example
              </Link>
            </div>
            <p className="mt-4 text-sm text-ink-soft">Free to start ·{" "}
              <Link href="/pricing" className="underline underline-offset-4">
                See pricing
              </Link>
              .</p>
          </div>
          <ContactSheet />
        </section>

        <section className="border-y border-ink">
          <div className="mx-auto grid max-w-6xl gap-8 px-6 py-20 sm:py-28 lg:grid-cols-[1fr_20rem] lg:items-end">
            <p className="font-display text-4xl leading-[1.1] tracking-tight sm:text-6xl">
              <span className="relative inline-block text-ink-faint">
                A feed is a scroll.
                <svg viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden className="absolute -inset-x-[3%] top-1/2 h-4 w-[106%] -translate-y-1/2 overflow-visible">
                  <path d="M1 7 C30 3 60 6 99 2" className="draw draw-late stroke-accent" fill="none" strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                </svg>
              </span>
              <br />
              A portfolio is a <em>sequence.</em>
            </p>
            <p className="text-ink-soft lg:pb-3">
              Chosen, ordered, and kept exactly where you put it — at an address you can print on a business card
              and send to a client.
            </p>
          </div>
        </section>

        <section id="themes" className="mx-auto max-w-6xl scroll-mt-6 px-6 py-20 sm:py-28">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="font-display text-4xl tracking-tight sm:text-5xl">Four rooms to hang the work in.</h2>
            <p className="max-w-sm text-sm text-ink-soft">
              Every theme reads the same photos and pages, so you can switch at any time without losing a thing.
            </p>
          </div>
          <div className="mt-12 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            <ThemeCard name="Classic" note="Clean grids, your colors and fonts.">
              <div className="flex h-full flex-col bg-[#fbfaf7] p-3">
                <div className="flex justify-between text-[7px] tracking-wide text-[#555]">
                  <span className="font-semibold">ANNA MOREAU</span>
                  <span>Work · About · Contact</span>
                </div>
                <div className="mt-3 grid flex-1 grid-cols-3 gap-1">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <Photo key={i} name={preview(i)} sizes="100px" />
                  ))}
                </div>
              </div>
            </ThemeCard>
            <ThemeCard name="Exhibition" note="One print at a time, on a gallery wall.">
              <div className="flex h-full flex-col items-center justify-center bg-[#2c2a27] p-4">
                <div className="w-3/5 bg-[#f4f1ea] p-1.5 shadow-[0_8px_16px_rgba(0,0,0,0.5)]">
                  <Photo name={preview(6)} sizes="200px" className="aspect-[3/2]" />
                </div>
                <p className="mt-3 font-exh-serif text-[11px] italic text-[#cfc8bb]">Untitled, 2025</p>
              </div>
            </ThemeCard>
            <ThemeCard name="Index" note="A typeset list; pictures on hover.">
              <div className="relative h-full bg-[#f2f0eb] p-3 font-idx text-[8px] text-[#222]">
                {[
                  ["01", "Crossing", "2025"],
                  ["02", "Reflection", "2025"],
                  ["03", "Into the light", "2025"],
                  ["04", "Midair", "2025"],
                  ["05", "Stop", "2025"],
                  ["06", "Window boxes", "2025"],
                ].map(([n, title, place]) => (
                  <div key={n} className={`flex gap-2 border-b border-[#ccc] py-[5px] ${n === "03" ? "font-extrabold" : ""}`}>
                    <span className="text-[#999]">{n}</span>
                    <span className="flex-1">{title}</span>
                    <span className="text-[#888]">{place}</span>
                  </div>
                ))}
                <div className="absolute right-3 bottom-3 w-2/5 rotate-2 shadow-md">
                  <Photo name={preview(7)} sizes="150px" className="aspect-[3/2]" />
                </div>
              </div>
            </ThemeCard>
            <ThemeCard name="Filmstrip" note="Sideways-scrolling frames, edge codes and all.">
              <div className="flex h-full flex-col justify-center bg-[#0f0e0c] px-3">
                <p className="font-film-title text-2xl leading-none text-[#efe6d4]">ROLL ONE</p>
                <div className="mt-2 -mr-6 flex gap-1 border-y-[6px] border-dashed border-[#2a2622] py-1">
                  {[8, 9, 10, 11].map((i) => (
                    <Photo key={i} name={preview(i)} sizes="120px" className="aspect-[3/2] w-[38%] shrink-0" />
                  ))}
                </div>
                <p className="mt-2 font-film-edge text-[7px] text-[#c08a3e]">FOLIO 400 ▸ 14 ▸ 15 ▸ 16</p>
              </div>
            </ThemeCard>
          </div>
        </section>

        <section className="bg-[#151311] text-paper">
          <div className="sprockets h-4" />
          <ol className="mx-auto grid max-w-6xl px-6 py-10 sm:grid-cols-5">
            {steps.map(([title, text], i) => (
              <li key={title} className="border-b border-[#2e2a25] py-6 last:border-b-0 sm:border-r sm:border-b-0 sm:px-5 sm:first:pl-0 sm:last:border-r-0">
                <span className="font-film-edge text-xs text-[#c08a3e]">{`▸ ${i + 1} ${i + 1}A`}</span>
                <h3 className="mt-3 font-display text-2xl leading-tight">{title}</h3>
                <p className="mt-2 text-sm text-[#a9a296]">{text}</p>
              </li>
            ))}
          </ol>
          <div className="sprockets h-4" />
        </section>

        <section id="examples" className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
          <p className="label text-accent">Made with Folio</p>
          <h2 className="mt-3 font-display text-4xl tracking-tight sm:text-5xl">
            Three example <em>sites.</em>
          </h2>
          <p className="mt-3 max-w-xl text-ink-soft">
            Real Folio sites, each in a different theme. The photographers are made up; the photos are real.
          </p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-3">
            {EXAMPLE_SITES.map(({ subdomain, name, theme }) => (
              <li key={subdomain}>
                <a
                  href={siteUrl(subdomain)}
                  className="block border border-ink p-5 transition-colors hover:bg-ink hover:text-paper"
                >
                  <span className="label">{theme}</span>
                  <span className="mt-2 block font-display text-2xl">{name}</span>
                  <span className="mt-1 block text-sm opacity-70">
                    {subdomain}.{ROOT_DOMAIN} →
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-20 text-center sm:py-28">
          <h2 className="font-display text-4xl tracking-tight sm:text-6xl">
            Your name is the <em>address.</em>
          </h2>
          <AddressClaim />
        </section>
      </main>

      <footer className="border-t border-ink">
        <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-6 px-6 py-8">
          <span className="font-display text-5xl leading-none italic">Folio</span>
          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-ink-soft">
            <a href={`mailto:${SUPPORT_EMAIL}`} className="underline-offset-4 hover:text-ink hover:underline">
              Contact
            </a>
            <Link href="/pricing" className="underline-offset-4 hover:text-ink hover:underline">
              Pricing
            </Link>
            <Link href="/terms" className="underline-offset-4 hover:text-ink hover:underline">
              Terms
            </Link>
            <Link href="/privacy" className="underline-offset-4 hover:text-ink hover:underline">
              Privacy
            </Link>
            <Link href="/copyright" className="underline-offset-4 hover:text-ink hover:underline">
              Copyright
            </Link>
            <Link href="/report" className="underline-offset-4 hover:text-ink hover:underline">
              Report a site
            </Link>
          </nav>
          <p className="label text-ink-faint">Made for people who make pictures</p>
        </div>
      </footer>
    </div>
  );
}

function ThemeCard({ name, note, children }: { name: string; note: string; children: ReactNode }) {
  return (
    <figure className="group">
      <div className="aspect-[4/3] overflow-hidden border border-ink transition-transform duration-300 group-hover:-translate-y-1">
        {children}
      </div>
      <figcaption className="mt-3">
        <span className="font-display text-xl">{name}</span>
        <span className="block text-sm text-ink-soft">{note}</span>
      </figcaption>
    </figure>
  );
}
