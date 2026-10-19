import { cacheLife, cacheTag } from "next/cache";
import { findUserBySubdomain, type User } from "./db";
import { readDesign } from "./design";
import { isLive } from "./site";
import { resolvePath, type SiteData } from "./site-data";
import { photoSource } from "./uploads";

export type { SiteAlbum, SiteData } from "./site-data";

export function publishedDesign(user: User) {
  return readDesign(user.design, user.template);
}

export function draftDesign(user: User) {
  return user.draftDesign ? readDesign(user.draftDesign, user.template) : publishedDesign(user);
}

// Builds what the renderer draws. Returns null when the page shouldn't be
// shown: a site that isn't live viewed publicly, or an address with no page
// or album. The preview shows the draft design; the live site the published
// one. Photos Folio has taken down are left out of both.
export function siteData(user: User, opts: { path?: string; preview?: boolean } = {}): SiteData | null {
  if (!opts.preview && !isLive(user)) return null;
  const photos = user.photos.filter((p) => !p.removed);
  const shown = new Set(photos.map((p) => p.id));
  const site: SiteData = {
    subdomain: user.subdomain,
    profile: user.profile,
    design: opts.preview ? draftDesign(user) : publishedDesign(user),
    photos: photos.map((p) => photoSource(user.id, p)),
    albums: (user.albums ?? []).map((a) => ({
      id: a.id,
      slug: a.slug,
      title: a.title,
      description: a.description ?? "",
      coverPhotoId: a.coverPhotoId && shown.has(a.coverPhotoId) ? a.coverPhotoId : undefined,
      // An album left with no photos drops off the site, like an empty one.
      photoIds: a.photoIds.filter((id) => shown.has(id)),
    })),
    path: opts.path ?? "",
    preview: Boolean(opts.preview),
    allowAiTraining: Boolean(user.allowAiTraining),
  };
  // The preview may be showing a page that only exists in the editor's
  // unsaved design, so it renders anyway and falls back to home.
  if (!opts.preview && !resolvePath(site)) return null;
  return site;
}

// The tag every change to a photographer's site invalidates, so visitors see
// edits straight away. lib/db.ts (siteChanged) builds the same tag; it can't
// import this file because this file imports it.
export const siteTag = (subdomain: string) => `site:${subdomain.toLowerCase()}`;

// Everything about one photographer's public site, cached so moving between
// its pages doesn't re-read and re-render from the database each time. It is
// keyed by subdomain only (not page), so stray addresses can't fill the cache.
async function loadSiteData(subdomain: string) {
  "use cache";
  cacheTag(siteTag(subdomain));
  // Browsers may reuse it for a minute (and prefetch it); the server keeps it
  // until something changes, or a day.
  cacheLife({ stale: 60, revalidate: 3600, expire: 86400 });
  const user = await findUserBySubdomain(subdomain);
  return user ? siteData(user) : null;
}

// The site at one address: a page or an album. Null if the site doesn't
// exist, is offline, or has nothing at that address.
export async function loadSite(subdomain: string, path = "") {
  const site = await loadSiteData(subdomain.toLowerCase());
  if (!site) return null;
  const atPath = { ...site, path };
  return resolvePath(atPath) ? atPath : null;
}
