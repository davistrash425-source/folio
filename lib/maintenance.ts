import { appUrl } from "./site";

// Maintenance mode: with MAINTENANCE_MODE=1, every page of folio.cam and of
// every photographer's site answers with a short "back soon" page (proxy.ts),
// except the legal pages and report forms on folio.cam (MAINTENANCE_OPEN),
// and photos stop loading from /_photos (next.config.ts). The /api routes keep
// working, so Polar's billing webhooks and the daily cron aren't missed.
// Changing the variable on Vercel takes effect after a redeploy.
export function maintenanceOn(env: Record<string, string | undefined> = process.env) {
  const value = env.MAINTENANCE_MODE?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "on";
}

// Stay open on the app's own host during maintenance: the terms people agreed
// to, the DMCA agent's contact details (/copyright), and the report forms, so
// complaints and takedown notices can still be sent.
const MAINTENANCE_OPEN = new Set(["/terms", "/privacy", "/copyright", "/report", "/report/copyright"]);

// Whether a request still goes through in maintenance mode. `subdomain` is
// siteSubdomain(host): photographers' sites are always closed.
export function openDuringMaintenance(subdomain: string | null, pathname: string) {
  return subdomain === null && MAINTENANCE_OPEN.has(pathname.replace(/\/+$/, "") || "/");
}

const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Folio is down for maintenance</title>
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center;
         font-family: system-ui, -apple-system, sans-serif; background: #fafaf9; color: #1c1917; }
  main { max-width: 32rem; padding: 2rem; text-align: center; }
  h1 { font-size: 1.5rem; font-weight: 600; margin: 0 0 .75rem; }
  p { line-height: 1.6; color: #57534e; margin: 0; }
  nav { margin-top: 1.5rem; font-size: .875rem; display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; }
  a { color: #57534e; }
</style>
</head>
<body>
<main>
  <h1>We'll be back soon</h1>
  <p>Folio is offline for maintenance for a little while. Your photos and sites are safe, and nothing has been deleted.</p>
  <nav>
    <a href="${appUrl("/terms")}">Terms</a>
    <a href="${appUrl("/privacy")}">Privacy</a>
    <a href="${appUrl("/copyright")}">Copyright</a>
    <a href="${appUrl("/report")}">Report a site</a>
  </nav>
</main>
</body>
</html>`;

// 503 with Retry-After tells search engines the outage is temporary, so sites
// keep their place in search results.
export function maintenanceResponse() {
  return new Response(PAGE, {
    status: 503,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "retry-after": "3600",
    },
  });
}
