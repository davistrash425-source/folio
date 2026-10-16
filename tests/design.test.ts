import { test } from "node:test";
import assert from "node:assert/strict";
import {
  THEMES,
  applyTheme,
  designSchema,
  homepagePhotos,
  presetDesign,
  readDesign,
  showsCaption,
  visibleAlbums,
} from "../lib/design.ts";

test("every theme preset is a valid design", () => {
  for (const theme of THEMES) assert.ok(designSchema.safeParse(presetDesign(theme)).success, theme);
});

test("invalid designs are rejected", () => {
  const bad = presetDesign("minimal");
  assert.equal(designSchema.safeParse({ ...bad, colors: { ...bad.colors, accent: "red" } }).success, false);
  assert.equal(designSchema.safeParse({ ...bad, sections: bad.sections.slice(1) }).success, false);
  assert.equal(
    designSchema.safeParse({ ...bad, sections: [...bad.sections.slice(1), bad.sections[1]] }).success,
    false,
    "duplicate section",
  );
  assert.equal(designSchema.safeParse({ ...bad, gallery: { ...bad.gallery, columns: 7 } }).success, false);
});

test("older accounts fall back to their original theme", () => {
  assert.equal(readDesign(undefined, "dark").theme, "dark");
  assert.equal(readDesign({ junk: true }, "editorial").theme, "editorial");
  assert.equal(readDesign(undefined, "nonsense").theme, "minimal");
});

test("switching theme keeps content and captions", () => {
  const d = { ...presetDesign("minimal") };
  d.content = { ...d.content, homepage: "selected", homepagePhotoIds: ["b", "a"] };
  d.captions = { ...d.captions, show: "all" };
  const switched = applyTheme(d, "dark");
  assert.equal(switched.colors.background, "#000000");
  assert.deepEqual(switched.content, d.content);
  assert.deepEqual(switched.captions, d.captions);
});

test("selection helpers follow the design and skip missing items", () => {
  const photos = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const albums = [
    { id: "x", photoIds: ["a"] },
    { id: "y", photoIds: [] },
    { id: "z", photoIds: ["b"] },
  ];
  const d = presetDesign("minimal");
  assert.deepEqual(homepagePhotos(d, photos).map((p) => p.id), ["a", "b", "c"]);
  assert.deepEqual(visibleAlbums(d, albums).map((a) => a.id), ["x", "z"], "empty albums hidden");

  d.content = { homepage: "selected", homepagePhotoIds: ["c", "gone", "a"], albums: "selected", albumIds: ["z", "y", "x"] };
  assert.deepEqual(homepagePhotos(d, photos).map((p) => p.id), ["c", "a"]);
  assert.deepEqual(visibleAlbums(d, albums).map((a) => a.id), ["z", "x"]);

  d.captions = { show: "chosen", photoIds: ["a"], includeLocation: true };
  assert.equal(showsCaption(d, "a"), true);
  assert.equal(showsCaption(d, "b"), false);
});
