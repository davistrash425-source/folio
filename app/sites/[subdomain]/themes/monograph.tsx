/* eslint-disable @next/next/no-img-element -- user uploads are served by our own route */
// Monograph: the site as a photo book. Each photo gets a page to itself with
// wide margins, a small caption and a page number; text becomes the book's
// own typeset pages and albums are its chapters.
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { visibleAlbums, type Section, type SitePage } from "@/lib/design";
import { contactHref, copyrightLine, siteHref } from "@/lib/site-data";
import { ContactForm } from "../contact-form";
import { Lightbox } from "../lightbox";
import { cormorant, jost } from "./fonts";
import { aboutText, captionText, currentPage, heroText, navItems, pad, pageGalleries, socialLinks, type GalleryBlock, visibleSections, type ThemeProps } from "./shared";
import { ReportLink } from "./report-link";

const PAPERS = {
  white: { bg: "#ffffff", fg: "#161616", muted: "#7a7a7a", rule: "#d8d8d8" },
  cream: { bg: "#f3ede0", fg: "#2a2418", muted: "#8a8068", rule: "#d9d0bb" },
  black: { bg: "#0d0d0d", fg: "#ececec", muted: "#8c8c8c", rule: "#2b2b2b" },
} as const;

const SMALL = "font-exh-sans text-[0.68rem] uppercase tracking-[0.28em]";

export function MonographTheme({ site }: ThemeProps) {
  const { profile } = site;
  const { paper, pageNumbers } = site.design.themeSettings.monograph;
  const colors = PAPERS[paper];
  const { page, current } = currentPage(site);
  const galleries = pageGalleries(site, page);
  const nav = navItems(site);
  const sections = visibleSections(page);

  const vars = {
    "--bg": colors.bg,
    "--fg": colors.fg,
    "--muted": colors.muted,
    "--rule": colors.rule,
    "--accent": colors.fg,
  } as CSSProperties;

  return (
    <div style={vars} className={`${cormorant.variable} ${jost.variable} font-exh-serif flex flex-1 flex-col bg-[var(--bg)] text-[var(--fg)]`}>
      <header className="flex flex-wrap items-center justify-between gap-x-8 gap-y-2 px-6 py-5 md:px-12">
        <Link href={siteHref(site)} className="font-exh-serif text-2xl italic">{profile.name}</Link>
        {nav.length > 0 && (
          <nav aria-label="Site">
            <ul className={`${SMALL} flex flex-wrap gap-x-6 gap-y-2`}>
              {nav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={item.path === current ? "page" : undefined}
                    className={item.path === current ? "border-b border-[var(--fg)] pb-1" : "text-[var(--muted)] hover:text-[var(--fg)]"}
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
          {sections.length === 0 && <p className="px-6 py-24 text-center text-2xl italic text-[var(--muted)]">This page is empty.</p>}
          {sections.map((section) => (
            <Pages key={section.id} section={section} page={page} site={site} block={galleries.blocks.get(section.id)} total={galleries.all.length} pageNumbers={pageNumbers} />
          ))}
        </main>
      </Lightbox>

      <footer className={`${SMALL} flex flex-wrap justify-between gap-2 border-t border-[var(--rule)] px-6 py-5 text-[var(--muted)] md:px-12`}>
        <span>
          {copyrightLine(site.profile)} · <ReportLink site={site} />
        </span>
      </footer>
    </div>
  );
}

function Pages({ section, page, site, block, total, pageNumbers }: ThemeProps & {
  section: Section;
  page: SitePage;
  block?: GalleryBlock;
  total: number;
  pageNumbers: boolean;
}) {
  const { profile, design } = site;
  switch (section.type) {
    case "hero": {
      const { heading, subheading } = heroText(site, page, section);
      return (
        <section className="flex min-h-[70svh] flex-col items-center justify-center px-6 py-20 text-center">
          <p className={`${SMALL} mb-8 text-[var(--muted)]`}>{page.slug === "" ? "A book of photographs" : "Chapter"}</p>
          <h1 className="max-w-4xl break-words text-6xl italic leading-[0.95] md:text-8xl">{heading}</h1>
          {subheading && <p className={`${SMALL} mt-8 text-[var(--muted)]`}>{subheading}</p>}
        </section>
      );
    }
    case "gallery":
      if (!block || block.photos.length === 0) {
        return <p className="px-6 py-24 text-center text-2xl italic text-[var(--muted)]">Photos coming soon.</p>;
      }
      return (
        <>
          {section.title && <h2 className="px-6 pt-16 text-center text-4xl italic">{section.title}</h2>}
          {block.photos.map((photo, i) => {
            const caption = captionText(photo, design);
            return (
              <figure key={`${photo.id}-${i}`} className="flex min-h-[90svh] flex-col items-center justify-center px-6 py-12 md:px-24">
                <button
                  type="button"
                  data-photo-index={block.offset + i}
                  aria-label={photo.alt ? `View photo: ${photo.alt}` : `View page ${i + 1}`}
                  className="block max-w-full cursor-zoom-in"
                >
                  <img
                    src={photo.src}
                    srcSet={photo.srcSet}
                    sizes="(min-width: 768px) 70vw, 100vw"
                    width={photo.width}
                    height={photo.height}
                    alt={photo.alt}
                    loading={block.offset + i < 2 ? "eager" : "lazy"}
                    className="h-auto max-h-[78svh] w-auto max-w-full object-contain"
                  />
                </button>
                <figcaption className="mt-5 flex w-full max-w-3xl items-baseline justify-between gap-6 text-sm">
                  <span className="text-lg italic text-[var(--muted)]">{caption}</span>
                  {pageNumbers && <span className={`${SMALL} shrink-0 text-[var(--muted)]`}>{pad(block.offset + i + 1)} / {pad(total)}</span>}
                </figcaption>
              </figure>
            );
          })}
        </>
      );
    case "albums": {
      const albums = visibleAlbums(design, site.albums);
      if (albums.length === 0) return null;
      return (
        <section aria-label={section.title || "Chapters"} className="mx-auto max-w-3xl px-6 py-20">
          <h2 className={`${SMALL} mb-10 text-center text-[var(--muted)]`}>{section.title || "Chapters"}</h2>
          <ol className="space-y-6">
            {albums.map((album, i) => (
              <li key={album.id}>
                <Link href={siteHref(site, album.slug)} className="group flex items-baseline gap-5 border-b border-[var(--rule)] pb-4">
                  <span className={`${SMALL} w-8 text-[var(--muted)]`}>{pad(i + 1)}</span>
                  <span className="flex-1 text-3xl italic group-hover:underline md:text-4xl">{album.title}</span>
                  <span className={`${SMALL} text-[var(--muted)]`}>{album.photoIds.length}</span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      );
    }
    case "about": {
      const bio = aboutText(site, section);
      if (!bio) return null;
      return <TextPage title={section.title || "About"} big>{bio}</TextPage>;
    }
    case "text":
      if (!section.title && !section.body) return null;
      return <TextPage title={section.title}>{section.body}</TextPage>;
    case "contact":
      return (
        <section id="contact" className="mx-auto max-w-2xl px-6 py-20">
          <h2 className={`${SMALL} mb-8 text-[var(--muted)]`}>{section.title || "Contact"}</h2>
          <ul className="mb-8 space-y-1 text-2xl">
            {profile.contactEmail && <li><a href={`mailto:${profile.contactEmail}`} className="underline underline-offset-4">{profile.contactEmail}</a></li>}
            {profile.phone && <li><a href={`tel:${profile.phone.replace(/\s/g, "")}`}>{profile.phone}</a></li>}
            {profile.location && <li className="text-[var(--muted)]">{profile.location}</li>}
          </ul>
          {socialLinks(profile).length > 0 && (
            <ul className={`${SMALL} mb-8 flex flex-wrap gap-5`}>
              {socialLinks(profile).map(([label, href]) => (
                <li key={label}><a href={href} target="_blank" rel="noopener noreferrer" className="border-b border-[var(--fg)]/40 pb-0.5">{label}</a></li>
              ))}
            </ul>
          )}
          <ContactForm subdomain={site.subdomain} preview={site.preview} />
        </section>
      );
  }
}

function TextPage({ title, big, children }: { title: string; big?: boolean; children: ReactNode }) {
  return (
    <section className="mx-auto max-w-2xl px-6 py-20 md:py-28">
      {title && <h2 className={`${SMALL} mb-8 text-[var(--muted)]`}>{title}</h2>}
      <p className={`whitespace-pre-line leading-snug ${big ? "text-3xl md:text-4xl" : "text-2xl"}`}>{children}</p>
    </section>
  );
}
