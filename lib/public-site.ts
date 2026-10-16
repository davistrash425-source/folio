import { findUserBySubdomain, type User } from "./db";
import { readDesign } from "./design";
import { isPublished } from "./site";
import { currentAlbum, type SiteData } from "./site-data";
import { photoSource } from "./uploads";

export type { SiteAlbum, SiteData } from "./site-data";

export function publishedDesign(user: User) {
  return readDesign(user.design, user.template);
}

export function draftDesign(user: User) {
  return user.draftDesign ? readDesign(user.draftDesign, user.template) : publishedDesign(user);
}

// Builds what the renderer draws. Returns null when the page shouldn't be
// shown: a draft site viewed publicly, or an album that isn't on the site.
// The preview shows the draft design; the live site the published one.
export function siteData(user: User, opts: { album?: string; preview?: boolean } = {}): SiteData | null {
  if (!opts.preview && !isPublished(user)) return null;
  const site: SiteData = {
    subdomain: user.subdomain,
    profile: user.profile,
    design: opts.preview ? draftDesign(user) : publishedDesign(user),
    photos: user.photos.map((p) => photoSource(user.id, p)),
    albums: (user.albums ?? []).map((a) => ({
      id: a.id,
      slug: a.slug,
      title: a.title,
      description: a.description ?? "",
      coverPhotoId: a.coverPhotoId,
      photoIds: a.photoIds,
    })),
    albumSlug: opts.album,
    preview: Boolean(opts.preview),
  };
  if (opts.album && !currentAlbum(site)) return null;
  return site;
}

export async function loadSite(subdomain: string, album?: string) {
  const user = await findUserBySubdomain(subdomain);
  return user ? siteData(user, { album }) : null;
}
