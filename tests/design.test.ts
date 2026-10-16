import { test } from "node:test";
import assert from "node:assert/strict";
import {
  THEMES,
  applyTheme,
  designSchema,
  galleryPhotos,
  newPage,
  presetDesign,
  readDesign,
  showsCaption,
  uniqueSlug,
  visibleAlbums,
  type GallerySection,
} from "../lib/design.ts";

let n = 0;
const makeId = () => `t${++n}`;

test("every theme preset is a valid design with a home and an About page", () => {
  for (const theme of THEMES) {
    const d = presetDesign(theme);
    assert.ok(designSchema.safeParse(d).success, theme);
    assert.deepEqual(d.pages.map((p) => p.slug), ["", "about"]);
  }
});

test("invalid designs are rejected", () => {
  const d = presetDesign("minimal");
  const ok = (x: unknown) => designSchema.safeParse(x).success;
  assert.equal(ok({ ...d, colors: { ...d.colors, accent: "red" } }), false, "bad color");
  assert.equal(ok({ ...d, pages: [d.pages[1], d.pages[0]] }), false, "home not first");
  assert.equal(ok({ ...d, pages: [...d.pages, { ...d.pages[1], id: "other" }] }), false, "duplicate address");
  assert.equal(ok({ ...d, pages: [...d.pages, newPage("blank", "api", makeId)] }), false, "reserved address");
  assert.equal(ok({ ...d, pages: [...d.pages, newPage("blank", "Has Spaces", makeId)] }), false, "bad address");
  assert.equal(ok({ ...d, pages: [...d.pages, { ...newPage("blank", "x", makeId), title: " " }] }), false, "empty title");
  assert.equal(ok({ ...d, gallery: { ...d.gallery, columns: 7 } }), false, "bad columns");
  assert.equal(ok({ ...d, pages: [...d.pages, newPage("gallery", "gallery", makeId)] }), true, "added page");
});

test("version 1 designs become one home page that looks the same", () => {
  const v1 = {
    version: 1,
    theme: "dark",
    colors: { background: "#000000", text: "#f4f4f5", muted: "#a1a1aa", accent: "#ffffff" },
    fonts: "sans",
    sections: [
      { type: "hero", visible: true },
      { type: "about", visible: false },
      { type: "gallery", visible: true },
      { type: "albums", visible: true },
      { type: "contact", visible: true },
    ],
    hero: { style: "cover", coverPhotoId: "p9" },
    content: { homepage: "selected", homepagePhotoIds: ["p2", "p1"], albums: "selected", albumIds: ["a1"] },
    gallery: { layout: "masonry", columns: 3, spacing: "tight", cropping: "original" },
    captions: { show: "all", photoIds: [], includeLocation: true },
  };
  const d = readDesign(v1, "minimal");
  assert.ok(designSchema.safeParse(d).success);
  assert.equal(d.pages.length, 1);
  const home = d.pages[0];
  assert.equal(home.slug, "");
  assert.deepEqual(home.sections.map((s) => [s.type, s.visible]), [
    ["hero", true],
    ["about", false],
    ["gallery", true],
    ["albums", true],
    ["contact", true],
  ]);
  const hero = home.sections[0];
  assert.ok(hero.type === "hero" && hero.style === "cover" && hero.coverPhotoId === "p9");
  const gallery = home.sections[2] as GallerySection;
  assert.deepEqual(gallery.source, { kind: "photos", photoIds: ["p2", "p1"] });
  assert.deepEqual(d.albums, { show: "selected", albumIds: ["a1"] });
  assert.equal(d.nav.albums, true);
});

test("accounts without a design keep their original one-page layout", () => {
  const d = readDesign(undefined, "dark");
  assert.ok(designSchema.safeParse(d).success);
  assert.equal(d.theme, "dark");
  assert.equal(d.pages.length, 1);
  assert.deepEqual(d.pages[0].sections.map((s) => s.type), ["hero", "gallery", "albums", "about", "contact"]);
  assert.equal(readDesign({ junk: true }, "editorial").theme, "editorial");
  assert.equal(readDesign(undefined, "nonsense").theme, "minimal");
});

test("switching theme keeps pages and captions", () => {
  const d = presetDesign("minimal");
  d.captions = { ...d.captions, show: "all" };
  const switched = applyTheme(d, "editorial");
  assert.equal(switched.colors.background, "#fafaf9");
  assert.deepEqual(switched.pages.map((p) => p.id), d.pages.map((p) => p.id));
  assert.deepEqual(switched.captions, d.captions);
  const hero = switched.pages[0].sections[0];
  assert.ok(hero.type === "hero" && hero.style === "cover");
});

test("galleries show all photos, chosen photos or an album", () => {
  const photos = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const albums = [{ id: "x", photoIds: ["c", "a"] }];
  const g = (source: GallerySection["source"]): GallerySection => ({ id: "g", type: "gallery", visible: true, title: "", source, layout: "default" });
  assert.deepEqual(galleryPhotos(g({ kind: "all" }), photos, albums).map((p) => p.id), ["a", "b", "c"]);
  assert.deepEqual(galleryPhotos(g({ kind: "photos", photoIds: ["b", "gone", "a"] }), photos, albums).map((p) => p.id), ["b", "a"]);
  assert.deepEqual(galleryPhotos(g({ kind: "album", albumId: "x" }), photos, albums).map((p) => p.id), ["c", "a"]);
  assert.deepEqual(galleryPhotos(g({ kind: "album", albumId: "deleted" }), photos, albums), []);
});

test("album and caption choices", () => {
  const albums = [
    { id: "x", photoIds: ["a"] },
    { id: "y", photoIds: [] },
    { id: "z", photoIds: ["b"] },
  ];
  const d = presetDesign("minimal");
  assert.deepEqual(visibleAlbums(d, albums).map((a) => a.id), ["x", "z"], "empty albums hidden");
  d.albums = { show: "selected", albumIds: ["z", "y", "x"] };
  assert.deepEqual(visibleAlbums(d, albums).map((a) => a.id), ["z", "x"]);

  d.captions = { show: "chosen", photoIds: ["a"], includeLocation: true };
  assert.equal(showsCaption(d, "a"), true);
  assert.equal(showsCaption(d, "b"), false);
});

test("uniqueSlug avoids taken and reserved addresses", () => {
  assert.equal(uniqueSlug("My Gallery!", []), "my-gallery");
  assert.equal(uniqueSlug("About", ["about"]), "about-2");
  assert.equal(uniqueSlug("About", ["about", "about-2"]), "about-3");
  assert.equal(uniqueSlug("API", []), "api-2");
  assert.equal(uniqueSlug("!!!", []), "page");
});
