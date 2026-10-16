// The root domain sites live under, e.g. "yourapp.com" in production.
// Locally, "localhost:3000" gives you sites at http://name.localhost:3000.
export const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";

const PROTOCOL = ROOT_DOMAIN.startsWith("localhost") ? "http" : "https";

export function siteUrl(subdomain: string) {
  return `${PROTOCOL}://${subdomain}.${ROOT_DOMAIN}`;
}

export function appUrl(pathname = "/") {
  return `${PROTOCOL}://${ROOT_DOMAIN}${pathname}`;
}

export const RESERVED_SUBDOMAINS = new Set([
  "www", "app", "api", "admin", "dashboard", "login", "signup", "mail",
  "help", "support", "blog", "static", "assets", "cdn",
]);

export function validateSubdomain(value: string): string | null {
  if (!/^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/.test(value)) {
    return "Use 3–30 lowercase letters, numbers or dashes (no dash at the start or end).";
  }
  if (RESERVED_SUBDOMAINS.has(value)) return "That name is reserved.";
  return null;
}

// Whether a new account's site is public right away or starts as a draft the
// photographer publishes from the dashboard. Product decision: flip to false
// to have new sites start as drafts.
export const NEW_SITES_START_PUBLISHED = true;

export function isPublished(user: { published?: boolean }) {
  return user.published !== false;
}

// Album pages live at name.yourapp.com/<slug>; these paths are taken.
const RESERVED_SLUGS = new Set(["api", "_next", "favicon.ico", "sites"]);

export function slugify(title: string) {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
}

export function validateSlug(slug: string): string | null {
  if (!slug) return "Use at least one letter or number.";
  if (RESERVED_SLUGS.has(slug)) return "That name is reserved.";
  return null;
}
