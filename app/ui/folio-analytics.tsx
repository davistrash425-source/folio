"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";

// Vercel Web Analytics (no cookies). Counts visits to Folio's own pages on the
// root domain (landing page, pricing, sign-up), not to photographers' sites:
// their visitors aren't ours to count, and they'd use up the plan's events.
const root = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000").split(":")[0];

function onlyFolioPages(event: BeforeSendEvent) {
  const host = new URL(event.url).hostname;
  return host === root || host === `www.${root}` ? event : null;
}

export function FolioAnalytics() {
  return <Analytics beforeSend={onlyFolioPages} />;
}
