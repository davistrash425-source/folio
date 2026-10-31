/* eslint-disable @next/next/no-img-element -- user uploads are served by our own route */
// Mosaic: a white page, the name as a narrow monospace wordmark, and the work
// as one edge-to-edge wall of tiles with no gaps. Albums are project tiles
// whose title shows on hover (always shown on small screens, which have no
// hover). Everything else stays quiet.
import Link from "next/link";
import type { CSSProperties } from "react";
import { visibleAlbums, type Section, type SitePage } from "@/lib/design";
import { contactHref, copyrightLine, siteHref } from "@/lib/site-data";
import { ContactForm } from "../contact-form";
import { Lightbox } from "../lightbox";
import { jost, martianMono } from "./fonts";
import { aboutText, captionText, currentPage, heroText, navItems, pageGalleries, socialLinks, type GalleryBlock, visibleSections, type ThemeProps } from "./shared";
import { ReportLink } from "./report-link";

// Tiles per row on large screens; phones always show two.
const COLUMNS = {
  3: "md:grid-cols-3",
  4: "md:grid-cols-4",
  5: "md:grid-cols-5",
} as const;

const MARK = "font-mosaic-mark font-semibold uppercase [font-stretch:75%]";
// The title over a tile: always on phones, on hover from md up.
const TILE_LABEL =
  "absolute inset-0 flex items-end bg-black/0 p-2.5 text-left text-[0.7rem] font-medium uppercase leading-tight tracking-[0.04em] text-white [text-shadow:0_1px_6px_rgba(0,0,0,0.6)] md:items-start md:bg-black/45 md:p-6 md:text-xl md:opacity-0 md:[text-shadow:none] md:transition-opacity md:group-hover:opacity-100 md:group-focus-visible:opacity-100";

export function MosaicTheme({ site }: ThemeProps) {
  const { profile } = site;
  const { columns } = site.design.themeSettings.mosaic;
  const { page, current } = currentPage(site);
  const galleries = pageGalleries(site, page);
  const nav = navItems(site);
  const sections = visibleSections(page);
  // The home page's opening header is the wordmark itself: its words go in
  // the site header rather than in a block of their own.
  const opener = page.slug === "" && sections[0]?.type === "hero" ? sections[0] : null;
  const tagline = opener ? heroText(site, page, opener).subheading : profile.location;
  const body = opener ? sections.slice(1) : sections;

  const vars = {
    "--bg": "#ffffff",
    "--fg": "#111111",
    "--muted": "#555555",
    "--accent": "#111111",
  } as CSSProperties;

  return (
    <div style={vars} className={`${martianMono.variable} ${jost.variable} font-exh-sans flex flex-1 flex-col bg-[var(--bg)] text-[var(--fg)]`}>
      <header className="flex flex-col gap-5 px-4 pb-5 pt-6 md:flex-row md:items-center md:justify-between md:px-9 md:pb-7 md:pt-10">
        <Link href={siteHref(site)} className="flex flex-col gap-1">
          <span className={`${MARK} break-words text-2xl leading-none md:text-[2.1rem]`}>{opener ? heroText(site, page, opener).heading : profile.name}</span>
          {tagline && <span className="text-xs uppercase tracking-[0.03em] text-[#333] md:text-base">{tagline}</span>}
        </Link>
        {nav.length > 0 && (
          <nav aria-label="Site">
            <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium uppercase tracking-[0.04em]">
              {nav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={item.path === current ? "page" : undefined}
                    className={item.path === current ? "border-b-[1.5px] border-[var(--fg)] pb-0.5" : "hover:text-[var(--muted)]"}
                  >
                    {item.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </header>

      <Lightbox photos={galleries.all} captions={galleries.captions} inquireHref={contactHref(site)}>
        <main className="flex-1">
          {sections.length === 0 && <p className="px-4 py-24 text-center text-[var(--muted)] md:px-9">This page is empty.</p>}
          {body.map((section) => (
            <Block key={section.id} section={section} page={page} site={site} block={galleries.blocks.get(section.id)} columns={COLUMNS[columns]} />
          ))}
        </main>
      </Lightbox>

      <footer className="px-4 pb-11 pt-8 text-center text-sm uppercase tracking-[0.06em] text-[var(--muted)] md:px-9">
        {copyrightLine(site.profile)} · <ReportLink site={site} />
      </footer>
    </div>
  );
}

function Block({ section, page, site, block, columns }: ThemeProps & {
  section: Section;
  page: SitePage;
  block?: GalleryBlock;
  columns: string;
}) {
  const { profile, design } = site;
  switch (section.type) {
    case "hero": {
      const { heading, subheading } = heroText(site, page, section);
      return (
        <section className="px-4 pb-8 pt-6 md:px-9 md:pb-10 md:pt-8">
          <h1 className={`${MARK} break-words text-3xl leading-none md:text-5xl`}>{heading}</h1>
          {subheading && <p className="mt-2 text-sm uppercase tracking-[0.03em] text-[var(--muted)] md:text-base">{subheading}</p>}
        </section>
      );
    }
    case "gallery":
      return (
        <section aria-label={section.title || "Photos"}>
          {section.title && <h2 className={`${MARK} px-4 pb-4 pt-10 text-xl md:px-9`}>{section.title}</h2>}
          {block && block.photos.length > 0 ? (
            <ul className={`grid grid-cols-2 ${columns}`}>
              {block.photos.map((photo, i) => {
                const caption = captionText(photo, design);
                return (
                  <li key={`${photo.id}-${i}`}>
                    <button
                      type="button"
                      data-photo-index={block.offset + i}
                      aria-label={photo.alt ? `View photo: ${photo.alt}` : `View photo ${i + 1}`}
                      className="group relative block aspect-[3/2] w-full cursor-zoom-in overflow-hidden bg-[#eee]"
                    >
                      <img
                        src={photo.src}
                        srcSet={photo.srcSet}
                        sizes="(min-width: 768px) 25vw, 50vw"
                        width={photo.width}
                        height={photo.height}
                        alt={photo.alt}
                        loading={block.offset + i < 8 ? "eager" : "lazy"}
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                      />
                      {caption && <span className={TILE_LABEL}>{caption}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-4 py-16 text-[var(--muted)] md:px-9">Photos coming soon.</p>
          )}
        </section>
      );
    case "albums": {
      const albums = visibleAlbums(design, site.albums);
      if (albums.length === 0) return null;
      const byId = new Map(site.photos.map((p) => [p.id, p]));
      return (
        <section aria-label={section.title || "Projects"}>
          {section.title && <h2 className={`${MARK} px-4 pb-4 pt-10 text-xl md:px-9`}>{section.title}</h2>}
          <ul className={`grid grid-cols-2 ${columns}`}>
            {albums.map((album) => {
              const cover = byId.get(album.coverPhotoId ?? "") ?? byId.get(album.photoIds[0]);
              return (
                <li key={album.id}>
                  <Link href={siteHref(site, album.slug)} className="group relative block aspect-[3/2] overflow-hidden bg-[#eee]">
                    {cover && (
                      <img
                        src={cover.src}
                        srcSet={cover.srcSet}
                        sizes="(min-width: 768px) 25vw, 50vw"
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                      />
                    )}
                    <span className={cover ? TILE_LABEL : "absolute inset-0 flex items-center justify-center p-4 text-center text-sm font-medium uppercase md:text-xl"}>{album.title}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      );
    }
    case "about": {
      const bio = aboutText(site, section);
      if (!bio) return null;
      return <TextRow title={section.title || "About"} body={bio} />;
    }
    case "text":
      if (!section.title && !section.body) return null;
      return <TextRow title={section.title} body={section.body} />;
    case "contact":
      return (
        <section id="contact" className="mx-auto w-full max-w-[74rem] px-4 py-16 md:px-9 md:py-20">
          <h2 className={`${MARK} mb-4 text-lg md:text-[1.4rem]`}>{section.title || "Contact"}</h2>
          <ul className="mb-6 space-y-1 text-base md:text-lg">
            {profile.contactEmail && <li><a href={`mailto:${profile.contactEmail}`} className="border-b border-[var(--fg)]">{profile.contactEmail}</a></li>}
            {profile.phone && <li><a href={`tel:${profile.phone.replace(/\s/g, "")}`}>{profile.phone}</a></li>}
            {profile.location && <li className="text-[#333]">{profile.location}</li>}
          </ul>
          {socialLinks(profile).length > 0 && (
            <ul className="mb-8 flex flex-wrap gap-x-5 gap-y-1 text-sm font-medium uppercase tracking-[0.04em]">
              {socialLinks(profile).map(([label, href]) => (
                <li key={label}><a href={href} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--muted)]">{label}</a></li>
              ))}
            </ul>
          )}
          <ContactForm subdomain={site.subdomain} preview={site.preview} />
        </section>
      );
  }
}

function TextRow({ title, body }: { title: string; body: string }) {
  return (
    <section className="mx-auto w-full max-w-[74rem] px-4 pb-6 pt-16 md:px-9 md:pt-20">
      {title && <h2 className={`${MARK} mb-4 text-lg md:text-[1.4rem]`}>{title}</h2>}
      <p className="max-w-3xl whitespace-pre-line text-base leading-relaxed text-[#333] md:text-lg">{body}</p>
    </section>
  );
}
