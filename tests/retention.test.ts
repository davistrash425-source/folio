// The Privacy Policy quotes lib/retention.ts. Some of those numbers are copies
// of values set elsewhere in the code, so these tests fail if one side changes
// without the other (then update lib/retention.ts and re-check the policy).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as retention from "@/lib/retention";

const source = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("the login cookie lasts as long as the Privacy Policy says", () => {
  assert.match(source("lib/session.ts"), new RegExp(`const MAX_AGE = 60 \\* 60 \\* 24 \\* ${retention.SESSION_DAYS};`));
});

test("the client gallery cookie lasts as long as the Privacy Policy says", () => {
  assert.match(source("lib/session.ts"), new RegExp(`const GALLERY_DAYS = ${retention.GALLERY_ACCESS_DAYS};`));
});

test("password reset and email confirmation links last as long as the Privacy Policy says", () => {
  assert.equal(retention.RESET_LINK_HOURS, 1);
  assert.match(source("app/actions/auth.ts"), /createToken\(user\.id, "reset", HOUR\)/);
  assert.match(source("lib/verify-email.ts"), new RegExp(`createToken\\(user\\.id, "verify", ${retention.VERIFY_LINK_HOURS} \\* 60 \\* 60 \\* 1000\\)`));
});

test("the Google sign-in cookies last as long as the Privacy Policy says", () => {
  assert.equal(retention.GOOGLE_COOKIE_MINUTES, 10);
  assert.match(source("lib/google.ts"), /const TEN_MINUTES = 10 \* 60 \* 1000;/);
});

test("the inbox size and design history match the Privacy Policy", () => {
  assert.match(source("app/actions/site.ts"), new RegExp(`const MAX_INQUIRIES = ${retention.MAX_INQUIRIES};`));
  assert.match(source("app/actions/design.ts"), new RegExp(`const HISTORY_LIMIT = ${retention.DESIGN_HISTORY_DRAFTS};`));
});

test("web copies are cached by browsers for as long as the Privacy Policy says", () => {
  assert.match(source("lib/uploads.ts"), new RegExp(`max-age=${retention.BROWSER_CACHE_DAYS * 24 * 60 * 60}`));
});

test("no rate limit lasts longer than the Privacy Policy says", () => {
  const files = ["app/actions/auth.ts", "app/actions/galleries.ts", "app/actions/site.ts", "app/actions/billing.ts", "app/actions/report.ts", "app/api/address/route.ts", "app/api/photos/start/route.ts", "app/sites/[subdomain]/g/[gallery]/download/route.ts"];
  const HOUR = 60 * 60 * 1000;
  let checked = 0;
  for (const file of files) {
    for (const [, window] of source(file).matchAll(/rateLimit\([^;]*?,\s*\d+,\s*([^)]+)\)/g)) {
      // Windows are written as an expression such as "HOUR" or "24 * HOUR".
      const ms = Function("HOUR", "window", `return ${window}`)(HOUR, 15 * 60 * 1000);
      assert.ok(ms <= retention.RATE_LIMIT_MAX_HOURS * HOUR, `${file}: a rate limit lasts ${ms} ms`);
      checked++;
    }
  }
  assert.ok(checked >= 15, `only ${checked} rate limits were found; the pattern above may need updating`);
});
