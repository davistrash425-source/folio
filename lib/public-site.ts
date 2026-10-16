import { findUserBySubdomain, type User } from "./db";
import { isPublished } from "./site";
import type { TemplateId } from "./templates";
import { photoSource, type PhotoSource } from "./uploads";

export type SiteData = {
  subdomain: string;
  template: TemplateId;
  profile: User["profile"];
  photos: PhotoSource[];
  albums: { slug: string; title: string }[];
  album?: { slug: string; title: string }; // set on an album page
  // Where links point: "" on the live site, the dashboard preview otherwise.
  preview: boolean;
};

// Builds what the templates render. Returns null when the page shouldn't be
// shown: unknown album, or a draft site viewed publicly.
export function siteData(user: User, opts: { album?: string; preview?: boolean } = {}): SiteData | null {
  if (!opts.preview && !isPublished(user)) return null;
  const albums = (user.albums ?? []).filter((a) => a.photoIds.length > 0);
  const album = opts.album ? albums.find((a) => a.slug === opts.album) : undefined;
  if (opts.album && !album) return null;

  const byId = new Map(user.photos.map((p) => [p.id, p]));
  const photos = album ? album.photoIds.flatMap((id) => byId.get(id) ?? []) : user.photos;
  return {
    subdomain: user.subdomain,
    template: user.template,
    profile: user.profile,
    photos: photos.map((p) => photoSource(user.id, p)),
    albums: albums.map(({ slug, title }) => ({ slug, title })),
    album: album && { slug: album.slug, title: album.title },
    preview: Boolean(opts.preview),
  };
}

export async function loadSite(subdomain: string, album?: string) {
  const user = await findUserBySubdomain(subdomain);
  return user ? siteData(user, { album }) : null;
}

export function siteHref(site: Pick<SiteData, "preview">, album?: string) {
  if (site.preview) return `/dashboard/preview${album ? `?album=${album}` : ""}`;
  return album ? `/${album}` : "/";
}
