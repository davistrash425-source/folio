import { cacheLife, cacheTag } from "next/cache";
import { findUserBySubdomain, type User } from "./db";
import { readDesign, withoutProSettings, type SiteDesign } from "./design";
import { isPro } from "./plans";
import { couldBeSubdomain, isLive } from "./site";
import { resolvePath, type SiteData } from "./site-data";
import { photoSource } from "./uploads";

export type { SiteAlbum, SiteData } from "./site-data";

// A saved design may still hold Pro choices after a downgrade (the Pro theme
// and its settings). They stay saved, but a Free account's site shows the
// basic version until it is Pro again.
function forPlan(user: User, design: SiteDesign) {
  return isPro(user) ? design : withoutProSettings(design);
}

export function publishedDesign(user: User) {
  return forPlan(user, readDesign(user.design, user.template));
}

export function draftDesign(user: User) {
  return user.draftDesign ? forPlan(user, readDesign(user.draftDesign, user.template)) : publishedDesign(user);
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
    // The contact email starts as the login email, so it stays off the site
    // (and out of the page data) until the photographer chooses to show it.
    profile: user.profile.showEmail ? user.profile : { ...user.profile, contactEmail: "" },
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

// What an address shows instead of a site, in the photographer's colors
// where there is one. Missing: nobody has the address. Offline: the site
// exists but visitors can't see it (a draft, an unconfirmed email, or
// suspended, which gets no colors so nothing of it shows). No page: the site
// is live but has nothing at that path.
export type SiteLook = { design: SiteDesign };
export type SiteNotice =
  | { status: "missing" }
  | { status: "offline"; look?: SiteLook }
  | { status: "no-page"; look: SiteLook };

type SiteEntry = { status: "ok"; site: SiteData } | Exclude<SiteNotice, { status: "no-page" }>;

// Everything about one photographer's public site, cached so moving between
// its pages doesn't re-read and re-render from the database each time. It is
// keyed by subdomain only (not page), so stray addresses can't fill the cache.
async function loadSiteData(subdomain: string): Promise<SiteEntry> {
  "use cache";
  cacheTag(siteTag(subdomain));
  // Browsers may reuse it for a minute (and prefetch it); the server keeps it
  // until something changes, or a day.
  cacheLife({ stale: 60, revalidate: 3600, expire: 86400 });
  // Made-up addresses (anyone can type any name before the .folio.cam): ones
  // that can't be an account's never reach the database, and "nobody has
  // this" is only kept for ten minutes so a flood of random names can't fill
  // the cache. Signing up for the address refreshes it straight away.
  if (!couldBeSubdomain(subdomain)) {
    cacheLife({ stale: 60, revalidate: 600, expire: 600 });
    return { status: "missing" };
  }
  const user = await findUserBySubdomain(subdomain);
  if (!user) {
    cacheLife({ stale: 60, revalidate: 600, expire: 600 });
    return { status: "missing" };
  }
  const site = siteData(user);
  if (site) return { status: "ok", site };
  return user.suspended ? { status: "offline" } : { status: "offline", look: { design: publishedDesign(user) } };
}

// The site at one address: a page or an album. Null if the site doesn't
// exist, is offline, or has nothing at that address.
export async function loadSite(subdomain: string, path = "") {
  const entry = await loadSiteData(subdomain.toLowerCase());
  if (entry.status !== "ok") return null;
  const atPath = { ...entry.site, path };
  return resolvePath(atPath) ? atPath : null;
}

// Why an address shows no site (see SiteNotice), or null if it shows one.
// Without a path (a not-found page, which isn't told the address), a live
// site means the page was what's missing.
export async function siteNotice(subdomain: string, path?: string): Promise<SiteNotice | null> {
  const entry = await loadSiteData(subdomain.toLowerCase());
  if (entry.status !== "ok") return entry;
  if (path !== undefined && resolvePath({ ...entry.site, path })) return null;
  return { status: "no-page", look: { design: entry.site.design } };
}
