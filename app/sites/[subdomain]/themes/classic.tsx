/* eslint-disable @next/next/no-img-element -- user uploads are served by our own route */
// The Classic theme: clean pages whose colors, fonts and gallery layouts come
// from the design. Used for the live site (server) and the dashboard preview
// (client, with an unsaved design), so it must not use hooks or server-only
// code itself.
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import type { User } from "@/lib/db";
import {
  galleryPhotos,
  visibleAlbums,
  type AboutSection,
  type GallerySection,
  type HeroSection,
  type Section,
  type SiteDesign,
  type SitePage,
} from "@/lib/design";
import { copyrightLine, resolvePath, siteHref, type SiteAlbum, type SiteData } from "@/lib/site-data";
import type { PhotoSource } from "@/lib/uploads";
import { ContactForm } from "../contact-form";
import { Lightbox } from "../lightbox";
import { aboutText, captionText, heroText } from "./shared";
import { ReportLink } from "./report-link";

type Props = { site: SiteData };

// Tailwind needs literal class names, so every option maps to fixed classes.
const GAP = { none: "gap-0", tight: "gap-2", airy: "gap-6 sm:gap-10" };
const MASONRY_GAP = { none: "gap-0 [&>*]:mb-0", tight: "gap-2 [&>*]:mb-2", airy: "gap-6 sm:gap-10 [&>*]:mb-6 sm:[&>*]:mb-10" };
const GRID_COLS = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" };
const MASONRY_COLS = { 2: "sm:columns-2", 3: "sm:columns-2 lg:columns-3", 4: "sm:columns-2 lg:columns-4" };
const CROP = { original: "", square: "aspect-square", portrait: "aspect-[4/5]" };
const SIZES = { 2: "(min-width: 640px) 50vw, 100vw", 3: "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw", 4: "(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw" };

function themeStyle(design: SiteDesign) {
  return {
    "--bg": design.colors.background,
    "--fg": design.colors.text,
    "--muted": design.colors.muted,
    "--accent": design.colors.accent,
  } as CSSProperties;
}

// The content's width on large screens. The background, the menu bar and a
// header photo still fill the window.
const MARGINS = { none: "", medium: "mx-auto w-full max-w-6xl", wide: "mx-auto w-full max-w-4xl" };

// "mixed" puts headings in serif via a rule in app/globals.css.
const BODY_FONT = { sans: "font-sans", serif: "font-serif", mixed: "font-sans", mono: "font-mono" };

export function ClassicTheme({ site }: Props) {
  const { design } = site;
  // Falls back to the home page if the address no longer exists, which can
  // happen in the editor preview after deleting or renaming a page.
  const target = resolvePath(site) ?? { page: design.pages[0] };
  const current = target.page ? target.page.slug : target.album.slug;
  const width = MARGINS[design.margins ?? "none"];

  return (
    <div
      style={themeStyle(design)}
      data-fonts={design.fonts}
      className={`flex-1 bg-[var(--bg)] text-[var(--fg)] ${BODY_FONT[design.fonts]}`}
    >
      <TopBar site={site} current={current} />
      {target.page ? (
        <PageBody site={site} page={target.page} width={width} />
      ) : (
        <div className={width}>
          <AlbumPage site={site} album={target.album} />
        </div>
      )}
      <footer className="px-6 py-10 text-center text-xs text-[var(--muted)] sm:px-10">
        {copyrightLine(site.profile)} · <ReportLink site={site} />
      </footer>
    </div>
  );
}

function hasVisible(page: SitePage, type: Section["type"]) {
  return page.sections.some((s) => s.type === type && s.visible);
}

type NavItem = { href: string; title: string; path?: string };

function TopBar({ site, current }: Props & { current: string }) {
  const { design, profile } = site;
  let items: NavItem[] = design.pages
    .filter((p) => p.showInNav)
    .map((p) => ({ href: siteHref(site, p.slug), title: p.title, path: p.slug }));
  if (design.nav.albums) {
    for (const a of visibleAlbums(design, site.albums)) {
      if (!items.some((i) => i.path === a.slug)) items.push({ href: siteHref(site, a.slug), title: a.title, path: a.slug });
    }
  }
  // The site name already links home, so a menu with nothing else in it
  // doesn't need a link to the home page.
  if (!items.some((i) => i.path)) items = [];
  // A site with no other pages in the menu gets a jump link to the home
  // page's About or Contact section.
  const home = design.pages[0];
  if (!design.pages.slice(1).some((p) => p.showInNav)) {
    const about = home.sections.find((s): s is AboutSection => s.type === "about" && s.visible);
    const anchor = about && aboutText(site, about) ? "about" : hasVisible(home, "contact") ? "contact" : null;
    if (anchor) items.push({ href: `${current ? siteHref(site) : ""}#${anchor}`, title: "About & contact" });
  }
  const showMenu = items.length > 0;

  return (
    <header className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3 px-6 py-6 sm:px-10">
      <Link href={siteHref(site)} className="text-lg font-semibold tracking-tight">{profile.name}</Link>
      {showMenu && (
        <nav aria-label="Site">
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {items.map((item) => {
              const active = item.path === current;
              return (
                <li key={item.href}>
                  <Link href={item.href} aria-current={active ? "page" : undefined} className={navClass(active)}>
                    {item.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </header>
  );
}

function navClass(active: boolean) {
  return active ? "text-[var(--fg)] underline underline-offset-4" : "text-[var(--muted)] hover:text-[var(--fg)]";
}

function PageBody({ site, page, width }: Props & { page: SitePage; width: string }) {
  const sections = page.sections.filter((s) => s.visible);
  // Pages other than home show their title, unless they open with a header.
  const showTitle = page.slug !== "" && sections[0]?.type !== "hero";
  return (
    <main>
      {showTitle && (
        <div className={`${width} px-6 pb-2 pt-8 sm:px-10`}>
          <h1 className="text-3xl tracking-tight sm:text-5xl">{page.title}</h1>
        </div>
      )}
      {/* Headers place themselves, as a header photo spans the whole window. */}
      {sections.map((s) =>
        s.type === "hero" ? (
          <Hero key={s.id} site={site} page={page} section={s} width={width} />
        ) : (
          <div key={s.id} className={width}>
            <PageSection section={s} page={page} site={site} />
          </div>
        ),
      )}
      {sections.length === 0 && <p className="py-20 text-center text-[var(--muted)]">This page is empty.</p>}
    </main>
  );
}

function SectionHeading({ children }: { children: ReactNode }) {
  return <h2 className="mb-6 text-sm uppercase tracking-widest text-[var(--muted)]">{children}</h2>;
}

function PageSection({ section, page, site }: Props & { section: Section; page: SitePage }) {
  const { design } = site;
  switch (section.type) {
    case "hero":
      return <Hero site={site} page={page} section={section} />;
    case "gallery":
      return (
        <section aria-label={section.title || "Photos"} className="px-2 py-6 sm:px-6">
          {section.title && <div className="px-4"><SectionHeading>{section.title}</SectionHeading></div>}
          <Gallery design={design} section={section} photos={galleryPhotos(section, site.photos, site.albums)} />
        </section>
      );
    case "albums":
      return <AlbumCards site={site} title={section.title || "Albums"} />;
    case "about": {
      const bio = aboutText(site, section);
      if (!bio) return null;
      return (
        <section id="about" className="mx-auto max-w-2xl px-6 py-16 text-center">
          <SectionHeading>{section.title || "About"}</SectionHeading>
          <p className="whitespace-pre-line text-lg leading-relaxed sm:text-xl">{bio}</p>
        </section>
      );
    }
    case "text":
      if (!section.title && !section.body) return null;
      return (
        <section className="mx-auto max-w-2xl px-6 py-12">
          {section.title && <h2 className="mb-4 text-2xl tracking-tight">{section.title}</h2>}
          {section.body && <p className="whitespace-pre-line leading-relaxed">{section.body}</p>}
        </section>
      );
    case "contact":
      return <ContactSection site={site} title={section.title || "Contact"} />;
  }
}

function Hero({ site, page, section, width = "" }: Props & { page: SitePage; section: HeroSection; width?: string }) {
  const { style, coverPhotoId } = section;
  const firstGallery = page.sections.find((s): s is GallerySection => s.type === "gallery" && s.visible);
  const cover =
    site.photos.find((p) => p.id === coverPhotoId) ??
    (firstGallery ? galleryPhotos(firstGallery, site.photos, site.albums)[0] : undefined) ??
    site.photos[0];
  const { heading, subheading } = heroText(site, page, section);

  if (style === "cover" && cover) {
    return (
      <section className="relative h-[80vh] min-h-96 w-full">
        <img src={cover.src} srcSet={cover.srcSet} sizes="100vw" alt={cover.alt} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent" />
        <div className="absolute bottom-0 left-0 p-8 text-white sm:p-14">
          <h1 className="text-5xl sm:text-7xl">{heading}</h1>
          {subheading && <p className="mt-3 text-sm uppercase tracking-[0.3em]">{subheading}</p>}
        </div>
      </section>
    );
  }
  return (
    <section className={`${width} px-6 pb-6 pt-10 sm:px-10 sm:pt-16`}>
      <h1 className="text-4xl tracking-tight sm:text-6xl">{heading}</h1>
      {subheading && <p className="mt-2 text-[var(--muted)]">{subheading}</p>}
    </section>
  );
}

function AlbumCards({ site, title }: Props & { title: string }) {
  const albums = visibleAlbums(site.design, site.albums);
  if (albums.length === 0) return null;
  const byId = new Map(site.photos.map((p) => [p.id, p]));
  return (
    <section aria-label={title} className="px-6 py-12 sm:px-10">
      <SectionHeading>{title}</SectionHeading>
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {albums.map((album) => {
          const cover = byId.get(album.coverPhotoId ?? "") ?? byId.get(album.photoIds[0]);
          return (
            <li key={album.id}>
              <Link href={siteHref(site, album.slug)} className="group block">
                {cover && (
                  <img
                    src={cover.src}
                    srcSet={cover.srcSet}
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    alt=""
                    loading="lazy"
                    className="aspect-[4/3] w-full object-cover transition group-hover:opacity-90"
                  />
                )}
                <h3 className="mt-3 text-lg font-medium">{album.title}</h3>
                {album.description && <p className="mt-1 text-sm text-[var(--muted)]">{album.description}</p>}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function AlbumPage({ site, album }: Props & { album: SiteAlbum }) {
  const byId = new Map(site.photos.map((p) => [p.id, p]));
  const photos = album.photoIds.flatMap((id) => byId.get(id) ?? []);
  return (
    <main>
      <section className="px-6 pb-6 pt-8 sm:px-10">
        <h1 className="text-3xl tracking-tight sm:text-5xl">{album.title}</h1>
        {album.description && <p className="mt-3 max-w-2xl whitespace-pre-line text-[var(--muted)]">{album.description}</p>}
      </section>
      <section aria-label="Photos" className="px-2 py-6 sm:px-6">
        <Gallery design={site.design} photos={photos} />
      </section>
    </main>
  );
}

function Gallery({ design, photos, section }: { design: SiteDesign; photos: PhotoSource[]; section?: GallerySection }) {
  if (photos.length === 0) return <p className="py-20 text-center text-[var(--muted)]">Photos coming soon.</p>;
  const { columns, spacing, cropping } = design.gallery;
  const layout = section && section.layout !== "default" ? section.layout : design.gallery.layout;

  let content: ReactNode;
  if (layout === "masonry") {
    content = (
      <div className={`columns-1 ${MASONRY_COLS[columns]} ${MASONRY_GAP[spacing]}`}>
        {photos.map((p, i) => (
          <Figure key={p.id} photo={p} index={i} design={design} sizes={SIZES[columns]} className="break-inside-avoid" />
        ))}
      </div>
    );
  } else if (layout === "column") {
    content = (
      <div className={`mx-auto flex max-w-4xl flex-col ${GAP[spacing]}`}>
        {photos.map((p, i) => (
          <Figure key={p.id} photo={p} index={i} design={design} sizes="(min-width: 896px) 896px, 100vw" />
        ))}
      </div>
    );
  } else if (layout === "editorial") {
    content = (
      <div className={`mx-auto flex max-w-5xl flex-col ${GAP[spacing]}`}>
        {photos.map((p, i) => (
          <Figure
            key={p.id}
            photo={p}
            index={i}
            design={design}
            sizes="(min-width: 1024px) 976px, 100vw"
            className={`${i % 3 === 0 ? "" : "sm:w-[70%]"} ${i % 3 === 2 ? "sm:ml-auto" : ""}`}
          />
        ))}
      </div>
    );
  } else {
    content = (
      <div className={`grid grid-cols-1 ${GRID_COLS[columns]} ${GAP[spacing]}`}>
        {photos.map((p, i) => (
          <Figure key={p.id} photo={p} index={i} design={design} sizes={SIZES[columns]} crop={CROP[cropping]} />
        ))}
      </div>
    );
  }
  const captions = Object.fromEntries(photos.map((p) => [p.id, captionText(p, design)]));
  return <Lightbox photos={photos} captions={captions}>{content}</Lightbox>;
}

// A photo that opens in the lightbox, with its caption if the design shows one.
function Figure({ photo, index, design, sizes, crop = "", className = "" }: {
  photo: PhotoSource;
  index: number;
  design: SiteDesign;
  sizes: string;
  crop?: string;
  className?: string;
}) {
  const caption = captionText(photo, design);
  return (
    <figure className={className}>
      <button
        type="button"
        data-photo-index={index}
        aria-label={photo.alt ? `View photo: ${photo.alt}` : `View photo ${index + 1}`}
        className={`block w-full cursor-zoom-in ${crop}`}
      >
        <img
          src={photo.src}
          srcSet={photo.srcSet}
          sizes={sizes}
          width={photo.width}
          height={photo.height}
          alt={photo.alt}
          loading={index < 3 ? "eager" : "lazy"}
          className="h-full w-full object-cover"
        />
      </button>
      {caption && <figcaption className="mt-2 px-1 text-sm text-[var(--muted)]">{caption}</figcaption>}
    </figure>
  );
}

function ContactSection({ site, title }: Props & { title: string }) {
  const { profile } = site;
  return (
    <section id="contact" className="mx-auto max-w-3xl px-6 py-16">
      <h2 className="mb-6 text-center text-sm uppercase tracking-widest text-[var(--muted)]">{title}</h2>
      <ContactDetails profile={profile} />
      <div className="mt-10 flex justify-center">
        <ContactForm subdomain={site.subdomain} preview={site.preview} />
      </div>
    </section>
  );
}

function socialLinks(profile: User["profile"]) {
  const s = profile.social;
  return [
    ["Instagram", s.instagram],
    ["X", s.twitter],
    ["Facebook", s.facebook],
    ["Website", s.website],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));
}

function ContactDetails({ profile }: { profile: User["profile"] }) {
  const links = socialLinks(profile);
  return (
    <div className="flex flex-col items-center text-center text-[var(--muted)]">
      <ul className="space-y-1">
        {profile.contactEmail && (
          <li><a href={`mailto:${profile.contactEmail}`} className="text-[var(--accent)] underline underline-offset-4">{profile.contactEmail}</a></li>
        )}
        {profile.phone && <li><a href={`tel:${profile.phone.replace(/\s/g, "")}`}>{profile.phone}</a></li>}
        {profile.location && <li>{profile.location}</li>}
      </ul>
      {links.length > 0 && (
        <ul className="mt-4 flex flex-wrap justify-center gap-4">
          {links.map(([label, href]) => (
            <li key={label}>
              <a href={href} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] underline underline-offset-4">{label}</a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
