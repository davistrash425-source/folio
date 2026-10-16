// The shape of a photographer's site as the renderer sees it, and helpers
// that also run in the browser (the dashboard's live preview). Keep this
// file free of server-only imports; loading lives in lib/public-site.ts.
import type { User } from "./db";
import { visibleAlbums, type SiteDesign } from "./design";
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
  albumSlug?: string; // set on an album page
  preview: boolean; // links stay inside the dashboard preview
};

export function currentAlbum(site: SiteData) {
  if (!site.albumSlug) return undefined;
  return visibleAlbums(site.design, site.albums).find((a) => a.slug === site.albumSlug);
}

export function siteHref(site: Pick<SiteData, "preview">, album?: string) {
  if (site.preview) return `/site-preview${album ? `?album=${album}` : ""}`;
  return album ? `/${album}` : "/";
}
