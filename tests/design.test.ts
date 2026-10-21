import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CLASSIC_LOOKS,
  LOOKS,
  THEMES,
  albumAsPage,
  applyLook,
  applyTheme,
  designSchema,
  galleryPhotos,
  makeHomePage,
  newPage,
  presetDesign,
  readDesign,
  showsCaption,
  uniqueSlug,
  visibleAlbums,
  type AboutSection,
  type GallerySection,
  type HeroSection,
} from "../lib/design.ts";
import { TEMPLATES } from "../lib/templates.ts";
import type { SiteData } from "../lib/site-data.ts";
import { aboutText, heroText } from "../app/sites/[subdomain]/themes/shared.ts";

let n = 0;
const makeId = () => `t${++n}`;

test("every theme and every Classic look makes a valid design with a home and an About page", () => {
  for (const theme of THEMES) {
    const d = presetDesign(theme);
    assert.ok(designSchema.safeParse(d).success, theme);
    assert.deepEqual(d.pages.map((p) => p.slug), ["", "about"]);
  }
  for (const look of LOOKS) {
    const d = presetDesign("classic", look);
    assert.ok(designSchema.safeParse(d).success, look);
    assert.equal(d.look, look);
  }
});

test("every Classic look has a name and description in the look picker", () => {
  assert.deepEqual(TEMPLATES.map((t) => t.id), [...LOOKS]);
  assert.deepEqual(Object.keys(CLASSIC_LOOKS), [...LOOKS]);
});

test("there are four themes: one flexible and three that style themselves", () => {
  assert.deepEqual([...THEMES], ["classic", "exhibition", "index", "filmstrip"]);
});

test("invalid designs are rejected", () => {
  const d = presetDesign();
  const ok = (x: unknown) => designSchema.safeParse(x).success;
  assert.equal(ok({ ...d, colors: { ...d.colors, accent: "red" } }), false, "bad color");
  assert.equal(ok({ ...d, pages: [d.pages[1], d.pages[0]] }), false, "home not first");
  assert.equal(ok({ ...d, pages: [...d.pages, { ...d.pages[1], id: "other" }] }), false, "duplicate address");
  assert.equal(ok({ ...d, pages: [...d.pages, newPage("blank", "api", makeId)] }), false, "reserved address");
  assert.equal(ok({ ...d, pages: [...d.pages, newPage("blank", "Has Spaces", makeId)] }), false, "bad address");
  assert.equal(ok({ ...d, pages: [...d.pages, { ...newPage("blank", "x", makeId), title: " " }] }), false, "empty title");
  assert.equal(ok({ ...d, gallery: { ...d.gallery, columns: 7 } }), false, "bad columns");
  assert.equal(ok({ ...d, pages: [...d.pages, newPage("gallery", "gallery", makeId)] }), true, "added page");
  assert.equal(ok({ ...d, theme: "sepia" }), false, "a look is not a theme");
  const settings = d.themeSettings;
  assert.equal(ok({ ...d, themeSettings: { ...settings, exhibition: { ...settings.exhibition, wall: "pink" } } }), false, "bad wall");
  assert.equal(ok({ ...d, themeSettings: { ...settings, index: { ...settings.index, accent: "red" } } }), false, "bad accent");
  assert.equal(ok({ ...d, themeSettings: { ...settings, filmstrip: { ...settings.filmstrip, stock: "color" } } }), false, "bad stock");
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

test("accounts without a design keep their original one-page layout as Classic", () => {
  const d = readDesign(undefined, "dark");
  assert.ok(designSchema.safeParse(d).success);
  assert.equal(d.theme, "classic");
  assert.equal(d.look, "dark");
  assert.equal(d.colors.background, "#000000");
  assert.equal(d.pages.length, 1);
  assert.deepEqual(d.pages[0].sections.map((s) => s.type), ["hero", "gallery", "albums", "about", "contact"]);
  assert.equal(readDesign({ junk: true }, "editorial").look, "editorial");
  assert.equal(readDesign(undefined, "nonsense").look, "minimal");
});

test("version 2 designs become Classic with the same look, colors and pages", () => {
  const v3 = presetDesign("classic", "sepia");
  v3.colors = { ...v3.colors, accent: "#123456" }; // an edit on top of the look
  v3.captions = { show: "all", photoIds: [], includeLocation: false };
  const { look, themeSettings, ...rest } = v3;
  void themeSettings;
  const v2 = { ...rest, version: 2, theme: look };
  const d = readDesign(v2, "minimal");
  assert.ok(designSchema.safeParse(d).success);
  assert.equal(d.version, 3);
  assert.equal(d.theme, "classic");
  assert.equal(d.look, "sepia");
  assert.equal(d.colors.accent, "#123456");
  assert.deepEqual(d.pages, v3.pages);
  assert.deepEqual(d.captions, v3.captions);
  assert.deepEqual(d.themeSettings, presetDesign().themeSettings);
  // Version 3 designs are returned as they are.
  assert.deepEqual(readDesign(v3, "minimal"), v3);
});

test("switching theme keeps pages and captions, and keeps Classic settings for coming back", () => {
  const d = presetDesign();
  d.captions = { ...d.captions, show: "all" };
  const classicColors = d.colors;
  const away = applyTheme(d, "exhibition");
  assert.equal(away.theme, "exhibition");
  assert.deepEqual(away.pages, d.pages);
  assert.deepEqual(away.captions, d.captions);
  assert.deepEqual(applyTheme(away, "classic").colors, classicColors);
});

test("applying a Classic look changes colors, fonts, gallery and header, and returns to Classic", () => {
  const d = applyTheme(presetDesign(), "index");
  const looked = applyLook(d, "editorial");
  assert.equal(looked.theme, "classic");
  assert.equal(looked.look, "editorial");
  assert.equal(looked.colors.background, "#fafaf9");
  assert.deepEqual(looked.pages.map((p) => p.id), d.pages.map((p) => p.id));
  const hero = looked.pages[0].sections[0];
  assert.ok(hero.type === "hero" && hero.style === "cover");
});

test("an album can be drawn as a page that shows its photos", () => {
  const album = { id: "a1", slug: "weddings", title: "Weddings", description: "By the sea", coverPhotoId: "p2" };
  const page = albumAsPage(album);
  const d = presetDesign();
  assert.ok(designSchema.safeParse({ ...d, pages: [...d.pages, { ...page, showInNav: false }] }).success);
  assert.equal(page.slug, "weddings");
  assert.deepEqual(page.sections.map((s) => [s.type, s.visible]), [["hero", true], ["text", true], ["gallery", true]]);
  const gallery = page.sections[2] as GallerySection;
  const photos = [{ id: "p1" }, { id: "p2" }, { id: "p3" }];
  assert.deepEqual(galleryPhotos(gallery, photos, [{ id: "a1", photoIds: ["p3", "p1"] }]).map((p) => p.id), ["p3", "p1"]);
  assert.equal(albumAsPage({ ...album, description: "" }).sections[1].visible, false, "no empty description block");
});

test("headers and About sections show the photographer's own text, or else their name, location and bio", () => {
  const site = { profile: { name: "Ana Lopes", location: "Lisbon", bio: "Account bio" } } as SiteData;
  const d = presetDesign();
  const [home, about] = d.pages;
  const hero = home.sections.find((s) => s.type === "hero") as HeroSection;
  const bio = about.sections.find((s) => s.type === "about") as AboutSection;

  assert.deepEqual(heroText(site, home, hero), { heading: "Ana Lopes", subheading: "Lisbon" });
  assert.deepEqual(heroText(site, about, hero), { heading: about.title, subheading: "" }, "other pages show their name");
  assert.deepEqual(heroText(site, home, { ...hero, heading: "Light & Water", subheading: "Weddings in Portugal" }), {
    heading: "Light & Water",
    subheading: "Weddings in Portugal",
  });
  assert.equal(aboutText(site, bio), "Account bio");
  assert.equal(aboutText(site, { ...bio, body: "My own words" }), "My own words");

  const edited = { ...d, pages: [{ ...home, sections: home.sections.map((s) => (s.type === "hero" ? { ...s, heading: "x".repeat(81) } : s)) }, about] };
  assert.equal(designSchema.safeParse(edited).success, false, "header titles are limited to 80 characters");
});

test("any page can become the home page, and the old home page gets its own address", () => {
  const d = presetDesign();
  const contact = { ...newPage("blank", "contact", makeId), title: "Contact" };
  const pages = [{ ...d.pages[0], title: "Work" }, d.pages[1], contact];

  const next = makeHomePage(pages, d.pages[1].id, ["work"]);
  assert.deepEqual(next.map((p) => [p.title, p.slug]), [[d.pages[1].title, ""], ["Work", "work-2"], ["Contact", "contact"]]);
  assert.ok(designSchema.safeParse({ ...d, pages: next }).success);
  assert.equal(makeHomePage(next, next[0].id), next, "the home page stays as it is");
});

test("Classic sites can have side margins, and older designs without the setting stay edge to edge", () => {
  const d = presetDesign();
  assert.equal(d.margins, undefined);
  assert.ok(designSchema.safeParse({ ...d, margins: "wide" }).success);
  assert.equal(designSchema.safeParse({ ...d, margins: "huge" }).success, false);
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
  const d = presetDesign();
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
