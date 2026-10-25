// The shape of a photographer's site as the renderer sees it, and helpers
// that also run in the browser (the dashboard's live preview). Keep this
// file free of server-only imports; loading lives in lib/public-site.ts.
import type { User } from "./db";
import { findPage, visibleAlbums, type SiteDesign } from "./design";
import type { PhotoSource } from "./uploads";

export type SiteAlbum = {
  id: string;
  slug: string;
  title: string;
  description: string;
  coverPhotoId?: string;
  photoIds: string[];
};

// Everything the site renderer needs. The renderer decides what to show from
// `design`, so the editor can swap in an unsaved design for a live preview.
export type SiteData = {
  subdomain: string;
  profile: User["profile"];
  design: SiteDesign;
  photos: PhotoSource[]; // every photo, in library order
  albums: SiteAlbum[]; // every album; the design picks which appear
  path: string; // "" for home, else a page or album address
  preview: boolean; // links stay inside the dashboard preview
  allowAiTraining: boolean; // false: AI training crawlers are asked to stay away
};

// The copyright line in every theme's footer: the photographer's own, or
// "© <name>".
export function copyrightLine(profile: Pick<User["profile"], "name" | "copyrightLine">) {
  return profile.copyrightLine || `© ${profile.name}`;
}

// What the current address shows: one of the design's pages, or an album.
// Pages win if a page and an album share an address.
export function resolvePath(site: Pick<SiteData, "design" | "albums" | "path">) {
  const page = findPage(site.design, site.path);
  if (page) return { page };
  const album = visibleAlbums(site.design, site.albums).find((a) => a.slug === site.path);
  return album ? { album } : null;
}

// Where the site's contact form is: the first page with a visible contact
// section, or null if the design has none (the lightbox then offers no
// "Inquire" button).
export function contactHref(site: Pick<SiteData, "design" | "preview">) {
  const page = site.design.pages.find((p) => p.sections.some((s) => s.type === "contact" && s.visible));
  return page ? `${siteHref(site, page.slug)}#inquire` : null;
}

export function siteHref(site: Pick<SiteData, "preview">, path = "") {
  if (site.preview) return `/site-preview${path ? `?path=${path}` : ""}`;
  return `/${path}`;
}
