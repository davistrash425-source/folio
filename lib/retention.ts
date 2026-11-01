// How long Folio keeps things, as the Privacy Policy and Terms state them
// (app/(legal)). Each number is either copied from the code that enforces it
// (tests/retention.test.ts fails if they drift apart) or is a vendor's
// setting that Folio doesn't control in code. See docs/legal/DATA-INVENTORY.md.
// No imports, so any page or test can read it.

// ── Mirrors of values set in the code ───────────────────────────────────
// Login cookie lifetime: MAX_AGE in lib/session.ts.
export const SESSION_DAYS = 30;
// Client gallery access cookie: GALLERY_DAYS in lib/session.ts.
export const GALLERY_ACCESS_DAYS = 30;
// Password reset link: createToken(…, "reset", HOUR) in app/actions/auth.ts.
export const RESET_LINK_HOURS = 1;
// Email confirmation link: lib/verify-email.ts.
export const VERIFY_LINK_HOURS = 48;
// "Continue with Google" state and sign-up cookies: TEN_MINUTES in lib/google.ts.
export const GOOGLE_COOKIE_MINUTES = 10;
// Contact-form inbox size: MAX_INQUIRIES in app/actions/site.ts.
export const MAX_INQUIRIES = 500;
// Earlier design drafts kept for undo: HISTORY_LIMIT in app/actions/design.ts.
export const DESIGN_HISTORY_DRAFTS = 20;
// The longest rate-limit window keyed by a visitor's IP address, and the
// longest window of any limit (an account's address changes), in hours.
// rateLimit calls in app/ and lib/; Upstash forgets a key after its window.
export const IP_RATE_LIMIT_MAX_HOURS = 1;
export const RATE_LIMIT_MAX_HOURS = 24;
// Web copies are sent with "Cache-Control: public, max-age=31536000,
// immutable" (lib/uploads.ts), so a browser that loaded one may keep it this long.
export const BROWSER_CACHE_DAYS = 365;

// ── Vendor settings (check these in each dashboard; not enforced in code) ─
// Cloudflare's edge cache for the photo domain (lib/cdn.ts comment).
export const CDN_CACHE_DAYS = 1;
// Vercel runtime logs on the Pro plan without Observability Plus.
export const HOSTING_LOG_DAYS = 1;
// Vercel Web Analytics discards its daily visitor hash after this long.
export const ANALYTICS_HASH_HOURS = 24;
// Neon's point-in-time restore window. Neon allows up to 7 days on Launch and
// 30 on Scale. OWNER TO CONFIRM the plan and setting (DATA-INVENTORY D-1).
export const DATABASE_RESTORE_DAYS = 7;
// Resend's email log retention on the Free and Pro plans. OWNER TO CONFIRM.
export const EMAIL_LOG_DAYS = 30;
// Sentry's event retention on the free Developer plan. OWNER TO CONFIRM.
export const ERROR_REPORT_DAYS = 30;

// ── Promises the Terms make ─────────────────────────────────────────────
// How far ahead account holders are emailed about material changes to the
// Terms or Privacy Policy, and about Pro price increases.
export const CHANGE_NOTICE_DAYS = 30;
