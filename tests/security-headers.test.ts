import { test } from "node:test";
import assert from "node:assert/strict";
import { contentPolicy, securityHeaders } from "../lib/security-headers.ts";

const header = (headers: { key: string; value: string }[], key: string) => headers.find((h) => h.key === key)?.value;

test("pages can't be framed by other sites, and HTTPS is remembered", () => {
  const headers = securityHeaders({});
  assert.match(header(headers, "Content-Security-Policy")!, /frame-ancestors 'self'/);
  assert.equal(header(headers, "X-Frame-Options"), "SAMEORIGIN");
  assert.match(header(headers, "Strict-Transport-Security")!, /max-age=63072000; includeSubDomains/);
});

test("the full content policy is enforced, not report-only", () => {
  const headers = securityHeaders({});
  assert.equal(header(headers, "Content-Security-Policy-Report-Only"), undefined);
  assert.match(header(headers, "Content-Security-Policy")!, /script-src/);
  assert.match(header(headers, "Content-Security-Policy")!, /frame-ancestors 'self'/);
});

test("the content policy allows the photo store, uploads, Sentry and Turnstile, and nothing else outside", () => {
  const policy = contentPolicy({
    R2_PUBLIC_URL: "https://pub-abc.r2.dev/folio-photos",
    R2_ACCOUNT_ID: "acct",
    NEXT_PUBLIC_SENTRY_DSN: "https://key@o123.ingest.de.sentry.io/456",
  });
  assert.match(policy, /img-src [^;]*https:\/\/pub-abc\.r2\.dev(;|$| )/);
  assert.match(policy, /connect-src [^;]*https:\/\/\*\.r2\.cloudflarestorage\.com/);
  assert.match(policy, /connect-src [^;]*https:\/\/o123\.ingest\.de\.sentry\.io/);
  assert.match(policy, /script-src [^;]*https:\/\/challenges\.cloudflare\.com/);
  assert.match(policy, /object-src 'none'/);
  assert.match(policy, /form-action 'self'/, "forms can only submit back to the site");
  assert.doesNotMatch(policy, /\*(;|$| )/, "no bare wildcard source");
});
