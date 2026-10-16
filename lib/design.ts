// Everything about how a photographer's site looks lives in one SiteDesign
// object. The Web design editor edits it, the site renderer draws from it,
// and (later) an AI agent can propose changes to it: anything that passes
// `designSchema` is safe to render, so no change can break a site.
// Uses relative imports only, so tests can run it directly with Node.
import { z } from "zod";

const hex = z.string().regex(/^#[0-9a-f]{6}$/i, "Use a 6-digit hex color like #1a1a1a");
const id = z.string().min(1).max(64);
const heading = z.string().max(80).describe("Optional heading shown above the section");

export const THEMES = ["minimal", "dark", "editorial"] as const;
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
const aboutSection = z.object({ id, type: z.literal("about"), visible: z.boolean(), title: heading });
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

export const designSchema = z.object({
  version: z.literal(2),
  theme: z.enum(THEMES).describe("Preset the colors, fonts and layout started from"),
  colors: z.object({
    background: hex,
    text: hex,
    muted: hex.describe("Secondary text, borders"),
    accent: hex.describe("Links and buttons"),
  }),
  fonts: z.enum(["sans", "serif", "mixed"]).describe("mixed = serif headings with sans-serif text"),
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

export type SiteDesign = z.infer<typeof designSchema>;
export type SitePage = SiteDesign["pages"][number];
export type Section = SitePage["sections"][number];
export type SectionType = Section["type"];
export type GallerySection = Extract<Section, { type: "gallery" }>;
export type ThemeId = SiteDesign["theme"];

// ── Themes and starting points ──────────────────────────────────────────

type Look = Pick<SiteDesign, "colors" | "fonts" | "gallery"> & { heroStyle: "cover" | "title" };

// The look each theme starts with. Picking a theme applies these and keeps
// the photographer's pages, content and captions.
export const THEME_LOOKS: Record<ThemeId, Look> = {
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

// The starting design for new accounts: a home page and an About page.
export function presetDesign(theme: ThemeId): SiteDesign {
  const look = THEME_LOOKS[theme];
  const makeId = counter("p");
  const home: SitePage = {
    id: makeId(),
    title: "Work",
    slug: "",
    showInNav: true,
    sections: [
      { id: makeId(), type: "hero", visible: true, style: look.heroStyle, coverPhotoId: null },
      { id: makeId(), type: "gallery", visible: true, title: "", source: { kind: "all" }, layout: "default" },
      { id: makeId(), type: "albums", visible: true, title: "" },
    ],
  };
  return {
    version: 2,
    theme,
    colors: { ...look.colors },
    fonts: look.fonts,
    pages: [home, newPage("about", "about", makeId)],
    nav: { albums: false },
    albums: { show: "all", albumIds: [] },
    gallery: { ...look.gallery },
    captions: { show: "none", photoIds: [], includeLocation: true },
  };
}

// Switches theme: new colors, fonts, gallery style and header style; same
// pages and content.
export function applyTheme(design: SiteDesign, theme: ThemeId): SiteDesign {
  const look = THEME_LOOKS[theme];
  return {
    ...design,
    theme,
    colors: { ...look.colors },
    fonts: look.fonts,
    gallery: { ...look.gallery },
    pages: design.pages.map((p) => ({
      ...p,
      sections: p.sections.map((s) => (s.type === "hero" ? { ...s, style: look.heroStyle } : s)),
    })),
  };
}

// ── Reading stored designs ──────────────────────────────────────────────

// Version 1 had one page with a fixed set of sections.
const designSchemaV1 = z.object({
  version: z.literal(1),
  theme: z.enum(THEMES),
  colors: designSchema.shape.colors,
  fonts: designSchema.shape.fonts,
  sections: z.array(z.object({ type: z.enum(["hero", "gallery", "albums", "about", "contact"]), visible: z.boolean() })),
  hero: z.object({ style: z.enum(["cover", "title"]), coverPhotoId: z.string().nullable() }),
  content: z.object({
    homepage: z.enum(["all", "selected"]),
    homepagePhotoIds: z.array(z.string()),
    albums: z.enum(["all", "selected"]),
    albumIds: z.array(z.string()),
  }),
  gallery: designSchema.shape.gallery,
  captions: designSchema.shape.captions,
});

// Turns a version 1 design into a single home page that looks the same.
function fromV1(v1: z.infer<typeof designSchemaV1>): SiteDesign {
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

function isTheme(value: unknown): value is ThemeId {
  return THEMES.includes(value as ThemeId);
}

// The one-page layout sites had before designs were stored, so accounts
// that never saved one keep looking the way they did.
export function legacyDesign(theme: ThemeId): SiteDesign {
  const look = THEME_LOOKS[theme];
  const order: ("hero" | "gallery" | "albums" | "about" | "contact")[] =
    theme === "editorial" ? ["hero", "about", "gallery", "albums", "contact"] : ["hero", "gallery", "albums", "about", "contact"];
  return fromV1({
    version: 1,
    theme,
    colors: { ...look.colors },
    fonts: look.fonts,
    sections: order.map((type) => ({ type, visible: true })),
    hero: { style: look.heroStyle, coverPhotoId: null },
    content: { homepage: "all", homepagePhotoIds: [], albums: "all", albumIds: [] },
    gallery: { ...look.gallery },
    captions: { show: "none", photoIds: [], includeLocation: true },
  });
}

// Reads a stored design, upgrading older versions. Accounts with no stored
// design (or invalid data) get the one-page layout of their original theme.
export function readDesign(stored: unknown, fallbackTheme: unknown): SiteDesign {
  const current = designSchema.safeParse(stored);
  if (current.success) return current.data;
  const v1 = designSchemaV1.safeParse(stored);
  if (v1.success) return fromV1(v1.data);
  return legacyDesign(isTheme(fallbackTheme) ? fallbackTheme : "minimal");
}

// ── What the design selects ─────────────────────────────────────────────

type HasId = { id: string };

function pick<T extends HasId>(all: T[], ids: string[]) {
  const byId = new Map(all.map((x) => [x.id, x]));
  return ids.flatMap((id) => byId.get(id) ?? []);
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
