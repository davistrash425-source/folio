// Everything about how a photographer's site looks lives in one SiteDesign
// object. The Web design editor edits it, the site renderer draws from it,
// and (later) an AI agent can propose changes to it: anything that passes
// `designSchema` is safe to render, so no change can break a site.
// Uses relative imports only, so tests can run it directly with Node.
import { z } from "zod";

const hex = z.string().regex(/^#[0-9a-f]{6}$/i, "Use a 6-digit hex color like #1a1a1a");

export const THEMES = ["minimal", "dark", "editorial"] as const;
export const SECTION_TYPES = ["hero", "gallery", "albums", "about", "contact"] as const;

export const designSchema = z.object({
  version: z.literal(1),
  theme: z.enum(THEMES).describe("Preset the colors, fonts and layout started from"),
  colors: z.object({
    background: hex,
    text: hex,
    muted: hex.describe("Secondary text, borders"),
    accent: hex.describe("Links and buttons"),
  }),
  fonts: z.enum(["sans", "serif", "mixed"]).describe("mixed = serif headings with sans-serif text"),
  sections: z
    .array(z.object({ type: z.enum(SECTION_TYPES), visible: z.boolean() }))
    .describe("Home page sections, top to bottom")
    .refine(
      (list) => SECTION_TYPES.every((t) => list.filter((s) => s.type === t).length === 1) && list.length === SECTION_TYPES.length,
      "Each section must appear exactly once",
    ),
  hero: z.object({
    style: z.enum(["cover", "title"]).describe("cover = full-screen photo behind your name; title = large name only"),
    coverPhotoId: z.string().nullable().describe("null = first photo on the home page"),
  }),
  content: z.object({
    homepage: z.enum(["all", "selected"]).describe("Which photos the home page gallery shows"),
    homepagePhotoIds: z.array(z.string()).describe("Used when homepage is 'selected', in order"),
    albums: z.enum(["all", "selected"]).describe("Which albums appear on the site"),
    albumIds: z.array(z.string()).describe("Used when albums is 'selected', in order"),
  }),
  gallery: z.object({
    layout: z.enum(["grid", "masonry", "column", "editorial"]),
    columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).describe("For grid and masonry on large screens"),
    spacing: z.enum(["none", "tight", "airy"]),
    cropping: z.enum(["original", "square", "portrait"]).describe("For grid layout"),
  }),
  captions: z.object({
    show: z.enum(["none", "chosen", "all"]).describe("Which photos show their description under them"),
    photoIds: z.array(z.string()).describe("Used when show is 'chosen'"),
    includeLocation: z.boolean(),
  }),
});

export type SiteDesign = z.infer<typeof designSchema>;
export type ThemeId = SiteDesign["theme"];
export type SectionType = (typeof SECTION_TYPES)[number];

type Look = Pick<SiteDesign, "colors" | "fonts" | "gallery"> & { heroStyle: SiteDesign["hero"]["style"]; order: SectionType[] };

// The look each theme starts with. Picking a theme applies these and keeps
// the photographer's content, captions and section choices.
export const THEME_LOOKS: Record<ThemeId, Look> = {
  minimal: {
    colors: { background: "#ffffff", text: "#18181b", muted: "#71717a", accent: "#18181b" },
    fonts: "sans",
    gallery: { layout: "grid", columns: 3, spacing: "tight", cropping: "portrait" },
    heroStyle: "title",
    order: ["hero", "gallery", "albums", "about", "contact"],
  },
  dark: {
    colors: { background: "#000000", text: "#f4f4f5", muted: "#a1a1aa", accent: "#ffffff" },
    fonts: "sans",
    gallery: { layout: "masonry", columns: 3, spacing: "tight", cropping: "original" },
    heroStyle: "title",
    order: ["hero", "gallery", "albums", "about", "contact"],
  },
  editorial: {
    colors: { background: "#fafaf9", text: "#1c1917", muted: "#78716c", accent: "#1c1917" },
    fonts: "serif",
    gallery: { layout: "editorial", columns: 2, spacing: "airy", cropping: "original" },
    heroStyle: "cover",
    order: ["hero", "about", "gallery", "albums", "contact"],
  },
};

export function presetDesign(theme: ThemeId): SiteDesign {
  const look = THEME_LOOKS[theme];
  return {
    version: 1,
    theme,
    colors: { ...look.colors },
    fonts: look.fonts,
    sections: look.order.map((type) => ({ type, visible: true })),
    hero: { style: look.heroStyle, coverPhotoId: null },
    content: { homepage: "all", homepagePhotoIds: [], albums: "all", albumIds: [] },
    gallery: { ...look.gallery },
    captions: { show: "none", photoIds: [], includeLocation: true },
  };
}

// Switches theme: new colors, fonts, gallery style and hero, same content.
export function applyTheme(design: SiteDesign, theme: ThemeId): SiteDesign {
  const look = THEME_LOOKS[theme];
  return {
    ...design,
    theme,
    colors: { ...look.colors },
    fonts: look.fonts,
    gallery: { ...look.gallery },
    hero: { ...design.hero, style: look.heroStyle },
  };
}

function isTheme(value: unknown): value is ThemeId {
  return THEMES.includes(value as ThemeId);
}

// Reads a stored design, falling back to the account's original theme for
// accounts created before designs existed (or if stored data is invalid).
export function readDesign(stored: unknown, fallbackTheme: unknown): SiteDesign {
  const parsed = designSchema.safeParse(stored);
  if (parsed.success) return parsed.data;
  return presetDesign(isTheme(fallbackTheme) ? fallbackTheme : "minimal");
}

// ── What the design selects ─────────────────────────────────────────────

type HasId = { id: string };

function pick<T extends HasId>(all: T[], ids: string[]) {
  const byId = new Map(all.map((x) => [x.id, x]));
  return ids.flatMap((id) => byId.get(id) ?? []);
}

export function homepagePhotos<T extends HasId>(design: SiteDesign, photos: T[]) {
  return design.content.homepage === "selected" ? pick(photos, design.content.homepagePhotoIds) : photos;
}

// Albums with at least one photo, as chosen in the design.
export function visibleAlbums<T extends HasId & { photoIds: string[] }>(design: SiteDesign, albums: T[]) {
  const chosen = design.content.albums === "selected" ? pick(albums, design.content.albumIds) : albums;
  return chosen.filter((a) => a.photoIds.length > 0);
}

export function showsCaption(design: SiteDesign, photoId: string) {
  const { show, photoIds } = design.captions;
  return show === "all" || (show === "chosen" && photoIds.includes(photoId));
}

export function sameDesign(a: SiteDesign, b: SiteDesign) {
  return JSON.stringify(a) === JSON.stringify(b);
}
