import type { Metadata } from "next";
import { homepagePhotos } from "@/lib/design";
import { currentAlbum, type SiteData } from "@/lib/site-data";
import { siteUrl } from "@/lib/site";

// Metadata for the site home page and album pages.
export function siteMetadata(subdomain: string, site: SiteData | null): Metadata {
  if (!site) return { title: "Site not found" };
  const album = currentAlbum(site);
  const title = album ? `${album.title} — ${site.profile.name}` : `${site.profile.name} — Photography`;
  const byId = new Map(site.photos.map((p) => [p.id, p]));
  const cover = album
    ? byId.get(album.coverPhotoId ?? "") ?? byId.get(album.photoIds[0])
    : byId.get(site.design.hero.coverPhotoId ?? "") ?? homepagePhotos(site.design, site.photos)[0];
  const description = (album?.description || site.profile.bio).slice(0, 160) || `Photography by ${site.profile.name}`;
  return {
    title,
    description,
    // Photo URLs are relative; link previews need them absolute.
    metadataBase: new URL(siteUrl(subdomain)),
    openGraph: cover ? { title, images: [{ url: cover.src, alt: cover.alt }] } : { title },
  };
}
