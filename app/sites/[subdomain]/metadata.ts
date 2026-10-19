import type { Metadata } from "next";
import { galleryPhotos } from "@/lib/design";
import { resolvePath, type SiteData } from "@/lib/site-data";
import { siteUrl } from "@/lib/site";

// Metadata for every page and album of a photographer's site.
export function siteMetadata(subdomain: string, site: SiteData | null): Metadata {
  const target = site && resolvePath(site);
  if (!site || !target) return { title: "Site not found" };
  const { profile } = site;
  const byId = new Map(site.photos.map((p) => [p.id, p]));

  let title = `${profile.name} — Photography`;
  let description = profile.bio;
  let cover;
  if (target.album) {
    title = `${target.album.title} — ${profile.name}`;
    description = target.album.description || profile.bio;
    cover = byId.get(target.album.coverPhotoId ?? "") ?? byId.get(target.album.photoIds[0]);
  } else {
    const page = target.page;
    if (page.slug) title = `${page.title} — ${profile.name}`;
    const hero = page.sections.find((s) => s.type === "hero");
    const gallery = page.sections.find((s) => s.type === "gallery" && s.visible);
    cover =
      (hero?.type === "hero" && hero.coverPhotoId ? byId.get(hero.coverPhotoId) : undefined) ??
      (gallery?.type === "gallery" ? galleryPhotos(gallery, site.photos, site.albums)[0] : undefined) ??
      site.photos[0];
  }
  return {
    title,
    description: description.slice(0, 160) || `Photography by ${profile.name}`,
    // Photo URLs are relative; link previews need them absolute.
    metadataBase: new URL(siteUrl(subdomain)),
    openGraph: cover ? { title, images: [{ url: cover.src, alt: cover.alt }] } : { title },
    // A big photo, not a thumbnail, when the link is shared on X and the like.
    twitter: cover ? { card: "summary_large_image" } : undefined,
    // The "noai" tags some image scrapers honor, alongside robots.txt.
    other: site.allowAiTraining ? undefined : { robots: "noai, noimageai" },
  };
}
