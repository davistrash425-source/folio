/* eslint-disable @next/next/no-img-element -- user uploads are served by our own route */
// Draws a photographer's site from its SiteDesign. Used for the live site
// (server) and the dashboard preview (client, with an unsaved design), so it
// must not use hooks or server-only code itself.
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import type { User } from "@/lib/db";
import { homepagePhotos, showsCaption, visibleAlbums, type SiteDesign } from "@/lib/design";
import { currentAlbum, siteHref, type SiteAlbum, type SiteData } from "@/lib/site-data";
import type { PhotoSource } from "@/lib/uploads";
import { ContactForm } from "./contact-form";
import { Lightbox } from "./lightbox";

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

// "mixed" puts headings in serif via a rule in app/globals.css.
const BODY_FONT = { sans: "font-sans", serif: "font-serif", mixed: "font-sans" };

export function SiteRenderer({ site }: Props) {
  const { design } = site;
  const album = currentAlbum(site);

  return (
    <div
      style={themeStyle(design)}
      data-fonts={design.fonts}
      className={`flex-1 bg-[var(--bg)] text-[var(--fg)] ${BODY_FONT[design.fonts]}`}
    >
      <TopBar site={site} />
      {album ? (
        <AlbumPage site={site} album={album} />
      ) : (
        design.sections
          .filter((s) => s.visible)
          .map((s) => <HomeSection key={s.type} type={s.type} site={site} />)
      )}
      <footer className="px-6 py-10 text-center text-xs text-[var(--muted)] sm:px-10">
        © {site.profile.name}
      </footer>
    </div>
  );
}

function TopBar({ site }: Props) {
  const { design, profile } = site;
  const albums = visibleAlbums(design, site.albums);
  const anchor = aboutAnchor(site);
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3 px-6 py-6 sm:px-10">
      <Link href={siteHref(site)} className="text-lg font-semibold tracking-tight">{profile.name}</Link>
      <nav aria-label="Site">
        <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {albums.length > 0 && (
            <li>
              <Link href={siteHref(site)} aria-current={!site.albumSlug ? "page" : undefined} className={navClass(!site.albumSlug)}>
                Work
              </Link>
            </li>
          )}
          {albums.map((a) => (
            <li key={a.id}>
              <Link href={siteHref(site, a.slug)} aria-current={site.albumSlug === a.slug ? "page" : undefined} className={navClass(site.albumSlug === a.slug)}>
                {a.title}
              </Link>
            </li>
          ))}
          {anchor && (
            <li><a href={`${site.albumSlug ? siteHref(site) : ""}#${anchor}`} className={navClass(false)}>About & contact</a></li>
          )}
        </ul>
      </nav>
    </header>
  );
}

// Where "About & contact" jumps to: the About section if it's showing, else Contact.
function aboutAnchor(site: SiteData) {
  const visible = (type: string) => site.design.sections.some((s) => s.type === type && s.visible);
  if (visible("about") && site.profile.bio) return "about";
  if (visible("contact")) return "contact";
  return null;
}

function navClass(active: boolean) {
  return active ? "text-[var(--fg)] underline underline-offset-4" : "text-[var(--muted)] hover:text-[var(--fg)]";
}

function HomeSection({ type, site }: Props & { type: SiteDesign["sections"][number]["type"] }) {
  const { design, profile } = site;
  switch (type) {
    case "hero":
      return <Hero site={site} />;
    case "gallery": {
      const photos = homepagePhotos(design, site.photos);
      return (
        <section aria-label="Photos" className="px-2 py-6 sm:px-6">
          <Gallery design={design} photos={photos} />
        </section>
      );
    }
    case "albums":
      return <AlbumCards site={site} />;
    case "about":
      if (!profile.bio) return null;
      return (
        <section id="about" className="mx-auto max-w-2xl px-6 py-16 text-center">
          <h2 className="mb-6 text-sm uppercase tracking-widest text-[var(--muted)]">About</h2>
          <p className="whitespace-pre-line text-lg leading-relaxed sm:text-xl">{profile.bio}</p>
        </section>
      );
    case "contact":
      return <ContactSection site={site} />;
  }
}

function Hero({ site }: Props) {
  const { design, profile } = site;
  const photos = homepagePhotos(design, site.photos);
  const cover = site.photos.find((p) => p.id === design.hero.coverPhotoId) ?? photos[0];

  if (design.hero.style === "cover" && cover) {
    return (
      <section className="relative h-[80vh] min-h-96 w-full">
        <img src={cover.src} srcSet={cover.srcSet} sizes="100vw" alt={cover.alt} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent" />
        <div className="absolute bottom-0 left-0 p-8 text-white sm:p-14">
          <h1 className="text-5xl sm:text-7xl">{profile.name}</h1>
          {profile.location && <p className="mt-3 text-sm uppercase tracking-[0.3em]">{profile.location}</p>}
        </div>
      </section>
    );
  }
  return (
    <section className="px-6 pb-6 pt-10 sm:px-10 sm:pt-16">
      <h1 className="text-4xl tracking-tight sm:text-6xl">{profile.name}</h1>
      {profile.location && <p className="mt-2 text-[var(--muted)]">{profile.location}</p>}
    </section>
  );
}

function AlbumCards({ site }: Props) {
  const albums = visibleAlbums(site.design, site.albums);
  if (albums.length === 0) return null;
  const byId = new Map(site.photos.map((p) => [p.id, p]));
  return (
    <section aria-label="Albums" className="px-6 py-12 sm:px-10">
      <h2 className="mb-6 text-sm uppercase tracking-widest text-[var(--muted)]">Albums</h2>
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
  const contactVisible = site.design.sections.some((s) => s.type === "contact" && s.visible);
  return (
    <>
      <section className="px-6 pb-6 pt-8 sm:px-10">
        <h1 className="text-3xl tracking-tight sm:text-5xl">{album.title}</h1>
        {album.description && <p className="mt-3 max-w-2xl whitespace-pre-line text-[var(--muted)]">{album.description}</p>}
      </section>
      <section aria-label="Photos" className="px-2 py-6 sm:px-6">
        <Gallery design={site.design} photos={photos} />
      </section>
      {contactVisible && <ContactSection site={site} />}
    </>
  );
}

function Gallery({ design, photos }: { design: SiteDesign; photos: PhotoSource[] }) {
  if (photos.length === 0) return <p className="py-20 text-center text-[var(--muted)]">Photos coming soon.</p>;
  const { layout, columns, spacing, cropping } = design.gallery;

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

export function captionText(photo: PhotoSource, design: SiteDesign) {
  if (!showsCaption(design, photo.id)) return "";
  const parts = [photo.description, design.captions.includeLocation ? photo.location : ""].filter(Boolean);
  return parts.join(" · ");
}

function ContactSection({ site }: Props) {
  const { profile } = site;
  return (
    <section id="contact" className="mx-auto max-w-3xl px-6 py-16">
      <h2 className="mb-6 text-center text-sm uppercase tracking-widest text-[var(--muted)]">Contact</h2>
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
