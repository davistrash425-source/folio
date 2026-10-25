import { type PageTemplate, type SectionType } from "@/lib/design";

export type EditorPhoto = { id: string; src: string; srcSet?: string; description: string; location: string };

export type EditorAlbum = { id: string; slug: string; title: string; photoCount: number };

export type Profile = { name: string; location: string; bio: string };

// What a page's Header and About sections show when their boxes are empty.
export type SectionDefaults = { heading: string; subheading: string; bio: string };

export const SECTION_LABELS: Record<SectionType, string> = {
  hero: "Header",
  gallery: "Gallery",
  albums: "Album links",
  about: "About (your bio)",
  text: "Text",
  contact: "Contact form",
};

export const PAGE_TEMPLATE_LABELS: Record<PageTemplate, string> = {
  gallery: "Gallery page",
  about: "About page",
  contact: "Contact page",
  blank: "Blank page",
};


export const makeId = () => crypto.randomUUID();
