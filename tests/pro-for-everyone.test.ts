// PRO_FOR_EVERYONE=true gives every account Pro features while payments are
// closed, without changing any stored plan.
import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { galleriesOpen, galleryLimit, isPro, photoLimit, PRO_PHOTO_LIMIT, FREE_PHOTO_LIMIT, showFolioBadge } from "../lib/plans.ts";

afterEach(() => {
  delete process.env.PRO_FOR_EVERYONE;
});

test("without the switch, only Pro accounts are Pro", () => {
  assert.equal(isPro({}), false);
  assert.equal(isPro({ plan: "free" }), false);
  assert.equal(isPro({ plan: "pro" }), true);
  assert.equal(photoLimit({}), FREE_PHOTO_LIMIT);
  assert.equal(galleriesOpen({}), false);
});

test("with the switch on, a Free account gets the Pro limits and galleries", () => {
  process.env.PRO_FOR_EVERYONE = "true";
  assert.equal(isPro({}), true);
  assert.equal(photoLimit({}), PRO_PHOTO_LIMIT);
  assert.ok(galleryLimit({}) > 0);
  assert.equal(galleriesOpen({}), true);
  assert.equal(showFolioBadge({}), false);
});

test("only the exact value true turns the switch on", () => {
  process.env.PRO_FOR_EVERYONE = "false";
  assert.equal(isPro({}), false);
  process.env.PRO_FOR_EVERYONE = "1";
  assert.equal(isPro({}), false);
});
