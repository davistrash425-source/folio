import { headers } from "next/headers";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { subdomainOnHold } from "@/lib/db";
import { siteNotice, type SiteLook, type SiteNotice } from "@/lib/public-site";
import { ADDRESS_HOLD_MONTHS, appUrl, siteSubdomain, validateSubdomain } from "@/lib/site";

// Same mapping as the Classic theme, so the page reads as the photographer's.
const BODY_FONT = { sans: "font-sans", serif: "font-serif", mixed: "font-sans", mono: "font-mono" };

// What a photographer's address shows when there's no page to draw: nobody
// has the address, the site is offline, or the page doesn't exist. Not-found
// pages get no props, so the address comes from the Host header.
export async function SiteNotFound() {
  const subdomain = siteSubdomain((await headers()).get("host") ?? "");
  const notice: SiteNotice = subdomain ? ((await siteNotice(subdomain)) ?? { status: "missing" }) : { status: "missing" };
  const held = subdomain ? await subdomainOnHold(subdomain, ADDRESS_HOLD_MONTHS) : false;
  return <SiteNoticePage notice={notice} subdomain={subdomain} held={held} />;
}

export function SiteNoticePage({ notice, subdomain, held = false }: { notice: SiteNotice; subdomain: string | null; held?: boolean }) {
  if (notice.status === "offline") {
    return (
      <Themed look={notice.look}>
        <h1 className="text-4xl">This portfolio is temporarily offline</h1>
        <p className="text-[var(--muted)]">Please check back soon.</p>
      </Themed>
    );
  }
  if (notice.status === "no-page") {
    return (
      <Themed look={notice.look}>
        <h1 className="text-4xl">There’s nothing at this address</h1>
        <p className="text-[var(--muted)]">The page may have moved or been removed.</p>
        <Link href="/" className="mt-2 text-[var(--accent)] underline underline-offset-4">Go to the home page</Link>
      </Themed>
    );
  }
  // Only addresses someone could actually sign up for get the offer: a valid
  // name that isn't reserved and isn't still held for its previous owner.
  const claimable = subdomain && !held && !validateSubdomain(subdomain);
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-10 text-center">
      <h1 className="font-display text-4xl">This site doesn’t exist yet</h1>
      <p className="text-ink-soft">The address may be mistyped, or the photographer hasn’t claimed it.</p>
      {claimable && (
        <a href={appUrl(`/signup?subdomain=${encodeURIComponent(subdomain)}`)} className="mt-4 bg-ink px-5 py-2.5 text-sm text-paper hover:bg-accent">
          Want this address? Claim it →
        </a>
      )}
    </div>
  );
}

function Themed({ look, children }: { look?: SiteLook; children: ReactNode }) {
  const design = look?.design;
  const style = design
    ? ({
        "--bg": design.colors.background,
        "--fg": design.colors.text,
        "--muted": design.colors.muted,
        "--accent": design.colors.accent,
      } as CSSProperties)
    : ({ "--bg": "#ffffff", "--fg": "#1c1a16", "--muted": "#625d55", "--accent": "#1c1a16" } as CSSProperties);
  return (
    <div
      style={style}
      data-fonts={design?.fonts}
      className={`flex flex-1 flex-col items-center justify-center gap-3 bg-[var(--bg)] p-10 text-center text-[var(--fg)] ${BODY_FONT[design?.fonts ?? "sans"]}`}
    >
      {children}
    </div>
  );
}
