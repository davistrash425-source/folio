import { test } from "node:test";
import assert from "node:assert/strict";
import { readableOn, sortPhotos } from "../lib/theme-utils.ts";

const photo = (id: string, location: string, createdAt: string) =>
  ({ id, location, createdAt, src: "", alt: "", description: "" }) as Parameters<typeof sortPhotos>[0][number];

test("readableOn picks black or white text for a background", () => {
  assert.equal(readableOn("#ffffff"), "#0a0a0a");
  assert.equal(readableOn("#000000"), "#ffffff");
  assert.equal(readableOn("#e5322d"), "#ffffff"); // the Index theme's red
  assert.equal(readableOn("#f2c94c"), "#0a0a0a"); // a light yellow
});

test("sortPhotos keeps manual order, or sorts newest first, or by location with places first", () => {
  const list = [
    photo("a", "Porto", "2026-01-02T00:00:00Z"),
    photo("b", "", "2026-03-01T00:00:00Z"),
    photo("c", "Lisbon", "2026-02-01T00:00:00Z"),
    photo("d", "Lisbon", "2026-04-01T00:00:00Z"),
  ];
  assert.deepEqual(sortPhotos(list, "manual").map((p) => p.id), ["a", "b", "c", "d"]);
  assert.deepEqual(sortPhotos(list, "newest").map((p) => p.id), ["d", "b", "c", "a"]);
  assert.deepEqual(sortPhotos(list, "location").map((p) => p.id), ["c", "d", "a", "b"]);
  assert.deepEqual(list.map((p) => p.id), ["a", "b", "c", "d"], "the original list is not changed");
});
