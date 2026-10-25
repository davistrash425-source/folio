import { Suspense } from "react";
import { stopImpersonation } from "@/app/actions/admin";
import { currentImpersonation } from "@/lib/auth";
import { minutesLeft } from "@/lib/session";

// Pinned to the bottom of every dashboard page while an admin is looking at an
// account as its owner ("Log in as this user", app/actions/admin.ts). It can't
// be missed, and "Stop" drops straight back to the admin's own login.
export function ImpersonationBanner() {
  return (
    <Suspense fallback={null}>
      <Banner />
    </Suspense>
  );
}

async function Banner() {
  const impersonation = await currentImpersonation();
  if (!impersonation) return null;
  const minutes = minutesLeft(impersonation.expires);
  return (
    <>
      {/* Room for the bar, so it never covers the end of the page. */}
      <div className="h-16" aria-hidden="true" />
      <div
        role="region"
        aria-label="Admin session"
        className="fixed inset-x-0 bottom-0 z-[100] flex flex-wrap items-center justify-center gap-x-5 gap-y-1 border-t-2 border-ink bg-accent px-4 py-3 text-sm text-paper"
      >
        <span>
          Viewing as <strong>{impersonation.target.subdomain}</strong> — admin session, ends in {minutes} min
        </span>
        <form action={stopImpersonation}>
          <button type="submit" className="border border-paper px-3 py-1 font-medium hover:bg-paper hover:text-ink">
            Stop
          </button>
        </form>
      </div>
    </>
  );
}
