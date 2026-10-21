// Helpers every theme uses, so each one only has to decide how things look.
import type { User } from "@/lib/db";
import {
  albumAsPage,
  galleryPhotos,
  showsCaption,
  visibleAlbums,
  type AboutSection,
  type HeroSection,
  type Section,
  type SiteDesign,
  type SitePage,
} from "@/lib/design";
import { resolvePath, siteHref, type SiteAlbum, type SiteData } from "@/lib/site-data";
import type { PhotoSource } from "@/lib/uploads";

export type ThemeProps = { site: SiteData };

// What the current address shows, always as a page. Album addresses become a
// page with the album's title, description and photos. An address that no
// longer exists (possible in the editor's unsaved preview) shows home.
export function currentPage(site: SiteData): { page: SitePage; album?: SiteAlbum; current: string } {
  const target = resolvePath(site);
  if (target?.album) return { page: albumAsPage(target.album), album: target.album, current: target.album.slug };
  const page = target?.page ?? site.design.pages[0];
  return { page, current: page.slug };
}

// The sections to draw: the visible ones, and, like Classic, a title on any
// page other than home that doesn't open with its own header section.
export function visibleSections(page: SitePage): Section[] {
  const sections = page.sections.filter((s) => s.visible);
  if (page.slug !== "" && sections[0]?.type !== "hero") {
    return [{ id: "page-title", type: "hero", visible: true, style: "title", coverPhotoId: null }, ...sections];
  }
  return sections;
}

// A header's text: what the photographer wrote in the editor, or else their
// name and location on the home page and the page's name elsewhere.
export function heroText(site: SiteData, page: SitePage, section: HeroSection) {
  const isHome = page.slug === "";
  return {
    heading: section.heading || (isHome ? site.profile.name : page.title),
    subheading: section.subheading || (isHome ? site.profile.location : ""),
  };
}

// An About section's text: its own, or else the bio from the Account page.
export function aboutText(site: SiteData, section: AboutSection) {
  return section.body || site.profile.bio;
}

export type NavItem = { href: string; title: string; path: string };

// The site menu: pages shown in the menu, then albums if the design lists them.
export function navItems(site: SiteData): NavItem[] {
  const { design } = site;
  const items: NavItem[] = design.pages
    .filter((p) => p.showInNav)
    .map((p) => ({ href: siteHref(site, p.slug), title: p.title, path: p.slug }));
  if (design.nav.albums) {
    for (const a of visibleAlbums(design, site.albums)) {
      if (!items.some((i) => i.path === a.slug)) items.push({ href: siteHref(site, a.slug), title: a.title, path: a.slug });
    }
  }
  // A menu with only the home page adds nothing; the site name links home.
  return items.some((i) => i.path !== "") ? items : [];
}

// The text shown for a photo where the design shows captions.
export function captionText(photo: PhotoSource, design: SiteDesign) {
  if (!showsCaption(design, photo.id)) return "";
  const parts = [photo.description, design.captions.includeLocation ? photo.location : ""].filter(Boolean);
  return parts.join(" · ");
}

export type GalleryBlock = { photos: PhotoSource[]; offset: number };

// The photos of every visible gallery on a page, plus where each gallery's
// photos start in one combined list. Themes wrap the whole page in a single
// lightbox, so a photo's lightbox position is its gallery's `offset` plus its
// place in the gallery. `arrange` lets a theme reorder a gallery's photos.
export function pageGalleries(site: SiteData, page: SitePage, arrange: (photos: PhotoSource[]) => PhotoSource[] = (p) => p) {
  const blocks = new Map<string, GalleryBlock>();
  const all: PhotoSource[] = [];
  for (const section of page.sections) {
    if (section.type !== "gallery" || !section.visible) continue;
    const photos = arrange(galleryPhotos(section, site.photos, site.albums));
    blocks.set(section.id, { photos, offset: all.length });
    all.push(...photos);
  }
  const captions = Object.fromEntries(all.map((p) => [p.id, captionText(p, site.design)]));
  return { blocks, all, captions };
}

export function socialLinks(profile: User["profile"]) {
  const s = profile.social;
  return [
    ["Instagram", s.instagram],
    ["X", s.twitter],
    ["Facebook", s.facebook],
    ["Website", s.website],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));
}

// The "Untitled 07" style name for a photo without a description.
export function photoTitle(photo: PhotoSource, index: number) {
  return photo.description || `Untitled ${String(index + 1).padStart(2, "0")}`;
}

export function pad(n: number) {
  return String(n).padStart(2, "0");
}
