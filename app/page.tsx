import Link from "next/link";
import { ROOT_DOMAIN } from "@/lib/site";

const steps = [
  ["Sign up", "Create an account and claim your site address."],
  ["Upload photos", "Drop in your best work — JPG, PNG, WebP and more."],
  ["Pick a style", "Choose a template that fits your work."],
  ["Add your info", "Name, bio, contact details and social links."],
  ["Go live", `Your portfolio is online at yourname.${ROOT_DOMAIN}.`],
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <span className="text-lg font-semibold tracking-tight">Folio</span>
        <nav className="flex gap-3 text-sm">
          <Link href="/login" className="rounded-full px-4 py-2 hover:bg-zinc-200">
            Log in
          </Link>
          <Link href="/signup" className="rounded-full bg-black px-4 py-2 text-white hover:bg-zinc-800">
            Get started
          </Link>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 pb-24 pt-16">
        <h1 className="max-w-2xl text-5xl font-semibold leading-tight tracking-tight">
          A portfolio site for your photography, live in minutes.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-zinc-600">
          No code, no hosting to set up. Upload your photos, pick a style, and share
          your own link.
        </p>
        <Link
          href="/signup"
          className="mt-10 inline-flex h-12 items-center rounded-full bg-black px-6 font-medium text-white hover:bg-zinc-800"
        >
          Create your site
        </Link>

        <ol className="mt-20 grid gap-4 sm:grid-cols-5">
          {steps.map(([title, text], i) => (
            <li key={title} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
              <span className="text-sm text-zinc-400">{i + 1}</span>
              <h2 className="mt-1 font-medium">{title}</h2>
              <p className="mt-2 text-sm text-zinc-600">{text}</p>
            </li>
          ))}
        </ol>
      </main>
    </div>
  );
}
