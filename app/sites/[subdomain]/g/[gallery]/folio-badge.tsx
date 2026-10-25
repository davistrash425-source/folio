import { showFolioBadge } from "@/lib/plans";
import { appUrl } from "@/lib/site";
import type { User } from "@/lib/db";

// Small "Made with Folio" line at the foot of a client gallery. Whether it
// shows is decided by showFolioBadge in lib/plans.ts (pending owner decision).
export function FolioBadge({ owner }: { owner: Pick<User, "plan"> }) {
  if (!showFolioBadge(owner)) return null;
  return (
    <footer className="mx-auto w-full max-w-6xl px-6 pb-8 text-center text-xs text-ink-soft">
      <a href={appUrl("/")} className="underline-offset-2 hover:underline focus-visible:underline">
        Made with Folio
      </a>
    </footer>
  );
}
