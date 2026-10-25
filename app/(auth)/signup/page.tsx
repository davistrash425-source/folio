import { Suspense } from "react";
import { SignupForm } from "@/app/ui/signup-form";

// A thin server wrapper so the address the person typed on the landing page
// can be read from the URL and handed to the client-side form. The search
// params are read inside Suspense so the page can still be prerendered.
export default function SignupPage({ searchParams }: PageProps<"/signup">) {
  return (
    <Suspense fallback={<p className="label text-ink-faint">Loading…</p>}>
      <WithSubdomain searchParams={searchParams} />
    </Suspense>
  );
}

async function WithSubdomain({ searchParams }: { searchParams: PageProps<"/signup">["searchParams"] }) {
  const params = await searchParams;
  const subdomain = typeof params.subdomain === "string" ? params.subdomain : "";
  return <SignupForm initialSubdomain={subdomain} />;
}
