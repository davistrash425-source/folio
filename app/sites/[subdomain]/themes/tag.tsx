/* eslint-disable @next/next/no-img-element -- user uploads are served by our own route */
// Tag: street and graffiti. Black pages, black-and-white photos that come
// back to color on hover, the name in huge outlined letters over a grainy
// cover, numbered frames and series, and small typewriter labels. One accent
// color, used sparingly: the outlined name and the current menu item.
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { galleryPhotos, visibleAlbums, type GallerySection, type HeroSection, type Section, type SitePage } from "@/lib/design";
import { contactHref, copyrightLine, siteHref } from "@/lib/site-data";
import { ContactForm } from "../contact-form";
import { Lightbox } from "../lightbox";
import { anton, spaceGrotesk, spaceMono } from "./fonts";
import { aboutText, captionText, currentPage, heroText, navItems, pad, pageGalleries, socialLinks, type GalleryBlock, visibleSections, type ThemeProps } from "./shared";
import { ReportLink } from "./report-link";

const META = "font-tag-mono text-[0.7rem] uppercase tracking-[0.12em] text-[var(--muted)]";
const DISPLAY = "font-tag-display font-normal uppercase";
// Outlined letters: the accent for the site name, light grey elsewhere.
const OUTLINE = "text-transparent [-webkit-text-stroke:2px_var(--accent)]";
const OUTLINE_LIGHT = "text-transparent [-webkit-text-stroke:1.5px_var(--fg)]";

export function TagTheme({ site }: ThemeProps) {
  const { profile } = site;
  const { accent, grain } = site.design.themeSettings.tag;
  const { page, current } = currentPage(site);
  const galleries = pageGalleries(site, page);
  const nav = navItems(site);
  const sections = visibleSections(page);
  // A page that opens with a header shows it first, with the menu bar
  // sticking underneath; any other page starts with the menu bar.
  const [first, ...rest] = sections;
  const opener = first?.type === "hero" ? first : null;
  const body = opener ? rest : sections;

  const vars = {
    "--bg": "#0b0b0b",
    "--fg": "#f2f2ee",
    "--muted": "#b8b8b2",
    "--rule": "#2a2a2a",
    "--accent": accent,
  } as CSSProperties;

  const block = (section: Section) => (
    <Block key={section.id} section={section} page={page} site={site} block={galleries.blocks.get(section.id)} total={galleries.all.length} grain={grain} />
  );

  return (
    <div style={vars} className={`${anton.variable} ${spaceGrotesk.variable} ${spaceMono.variable} font-tag-sans flex flex-1 flex-col bg-[var(--bg)] text-[var(--fg)]`}>
      <Lightbox photos={galleries.all} captions={galleries.captions} inquireHref={contactHref(site)}>
        {opener && block(opener)}
        <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-x-8 gap-y-2 border-b border-[var(--rule)] bg-[var(--bg)] px-5 py-4 md:px-10">
          <Link href={siteHref(site)} className={`${DISPLAY} text-2xl tracking-[0.04em]`}>{profile.name}</Link>
          {nav.length > 0 && (
            <nav aria-label="Site">
              <ul className="flex flex-wrap gap-x-7 gap-y-2 text-xs font-bold uppercase tracking-[0.18em]">
                {nav.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={item.path === current ? "page" : undefined}
                      className={item.path === current ? "border-b-2 border-[var(--accent)] pb-1 text-[var(--accent)]" : "hover:text-[var(--accent)]"}
                    >
                      {item.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </header>
        <main className="flex-1">
          {sections.length === 0 && <p className={`${META} px-5 py-24 text-center md:px-10`}>This page is empty.</p>}
          {body.map(block)}
        </main>
      </Lightbox>

      <footer className={`${META} flex flex-wrap justify-between gap-2 border-t border-[var(--rule)] px-5 py-6 md:px-10`}>
        <span>{copyrightLine(site.profile)}</span>
        <ReportLink site={site} />
      </footer>
    </div>
  );
}

function Block({ section, page, site, block, total, grain }: ThemeProps & {
  section: Section;
  page: SitePage;
  block?: GalleryBlock;
  total: number;
  grain: boolean;
}) {
  const { profile, design } = site;
  switch (section.type) {
    case "hero":
      return <Hero site={site} page={page} section={section} total={total} grain={grain} />;
    case "gallery":
      return (
        <section aria-label={section.title || "Photos"} className="pb-20 pt-3">
          {section.title && <h2 className={`${DISPLAY} px-5 pb-6 pt-10 text-5xl md:px-10 md:text-7xl`}>{section.title}</h2>}
          {block && block.photos.length > 0 ? (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {block.photos.map((photo, i) => {
                const caption = captionText(photo, design);
                return (
                  <li key={`${photo.id}-${i}`}>
                    <button
                      type="button"
                      data-photo-index={block.offset + i}
                      aria-label={photo.alt ? `View photo: ${photo.alt}` : `View photo ${i + 1}`}
                      className="group relative block aspect-[16/10] w-full cursor-zoom-in overflow-hidden bg-[#1a1a1a]"
                    >
                      <img
                        src={photo.src}
                        srcSet={photo.srcSet}
                        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                        width={photo.width}
                        height={photo.height}
                        alt={photo.alt}
                        loading={block.offset + i < 6 ? "eager" : "lazy"}
                        className="h-full w-full object-cover contrast-[1.1] grayscale transition duration-500 group-hover:scale-[1.04] group-hover:grayscale-0 group-focus-visible:grayscale-0"
                      />
                      <span className="font-tag-mono absolute left-3.5 top-3 text-[0.7rem] tracking-[0.1em] text-white mix-blend-difference">{pad(i + 1)}</span>
                      {caption && (
                        <span className="absolute inset-0 flex items-end bg-gradient-to-t from-black/85 via-transparent p-5 text-left opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                          <span className={`${DISPLAY} text-2xl leading-tight`}>{caption}</span>
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className={`${META} px-5 py-16 md:px-10`}>Photos coming soon.</p>
          )}
        </section>
      );
    case "albums": {
      const albums = visibleAlbums(design, site.albums);
      if (albums.length === 0) return null;
      const byId = new Map(site.photos.map((p) => [p.id, p]));
      return (
        <section aria-label={section.title || "Series"} className="px-5 pb-24 pt-10 md:px-10">
          <div className="mb-7 flex items-baseline justify-between gap-4">
            <h2 className={`${DISPLAY} text-6xl leading-none md:text-8xl`}>{section.title || "Series"}</h2>
            <span className={META}>{pad(albums.length)} series</span>
          </div>
          <ol className="border-t border-[#3a3a3a]">
            {albums.map((album, i) => {
              const cover = byId.get(album.coverPhotoId ?? "") ?? byId.get(album.photoIds[0]);
              return (
                <li key={album.id}>
                  <Link href={siteHref(site, album.slug)} className="group flex items-center gap-5 border-b border-[#3a3a3a] py-5 transition-[padding] md:gap-8 md:hover:pl-4">
                    <span aria-hidden="true" className={`${DISPLAY} ${OUTLINE_LIGHT} w-14 shrink-0 text-4xl leading-none md:w-28 md:text-7xl`}>{pad(i + 1)}</span>
                    <span className={`${DISPLAY} min-w-0 flex-1 break-words text-3xl leading-none md:text-6xl`}>{album.title}</span>
                    <span className={`${META} hidden sm:inline`}>{album.photoIds.length} photos</span>
                    {cover && (
                      <img
                        src={cover.src}
                        srcSet={cover.srcSet}
                        sizes="180px"
                        alt=""
                        loading="lazy"
                        className="hidden h-[110px] w-[180px] shrink-0 object-cover grayscale transition group-hover:grayscale-0 md:block"
                      />
                    )}
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>
      );
    }
    case "about": {
      const bio = aboutText(site, section);
      if (!bio) return null;
      return (
        <TextBlock title={section.title || "About"}>
          <p className="max-w-2xl whitespace-pre-line text-lg leading-relaxed text-[#d6d6d0] md:text-xl">{bio}</p>
          {profile.location && <p className={`${META} mt-6`}>Based in {profile.location}</p>}
        </TextBlock>
      );
    }
    case "text":
      if (!section.title && !section.body) return null;
      return (
        <TextBlock title={section.title}>
          <p className="max-w-2xl whitespace-pre-line text-lg leading-relaxed text-[#d6d6d0] md:text-xl">{section.body}</p>
        </TextBlock>
      );
    case "contact":
      return (
        // The form's button uses the accent; here it's white, so the
        // accent stays on the name and the menu.
        <section id="contact" style={{ "--accent": "#f2f2ee" } as CSSProperties} className="border-t border-[#3a3a3a] px-5 pb-28 pt-20 md:px-10">
          <h2 className={`${DISPLAY} ${OUTLINE_LIGHT} mb-10 break-words text-[clamp(3.5rem,11vw,10.5rem)] leading-[0.9]`}>{section.title || "Get in touch"}</h2>
          <ul className="mb-8 space-y-1 text-xl">
            {profile.contactEmail && <li><a href={`mailto:${profile.contactEmail}`} className="underline underline-offset-4">{profile.contactEmail}</a></li>}
            {profile.phone && <li><a href={`tel:${profile.phone.replace(/\s/g, "")}`}>{profile.phone}</a></li>}
            {profile.location && <li className="text-[var(--muted)]">{profile.location}</li>}
          </ul>
          {socialLinks(profile).length > 0 && (
            <ul className={`${META} mb-10 flex flex-wrap gap-x-6 gap-y-2`}>
              {socialLinks(profile).map(([label, href]) => (
                <li key={label}><a href={href} target="_blank" rel="noopener noreferrer" className="border-b border-current pb-0.5 hover:text-[var(--fg)]">{label}</a></li>
              ))}
            </ul>
          )}
          <ContactForm subdomain={site.subdomain} preview={site.preview} />
        </section>
      );
  }
}

function Hero({ site, page, section, total, grain }: ThemeProps & { page: SitePage; section: HeroSection; total: number; grain: boolean }) {
  const { heading, subheading } = heroText(site, page, section);
  const firstGallery = page.sections.find((s): s is GallerySection => s.type === "gallery" && s.visible);
  const cover =
    site.photos.find((p) => p.id === section.coverPhotoId) ??
    (firstGallery ? galleryPhotos(firstGallery, site.photos, site.albums)[0] : undefined) ??
    site.photos[0];

  if (section.style === "cover" && cover) {
    return (
      <section className="relative flex h-[88svh] min-h-[28rem] items-center justify-center overflow-hidden">
        <img src={cover.src} srcSet={cover.srcSet} sizes="100vw" alt={cover.alt} className="absolute inset-0 h-full w-full object-cover brightness-50 contrast-[1.2] grayscale" />
        {grain && (
          <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.18] mix-blend-overlay">
            <filter id="tag-grain">
              <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} stitchTiles="stitch" />
            </filter>
            <rect width="100%" height="100%" filter="url(#tag-grain)" />
          </svg>
        )}
        <span className={`${META} absolute left-5 top-6 hidden md:left-10 md:block`}>{site.profile.name}</span>
        {total > 0 && <span className={`${META} absolute right-5 top-6 hidden md:right-10 md:block`}>{pad(total)} photos</span>}
        {subheading && <span className={`${META} absolute bottom-6 left-5 md:left-10`}>{subheading}</span>}
        <span aria-hidden="true" className={`${META} absolute bottom-6 right-5 md:right-10`}>Scroll ↓</span>
        <h1 className={`${DISPLAY} ${OUTLINE} relative max-w-[90vw] break-words px-5 text-center text-[clamp(4.5rem,15vw,14rem)] leading-[0.86] tracking-[0.01em]`}>{heading}</h1>
      </section>
    );
  }
  return (
    <section className="px-5 pb-8 pt-16 md:px-10 md:pt-24">
      <h1 className={`${DISPLAY} ${OUTLINE} break-words text-[clamp(3.5rem,11vw,9rem)] leading-[0.88]`}>{heading}</h1>
      {subheading && <p className={`${META} mt-5`}>{subheading}</p>}
    </section>
  );
}

function TextBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="px-5 py-20 md:px-10">
      {title && <h2 className={`${DISPLAY} mb-7 break-words text-5xl leading-[0.95] md:text-7xl`}>{title}</h2>}
      {children}
    </section>
  );
}
