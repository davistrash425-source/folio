import { test } from "node:test";
import assert from "node:assert/strict";
import { slugify, validateSlug, validateSubdomain } from "../lib/site.ts";

test("slugify makes URL-safe album addresses", () => {
  assert.equal(slugify("Weddings"), "weddings");
  assert.equal(slugify("  Café & Street  Photos! "), "cafe-street-photos");
  assert.equal(slugify("!!!"), "");
});

test("validateSlug rejects empty and reserved slugs", () => {
  assert.equal(validateSlug("weddings"), null);
  assert.ok(validateSlug(""));
  assert.ok(validateSlug("api"));
});

test("validateSubdomain", () => {
  assert.equal(validateSubdomain("jane-doe"), null);
  assert.ok(validateSubdomain("-jane"));
  assert.ok(validateSubdomain("www"));
  assert.ok(validateSubdomain("ab"));
});
