import { headers } from "next/headers";
import Link from "next/link";
import { Suspense } from "react";
import { siteSubdomain } from "@/lib/site";
import { SiteNotFound } from "./sites/[subdomain]/site-notice";

export const metadata = { title: "Page not found · Folio" };

// Every unknown address, on the app and (after the proxy's rewrite) on
// photographers' sites, which get their own page in the site's colors.
export default function NotFound() {
  return (
    <Suspense fallback={<div className="flex-1" />}>
      <NotFoundForHost />
    </Suspense>
  );
}

async function NotFoundForHost() {
  if (siteSubdomain((await headers()).get("host") ?? "")) return <SiteNotFound />;
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <Link href="/" className="mb-10 font-display text-4xl italic">Folio</Link>
      <div className="w-full max-w-md border-t border-ink pt-8">
        <p className="label text-ink-faint">404</p>
        <h1 className="mt-2 font-display text-3xl">This page doesn’t exist</h1>
        <p className="mt-2 text-ink-soft">The link may be broken, or the page may have moved.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/" className="border border-ink px-5 py-2.5 text-sm hover:bg-ink/5">Go to the home page</Link>
          <Link href="/signup" className="bg-ink px-5 py-2.5 text-sm text-paper hover:bg-accent">Create your site</Link>
        </div>
      </div>
    </div>
  );
}
