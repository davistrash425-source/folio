// The "Made with Folio" gallery footer switch (lib/plans.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { GALLERY_FOLIO_BADGE, showFolioBadge } from "../lib/plans.ts";

const free = { plan: "free" as const };
const pro = { plan: "pro" as const };

test("'always' shows the Folio badge on every plan", () => {
  assert.equal(showFolioBadge(free, "always"), true);
  assert.equal(showFolioBadge(pro, "always"), true);
});

test("'free-only' shows the Folio badge to Free accounts, including ones with no plan set", () => {
  assert.equal(showFolioBadge(free, "free-only"), true);
  assert.equal(showFolioBadge({}, "free-only"), true);
  assert.equal(showFolioBadge(pro, "free-only"), false);
});

test("'never' hides the Folio badge on every plan", () => {
  assert.equal(showFolioBadge(free, "never"), false);
  assert.equal(showFolioBadge(pro, "never"), false);
});

test("the gallery footer default is 'free-only' until the owner decides", () => {
  assert.equal(GALLERY_FOLIO_BADGE, "free-only");
});
