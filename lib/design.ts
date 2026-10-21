// Everything about how a photographer's site looks lives in one SiteDesign
// object. The Web design editor edits it, the site renderer draws from it,
// and (later) an AI agent can propose changes to it: anything that passes
// `designSchema` is safe to render, so no change can break a site.
// Uses relative imports only, so tests can run it directly with Node.
import { z } from "zod";

const hex = z.string().regex(/^#[0-9a-f]{6}$/i, "Use a 6-digit hex color like #1a1a1a");
const id = z.string().min(1).max(64);
const heading = z.string().max(80).describe("Optional heading shown above the section");

// The Classic theme's starting looks: ready-made colors, fonts and gallery
// styles. They're presets, not separate layouts, so any of them can be
// reproduced by editing Classic's settings.
export const LOOKS = [
  "minimal",
  "dark",
  "editorial",
  "darkroom",
  "contact-sheet",
  "sepia",
  "polaroid",
  "noir",
  "cyanotype",
  "kodachrome",
  "magazine",
  "desert",
  "forest",
  "riso",
  "neon",
  "concrete",
  "sorbet",
] as const;

// Each theme draws the site with its own layout code. Classic is the flexible
// one (colors, fonts and gallery styles are editable); the others decide how
// the site looks and moves themselves, and only offer a few settings.
export const THEMES = ["classic", "exhibition", "index", "filmstrip"] as const;
export const WALLS = ["charcoal", "plaster", "oxblood", "forest"] as const;
export const FILM_STOCKS = ["gold", "mono", "slide"] as const;
export const INDEX_SORTS = ["manual", "newest", "location"] as const;
export const FONTS = ["sans", "serif", "mixed", "mono"] as const;
export const GALLERY_LAYOUTS = ["grid", "masonry", "column", "editorial"] as const;

// Page addresses that would clash with the app's own routes.
// Keep in sync with RESERVED_SLUGS in lib/site.ts.
export const RESERVED_PAGE_SLUGS = ["api", "_next", "favicon.ico", "sites"];

// ── Sections: the building blocks of a page ─────────────────────────────

const heroSection = z.object({
  id,
  type: z.literal("hero"),
  visible: z.boolean(),
  style: z.enum(["cover", "title"]).describe("cover = full-screen photo behind your name; title = large name only"),
  coverPhotoId: z.string().nullable().describe("null = first photo on the page"),
  heading: z.string().max(80).optional().describe("Empty = your name on the home page, the page's name elsewhere"),
  subheading: z.string().max(120).optional().describe("Empty = your location on the home page"),
});

const gallerySection = z.object({
  id,
  type: z.literal("gallery"),
  visible: z.boolean(),
  title: heading,
  source: z
    .discriminatedUnion("kind", [
      z.object({ kind: z.literal("all") }),
      z.object({ kind: z.literal("photos"), photoIds: z.array(z.string()).describe("In display order") }),
      z.object({ kind: z.literal("album"), albumId: z.string() }),
    ])
    .describe("Which photos this gallery shows"),
  layout: z.enum(["default", ...GALLERY_LAYOUTS]).describe("default = the site-wide gallery style"),
});

const albumsSection = z.object({ id, type: z.literal("albums"), visible: z.boolean(), title: heading });
const aboutSection = z.object({
  id,
  type: z.literal("about"),
  visible: z.boolean(),
  title: heading,
  body: z.string().max(5000).optional().describe("Empty = the bio from the Account page"),
});
const contactSection = z.object({ id, type: z.literal("contact"), visible: z.boolean(), title: heading });
const textSection = z.object({
  id,
  type: z.literal("text"),
  visible: z.boolean(),
  title: heading,
  body: z.string().max(5000),
});

const sectionSchema = z.discriminatedUnion("type", [
  heroSection,
  gallerySection,
  albumsSection,
  aboutSection,
  textSection,
  contactSection,
]);

const pageSchema = z.object({
  id,
  title: z.string().trim().min(1, "Every page needs a name").max(40).describe("Shown in the site menu"),
  slug: z
    .string()
    .max(40)
    .regex(/^$|^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Page addresses use lowercase letters, numbers and dashes")
    .describe('The page address: "" for the home page, e.g. "about" for /about'),
  showInNav: z.boolean(),
  sections: z.array(sectionSchema).max(30).describe("Top to bottom"),
});

const designBase = z.object({
  colors: z.object({
    background: hex,
    text: hex,
    muted: hex.describe("Secondary text, borders"),
    accent: hex.describe("Links and buttons"),
  }),
  fonts: z.enum(FONTS).describe("mixed = serif headings with sans-serif text; mono = typewriter-style monospace"),
  pages: z
    .array(pageSchema)
    .min(1)
    .max(20)
    .describe("The site's pages in menu order. The first is the home page.")
    .superRefine((pages, ctx) => {
      if (pages[0]?.slug !== "") ctx.addIssue({ code: "custom", message: "The first page must be the home page" });
      const slugs = new Set<string>();
      const ids = new Set<string>();
      for (const page of pages.slice(1)) {
        if (page.slug === "") ctx.addIssue({ code: "custom", message: `“${page.title}” needs an address` });
        if (RESERVED_PAGE_SLUGS.includes(page.slug)) ctx.addIssue({ code: "custom", message: `/${page.slug} is reserved` });
      }
      for (const page of pages) {
        if (slugs.has(page.slug)) ctx.addIssue({ code: "custom", message: `Two pages use the address /${page.slug}` });
        slugs.add(page.slug);
        for (const x of [page, ...page.sections]) {
          if (ids.has(x.id)) ctx.addIssue({ code: "custom", message: "Duplicate page or section id" });
          ids.add(x.id);
        }
      }
    }),
  nav: z.object({ albums: z.boolean().describe("Also list albums in the site menu") }),
  albums: z.object({
    show: z.enum(["all", "selected"]).describe("Which albums are on the site (each gets a page at /<album>)"),
    albumIds: z.array(z.string()).describe("Used when show is 'selected', in order"),
  }),
  gallery: z
    .object({
      layout: z.enum(GALLERY_LAYOUTS),
      columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).describe("For grid and masonry on large screens"),
      spacing: z.enum(["none", "tight", "airy"]),
      cropping: z.enum(["original", "square", "portrait"]).describe("For grid layout"),
    })
    .describe("Site-wide gallery style"),
  captions: z.object({
    show: z.enum(["none", "chosen", "all"]).describe("Which photos show their description under them"),
    photoIds: z.array(z.string()).describe("Used when show is 'chosen'"),
    includeLocation: z.boolean(),
  }),
});

// Settings for the creative themes. All of them are always stored, so
// switching away from a theme and back keeps what was chosen.
const themeSettingsSchema = z
  .object({
    exhibition: z.object({
      wall: z.enum(WALLS).describe("Wall color"),
      labels: z.enum(["below", "beside"]).describe("Where the wall label sits next to each photo"),
    }),
    index: z.object({
      accent: hex.describe("Hover and link color"),
      sort: z.enum(INDEX_SORTS).describe("manual = the order you set; newest = latest upload first; location = A–Z"),
    }),
    filmstrip: z.object({
      stock: z.enum(FILM_STOCKS).describe("The film's color and edge print"),
      frameNumbers: z.boolean(),
    }),
  })
  .describe("Used only when that theme is chosen");

export const designSchema = designBase.extend({
  version: z.literal(3),
  theme: z.enum(THEMES),
  look: z.enum(LOOKS).describe("Which Classic look was applied last; colors, fonts and gallery hold the actual values"),
  themeSettings: themeSettingsSchema,
});

// Version 2 had Classic's looks as its themes and no settings for others.
const designSchemaV2 = designBase.extend({ version: z.literal(2), theme: z.enum(LOOKS) });
type DesignV2 = z.infer<typeof designSchemaV2>;

export type SiteDesign = z.infer<typeof designSchema>;
export type LookId = (typeof LOOKS)[number];
export type ThemeSettings = SiteDesign["themeSettings"];
export type SitePage = SiteDesign["pages"][number];
export type Section = SitePage["sections"][number];
export type SectionType = Section["type"];
export type GallerySection = Extract<Section, { type: "gallery" }>;
export type HeroSection = Extract<Section, { type: "hero" }>;
export type AboutSection = Extract<Section, { type: "about" }>;
export type ThemeId = SiteDesign["theme"];

// ── Themes and starting points ──────────────────────────────────────────

type Look = Pick<SiteDesign, "colors" | "fonts" | "gallery"> & { heroStyle: "cover" | "title" };

// The look each Classic preset starts with. Picking one applies these and
// keeps the photographer's pages, content and captions.
export const CLASSIC_LOOKS: Record<LookId, Look> = {
  minimal: {
    colors: { background: "#ffffff", text: "#18181b", muted: "#71717a", accent: "#18181b" },
    fonts: "sans",
    gallery: { layout: "grid", columns: 3, spacing: "tight", cropping: "portrait" },
    heroStyle: "title",
  },
  dark: {
    colors: { background: "#000000", text: "#f4f4f5", muted: "#a1a1aa", accent: "#ffffff" },
    fonts: "sans",
    gallery: { layout: "masonry", columns: 3, spacing: "tight", cropping: "original" },
    heroStyle: "title",
  },
  editorial: {
    colors: { background: "#fafaf9", text: "#1c1917", muted: "#78716c", accent: "#1c1917" },
    fonts: "serif",
    gallery: { layout: "editorial", columns: 2, spacing: "airy", cropping: "original" },
    heroStyle: "cover",
  },
  darkroom: {
    colors: { background: "#120807", text: "#f3e3dc", muted: "#9a6b62", accent: "#e5484d" },
    fonts: "mono",
    gallery: { layout: "masonry", columns: 3, spacing: "tight", cropping: "original" },
    heroStyle: "title",
  },
  "contact-sheet": {
    colors: { background: "#1a1a18", text: "#f0ede4", muted: "#8c887d", accent: "#f2c94c" },
    fonts: "mono",
    gallery: { layout: "grid", columns: 4, spacing: "tight", cropping: "square" },
    heroStyle: "title",
  },
  sepia: {
    colors: { background: "#f1e7d6", text: "#3b2a1a", muted: "#8a6f52", accent: "#8b4513" },
    fonts: "serif",
    gallery: { layout: "grid", columns: 3, spacing: "airy", cropping: "original" },
    heroStyle: "cover",
  },
  polaroid: {
    colors: { background: "#f4f1ea", text: "#222222", muted: "#8a8478", accent: "#c2410c" },
    fonts: "mixed",
    gallery: { layout: "grid", columns: 3, spacing: "airy", cropping: "square" },
    heroStyle: "title",
  },
  noir: {
    colors: { background: "#0b0b0b", text: "#e8e8e8", muted: "#7a7a7a", accent: "#c9a227" },
    fonts: "serif",
    gallery: { layout: "column", columns: 2, spacing: "airy", cropping: "original" },
    heroStyle: "cover",
  },
  cyanotype: {
    colors: { background: "#0f2c4c", text: "#e6f0fa", muted: "#8fb0d1", accent: "#ffffff" },
    fonts: "serif",
    gallery: { layout: "masonry", columns: 3, spacing: "tight", cropping: "original" },
    heroStyle: "title",
  },
  kodachrome: {
    colors: { background: "#fff8e7", text: "#1d1d1b", muted: "#8a7a5a", accent: "#d7261e" },
    fonts: "sans",
    gallery: { layout: "grid", columns: 4, spacing: "tight", cropping: "square" },
    heroStyle: "cover",
  },
  magazine: {
    colors: { background: "#ffffff", text: "#111111", muted: "#666666", accent: "#e10600" },
    fonts: "mixed",
    gallery: { layout: "editorial", columns: 2, spacing: "tight", cropping: "original" },
    heroStyle: "cover",
  },
  desert: {
    colors: { background: "#f3e2d3", text: "#4a2c21", muted: "#a0715c", accent: "#a8431f" },
    fonts: "mixed",
    gallery: { layout: "editorial", columns: 2, spacing: "airy", cropping: "original" },
    heroStyle: "cover",
  },
  forest: {
    colors: { background: "#1d2a22", text: "#e9efe6", muted: "#93a596", accent: "#b7d48a" },
    fonts: "mixed",
    gallery: { layout: "masonry", columns: 2, spacing: "airy", cropping: "original" },
    heroStyle: "cover",
  },
  riso: {
    colors: { background: "#fdf6ec", text: "#1f3fbf", muted: "#7b86c9", accent: "#c81d5a" },
    fonts: "mono",
    gallery: { layout: "grid", columns: 3, spacing: "tight", cropping: "square" },
    heroStyle: "title",
  },
  neon: {
    colors: { background: "#0d0221", text: "#f8f1ff", muted: "#9b8ab8", accent: "#ff2e97" },
    fonts: "sans",
    gallery: { layout: "grid", columns: 3, spacing: "none", cropping: "square" },
    heroStyle: "cover",
  },
  concrete: {
    colors: { background: "#d4d4d0", text: "#1a1a1a", muted: "#5e5e5a", accent: "#b33a00" },
    fonts: "mono",
    gallery: { layout: "grid", columns: 4, spacing: "none", cropping: "portrait" },
    heroStyle: "title",
  },
  sorbet: {
    colors: { background: "#fdeef0", text: "#4a2b3a", muted: "#a8858f", accent: "#b8436a" },
    fonts: "serif",
    gallery: { layout: "masonry", columns: 3, spacing: "airy", cropping: "original" },
    heroStyle: "title",
  },
};

// Ready-made sections and pages for the editor's "Add" menus. `makeId`
// lets callers supply unique ids (the editor uses random ones).
export function newSection(type: SectionType, makeId: () => string): Section {
  const base = { id: makeId(), visible: true, title: "" };
  switch (type) {
    case "hero":
      return { id: base.id, type, visible: true, style: "title", coverPhotoId: null };
    case "gallery":
      return { ...base, type, source: { kind: "all" }, layout: "default" };
    case "text":
      return { ...base, type, title: "A few words", body: "" };
    default:
      return { ...base, type };
  }
}

export const PAGE_TEMPLATES = {
  gallery: { title: "Gallery", sections: ["gallery"] },
  about: { title: "About", sections: ["about", "contact"] },
  contact: { title: "Contact", sections: ["contact"] },
  blank: { title: "New page", sections: ["text"] },
} satisfies Record<string, { title: string; sections: SectionType[] }>;

export type PageTemplate = keyof typeof PAGE_TEMPLATES;

export function newPage(
  template: PageTemplate,
  slug: string,
  makeId: () => string,
  title: string = PAGE_TEMPLATES[template].title,
): SitePage {
  return {
    id: makeId(),
    title,
    slug,
    showInNav: true,
    sections: PAGE_TEMPLATES[template].sections.map((t) => newSection(t, makeId)),
  };
}

function counter(prefix: string) {
  let n = 0;
  return () => `${prefix}${++n}`;
}

export function defaultThemeSettings(): ThemeSettings {
  return {
    exhibition: { wall: "charcoal", labels: "below" },
    index: { accent: "#e5322d", sort: "manual" },
    filmstrip: { stock: "gold", frameNumbers: true },
  };
}

// The starting design for new accounts: a home page and an About page.
export function presetDesign(theme: ThemeId = "classic", look: LookId = "minimal"): SiteDesign {
  const preset = CLASSIC_LOOKS[look];
  const makeId = counter("p");
  const home: SitePage = {
    id: makeId(),
    title: "Work",
    slug: "",
    showInNav: true,
    sections: [
      { id: makeId(), type: "hero", visible: true, style: preset.heroStyle, coverPhotoId: null },
      { id: makeId(), type: "gallery", visible: true, title: "", source: { kind: "all" }, layout: "default" },
      { id: makeId(), type: "albums", visible: true, title: "" },
    ],
  };
  return {
    version: 3,
    theme,
    look,
    themeSettings: defaultThemeSettings(),
    colors: { ...preset.colors },
    fonts: preset.fonts,
    pages: [home, newPage("about", "about", makeId)],
    nav: { albums: false },
    albums: { show: "all", albumIds: [] },
    gallery: { ...preset.gallery },
    captions: { show: "none", photoIds: [], includeLocation: true },
  };
}

// Switches theme. Pages and content carry over, and Classic's colors, fonts
// and gallery style are kept for if you come back to it.
export function applyTheme(design: SiteDesign, theme: ThemeId): SiteDesign {
  return { ...design, theme };
}

// Applies one of Classic's looks (and switches to Classic): new colors,
// fonts, gallery style and header style; same pages and content.
export function applyLook(design: SiteDesign, look: LookId): SiteDesign {
  const preset = CLASSIC_LOOKS[look];
  return {
    ...design,
    theme: "classic",
    look,
    colors: { ...preset.colors },
    fonts: preset.fonts,
    gallery: { ...preset.gallery },
    pages: design.pages.map((p) => ({
      ...p,
      sections: p.sections.map((sec) => (sec.type === "hero" ? { ...sec, style: preset.heroStyle } : sec)),
    })),
  };
}

// ── Reading stored designs ──────────────────────────────────────────────

// Version 1 had one page with a fixed set of sections.
const designSchemaV1 = z.object({
  version: z.literal(1),
  theme: z.enum(LOOKS),
  colors: designBase.shape.colors,
  fonts: designBase.shape.fonts,
  sections: z.array(z.object({ type: z.enum(["hero", "gallery", "albums", "about", "contact"]), visible: z.boolean() })),
  hero: z.object({ style: z.enum(["cover", "title"]), coverPhotoId: z.string().nullable() }),
  content: z.object({
    homepage: z.enum(["all", "selected"]),
    homepagePhotoIds: z.array(z.string()),
    albums: z.enum(["all", "selected"]),
    albumIds: z.array(z.string()),
  }),
  gallery: designBase.shape.gallery,
  captions: designBase.shape.captions,
});

// Turns a version 1 design into a single home page that looks the same.
function fromV1(v1: z.infer<typeof designSchemaV1>): DesignV2 {
  const makeId = counter("m");
  const sections: Section[] = v1.sections.map(({ type, visible }) => {
    const sid = makeId();
    switch (type) {
      case "hero":
        return { id: sid, type, visible, ...v1.hero };
      case "gallery":
        return {
          id: sid,
          type,
          visible,
          title: "",
          source: v1.content.homepage === "selected" ? { kind: "photos", photoIds: v1.content.homepagePhotoIds } : { kind: "all" },
          layout: "default",
        };
      default:
        return { id: sid, type, visible, title: "" };
    }
  });
  return {
    version: 2,
    theme: v1.theme,
    colors: v1.colors,
    fonts: v1.fonts,
    pages: [{ id: makeId(), title: "Work", slug: "", showInNav: true, sections }],
    nav: { albums: true }, // version 1 listed albums in the menu
    albums: { show: v1.content.albums, albumIds: v1.content.albumIds },
    gallery: v1.gallery,
    captions: v1.captions,
  };
}

// Version 2's themes were Classic's looks, so those sites become Classic with
// the same look. Colors, fonts and gallery were stored in full, so they
// look exactly as before.
function fromV2(v2: DesignV2): SiteDesign {
  return { ...v2, version: 3, theme: "classic", look: v2.theme, themeSettings: defaultThemeSettings() };
}

function isLook(value: unknown): value is LookId {
  return LOOKS.includes(value as LookId);
}

// The one-page layout sites had before designs were stored, so accounts
// that never saved one keep looking the way they did.
export function legacyDesign(theme: LookId): SiteDesign {
  const look = CLASSIC_LOOKS[theme];
  const order: ("hero" | "gallery" | "albums" | "about" | "contact")[] =
    theme === "editorial" ? ["hero", "about", "gallery", "albums", "contact"] : ["hero", "gallery", "albums", "about", "contact"];
  return fromV2(fromV1({
    version: 1,
    theme,
    colors: { ...look.colors },
    fonts: look.fonts,
    sections: order.map((type) => ({ type, visible: true })),
    hero: { style: look.heroStyle, coverPhotoId: null },
    content: { homepage: "all", homepagePhotoIds: [], albums: "all", albumIds: [] },
    gallery: { ...look.gallery },
    captions: { show: "none", photoIds: [], includeLocation: true },
  }));
}

// Reads a stored design, upgrading older versions. Accounts with no stored
// design (or invalid data) get the one-page layout of their original theme.
export function readDesign(stored: unknown, fallbackTheme: unknown): SiteDesign {
  const current = designSchema.safeParse(stored);
  if (current.success) return current.data;
  const v2 = designSchemaV2.safeParse(stored);
  if (v2.success) return fromV2(v2.data);
  const v1 = designSchemaV1.safeParse(stored);
  if (v1.success) return fromV2(fromV1(v1.data));
  return legacyDesign(isLook(fallbackTheme) ? fallbackTheme : "minimal");
}

// ── What the design selects ─────────────────────────────────────────────

type HasId = { id: string };

function pick<T extends HasId>(all: T[], ids: string[]) {
  const byId = new Map(all.map((x) => [x.id, x]));
  return ids.flatMap((id) => byId.get(id) ?? []);
}

// An album drawn as a page (title, description, its photos). The creative
// themes show album addresses this way, so they only need to draw pages.
export function albumAsPage(album: {
  id: string;
  slug: string;
  title: string;
  description: string;
  coverPhotoId?: string;
}): SitePage {
  return {
    id: `album-${album.id}`,
    title: album.title,
    slug: album.slug,
    showInNav: false,
    sections: [
      { id: "album-title", type: "hero", visible: true, style: "title", coverPhotoId: album.coverPhotoId ?? null },
      { id: "album-text", type: "text", visible: Boolean(album.description), title: "", body: album.description },
      { id: "album-gallery", type: "gallery", visible: true, title: "", source: { kind: "album", albumId: album.id }, layout: "default" },
    ],
  };
}

export function findPage(design: SiteDesign, slug: string) {
  return design.pages.find((p) => p.slug === slug);
}

// The photos a gallery section shows.
export function galleryPhotos<T extends HasId>(
  section: GallerySection,
  photos: T[],
  albums: { id: string; photoIds: string[] }[],
) {
  const { source } = section;
  if (source.kind === "photos") return pick(photos, source.photoIds);
  if (source.kind === "album") return pick(photos, albums.find((a) => a.id === source.albumId)?.photoIds ?? []);
  return photos;
}

// Albums with at least one photo, as chosen in the design.
export function visibleAlbums<T extends HasId & { photoIds: string[] }>(design: SiteDesign, albums: T[]) {
  const chosen = design.albums.show === "selected" ? pick(albums, design.albums.albumIds) : albums;
  return chosen.filter((a) => a.photoIds.length > 0);
}

export function showsCaption(design: SiteDesign, photoId: string) {
  const { show, photoIds } = design.captions;
  return show === "all" || (show === "chosen" && photoIds.includes(photoId));
}

export function sameDesign(a: SiteDesign, b: SiteDesign) {
  return JSON.stringify(a) === JSON.stringify(b);
}

// A page address made from a title that doesn't clash with `taken`.
// Makes a page the home page: it moves to the top of the list and takes the
// address "/", and the old home page gets an address made from its name
// (avoiding `taken`, e.g. album addresses) and the new home's old place.
export function makeHomePage(pages: SitePage[], pageId: string, taken: string[] = []): SitePage[] {
  const i = pages.findIndex((p) => p.id === pageId);
  if (i <= 0) return pages;
  const [home, chosen] = [pages[0], pages[i]];
  const others = pages.filter((p) => p.id !== home.id && p.id !== chosen.id).map((p) => p.slug);
  const next = [...pages];
  next[i] = { ...home, slug: uniqueSlug(home.title, [...others, ...taken]) };
  next[0] = { ...chosen, slug: "" };
  return next;
}

export function uniqueSlug(title: string, taken: string[]) {
  const base =
    title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 34)
      .replace(/-+$/, "") || "page";
  const used = new Set([...taken, ...RESERVED_PAGE_SLUGS, ""]);
  let slug = base;
  for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`;
  return slug;
}
