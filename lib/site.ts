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

const rootHostname = ROOT_DOMAIN.split(":")[0];

// Where photographers can write to Folio, e.g. support@folio.cam. It needs
// an inbox (or a forward) on the root domain.
export const SUPPORT_EMAIL = `support@${rootHostname}`;

// The photographer's site a Host header points at ("alice" for
// alice.yourapp.com), or null for the app itself and anything else.
export function siteSubdomain(host: string) {
  const hostname = host.split(":")[0].toLowerCase();
  if (!hostname.endsWith(`.${rootHostname}`)) return null;
  const subdomain = hostname.slice(0, -(rootHostname.length + 1));
  return subdomain && subdomain !== "www" && !subdomain.includes(".") ? subdomain : null;
}

// Addresses nobody can sign up for: Folio's own (now or later), and names
// that would look official on a photographer's site.
export const RESERVED_SUBDOMAINS = new Set([
  "www", "app", "api", "admin", "dashboard", "login", "signup", "mail",
  "help", "support", "blog", "static", "assets", "cdn",
  "folio", "about", "contact", "account", "accounts", "auth", "billing", "pay", "payments",
  "legal", "terms", "privacy", "copyright", "dmca", "abuse", "report", "reports", "safety", "trust",
  "security", "status", "news", "press", "docs", "dev", "staging", "test", "beta", "demo",
  "email", "smtp", "imap", "webmail", "postmaster", "hostmaster", "webmaster", "noreply", "no-reply",
  "media", "images", "img", "photos", "uploads", "files", "official", "team", "staff",
]);

// How long a closed account's address stays unavailable, so nobody can take
// it over and pass themselves off as its old owner.
export const ADDRESS_HOLD_MONTHS = 12;

// Crawlers that collect pages to train AI models, by the names their makers
// publish. Sites ask them to stay away unless the photographer allows it
// (app/robots.ts). Search engines (Googlebot, Bingbot) and link previews
// aren't on the list, so sites still show up in search. Only crawlers that
// follow robots.txt can be stopped this way.
export const AI_TRAINING_CRAWLERS = [
  "GPTBot", // OpenAI
  "ClaudeBot", // Anthropic
  "anthropic-ai", // Anthropic, older name
  "Google-Extended", // Google's AI models (Gemini); Google Search is unaffected
  "Applebot-Extended", // Apple's AI models; Apple's search is unaffected
  "CCBot", // Common Crawl, a dataset many AI models are trained on
  "meta-externalagent", // Meta AI
  "FacebookBot", // Meta's language models
  "Bytespider", // ByteDance
  "Amazonbot", // Amazon
  "cohere-ai", // Cohere
  "cohere-training-data-crawler", // Cohere
  "AI2Bot", // Allen Institute for AI
  "Diffbot", // sells web data, used for AI
  "Omgilibot", // Webz.io, sells web data for AI training
  "Timpibot", // Timpi, sells web data for AI training
  "ImagesiftBot", // Hive, image collection
];

export function validateSubdomain(value: string): string | null {
  if (!/^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/.test(value)) {
    return "Use 3–30 lowercase letters, numbers or dashes (no dash at the start or end).";
  }
  if (RESERVED_SUBDOMAINS.has(value)) return "That name is reserved.";
  return null;
}

// Whether a new account's site is public right away or starts as a draft the
// photographer publishes from the dashboard. Product decision: new sites start
// as drafts (false), so the photographer presses "Go live" when they're ready.
export const NEW_SITES_START_PUBLISHED = false;

export function isPublished(user: { published?: boolean }) {
  return user.published !== false;
}

// Whether visitors can see the site: the photographer has it online and has
// confirmed their email (so a throwaway address can't publish anything), and
// Folio hasn't suspended it.
export function isLive(user: { published?: boolean; emailVerified?: boolean; suspended?: unknown }) {
  return isPublished(user) && Boolean(user.emailVerified) && !user.suspended;
}

// Album pages live at name.yourapp.com/<slug>; these paths are taken.
// Keep in sync with RESERVED_PAGE_SLUGS in lib/design.ts.
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
