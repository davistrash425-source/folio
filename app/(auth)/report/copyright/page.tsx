import Link from "next/link";
import { Suspense } from "react";
import { CopyrightForm } from "./form";

export const metadata = { title: "Copyright notice — Folio", robots: { index: false } };

export default function CopyrightPage({ searchParams }: PageProps<"/report/copyright">) {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl">Copyright notice</h1>
      <div className="space-y-3 text-sm text-ink-soft">
        <p>
          Use this form if a Folio site shows your work, or work you represent, without permission. It’s a takedown
          notice under the US Digital Millennium Copyright Act (DMCA).
        </p>
        <p>
          We send a copy, including your name and email, to the site’s owner so they can respond. If they believe it’s
          a mistake, the law lets them send a counter-notice.
        </p>
        <p>Sending a notice you know is false can make you liable for damages.</p>
        <p>
          Something else wrong? Use the{" "}
          <Link href="/report" className="underline">
            general report form
          </Link>
          .
        </p>
      </div>
      <Suspense fallback={<CopyrightForm site="" />}>
        <WithSite searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function WithSite({ searchParams }: { searchParams: PageProps<"/report/copyright">["searchParams"] }) {
  const { site } = await searchParams;
  return <CopyrightForm site={typeof site === "string" ? site.slice(0, 63) : ""} />;
}
