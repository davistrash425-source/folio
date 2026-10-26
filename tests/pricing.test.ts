// The public /pricing page: it lists what Pro costs and allows, and takes
// those numbers from lib/plans.ts rather than repeating them.
import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import sitemap from "../app/sitemap.ts";
import { PRO_PRICE_MONTHLY, PRO_PRICE_YEARLY } from "../lib/plans.ts";
import { resetRequest } from "./helpers.ts";
import { requestHeaders } from "./stubs/next-headers.ts";

beforeEach(resetRequest);

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("the pricing page is in the app's sitemap and linked from the landing page", async () => {
  requestHeaders.set("host", "localhost:3000");
  assert.ok((await sitemap()).some((e) => e.url === "http://localhost:3000/pricing"));
  assert.match(source("../app/page.tsx"), /href="\/pricing"/);
});

test("Pro costs $12 a month or $120 a year, and the checkout buttons say the same", () => {
  assert.equal(PRO_PRICE_MONTHLY, 12);
  assert.equal(PRO_PRICE_YEARLY, 120);
  const buttons = source("../app/dashboard/manage/billing/buttons.tsx");
  assert.ok(buttons.includes(`$${PRO_PRICE_MONTHLY} a month`));
  assert.ok(buttons.includes(`$${PRO_PRICE_YEARLY} a year`));
});

test("the pricing page reads its limits from lib/plans instead of repeating the numbers", () => {
  const page = source("../app/pricing/page.tsx");
  for (const name of ["FREE_PHOTO_LIMIT", "PRO_PHOTO_LIMIT", "PRO_GALLERY_LIMIT", "PRO_STORAGE_LIMIT", "PRO_PRICE_MONTHLY", "PRO_PRICE_YEARLY"]) {
    assert.ok(page.includes(name), name);
  }
  assert.doesNotMatch(page, /\b(150|1,?500|50 GB)\b/);
});

test("signed-in visitors are sent to the Plan page and signed-out ones to sign-up", () => {
  const page = source("../app/pricing/page.tsx");
  assert.ok(page.includes('"/dashboard/manage/billing"'));
  assert.ok(page.includes('"/signup"'));
});
