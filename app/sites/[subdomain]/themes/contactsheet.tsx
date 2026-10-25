/* eslint-disable @next/next/no-img-element -- user uploads are served by our own route */
// Contact sheet: the work as a photographer's proof sheet. Rows of small
// numbered frames on a sheet of paper, mono edge print, and a click to open
// any frame full screen. Text sections become typed notes on the sheet.
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { visibleAlbums, type Section, type SitePage } from "@/lib/design";
import { contactHref, copyrightLine, siteHref } from "@/lib/site-data";
import { ContactForm } from "../contact-form";
import { Lightbox } from "../lightbox";
import { archivo, shareTech } from "./fonts";
import { aboutText, captionText, currentPage, heroText, navItems, pad, pageGalleries, socialLinks, type GalleryBlock, visibleSections, type ThemeProps } from "./shared";
import { ReportLink } from "./report-link";

const PAPERS = {
  light: { table: "#d9d5cb", sheet: "#f4f2ec", fg: "#17140f", muted: "#6a655a", frame: "#0c0c0c", rule: "#17140f" },
  dark: { table: "#0b0b0b", sheet: "#1a1a19", fg: "#ece8dd", muted: "#948f82", frame: "#000000", rule: "#ece8dd" },
} as const;

// Frames per row on large screens; phones always show three.
const COLUMNS = {
  4: "md:grid-cols-4",
  6: "md:grid-cols-6",
  8: "md:grid-cols-8",
} as const;

const EDGE = "font-film-edge text-[0.65rem] uppercase tracking-[0.18em] md:text-xs";

export function ContactsheetTheme({ site }: ThemeProps) {
  const { profile } = site;
  const { paper, columns } = site.design.themeSettings.contactsheet;
  const colors = PAPERS[paper];
  const { page, current } = currentPage(site);
  const galleries = pageGalleries(site, page);
  const nav = navItems(site);
  const sections = visibleSections(page);

  const vars = {
    "--bg": colors.table,
    "--sheet": colors.sheet,
    "--fg": colors.fg,
    "--muted": colors.muted,
    "--frame": colors.frame,
    "--rule": colors.rule,
    "--accent": "#d63a2f", // grease pencil
  } as CSSProperties;

  return (
    <div style={vars} className={`${archivo.variable} ${shareTech.variable} font-idx flex flex-1 flex-col bg-[var(--bg)] p-3 text-[var(--fg)] md:p-8`}>
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col bg-[var(--sheet)] shadow-[0_20px_50px_-25px_rgba(0,0,0,0.6)]">
        <header className={`${EDGE} flex flex-wrap items-center justify-between gap-x-8 gap-y-2 border-b border-[var(--rule)] px-5 py-3 md:px-8`}>
          <Link href={siteHref(site)} className="font-bold">{profile.name}</Link>
          {nav.length > 0 && (
            <nav aria-label="Site">
              <ul className="flex flex-wrap gap-x-5 gap-y-1">
                {nav.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={item.path === current ? "page" : undefined}
                      className={item.path === current ? "border-b border-[var(--accent)] pb-0.5" : "text-[var(--muted)] hover:text-[var(--fg)]"}
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
          <main className="flex-1 px-5 pb-8 md:px-8">
            {sections.length === 0 && <p className={`${EDGE} py-20 text-[var(--muted)]`}>This page is empty.</p>}
            {sections.map((section) => (
              <Block key={section.id} section={section} page={page} site={site} block={galleries.blocks.get(section.id)} total={galleries.all.length} columns={COLUMNS[columns]} />
            ))}
          </main>
        </Lightbox>

        <footer className={`${EDGE} flex flex-wrap justify-between gap-2 border-t border-[var(--rule)] px-5 py-4 text-[var(--muted)] md:px-8`}>
          <span>
            {copyrightLine(site.profile)} · <ReportLink site={site} />
          </span>
          <span>Sheet 1 · {galleries.all.length} frames</span>
        </footer>
      </div>
    </div>
  );
}

function Block({ section, page, site, block, total, columns }: ThemeProps & {
  section: Section;
  page: SitePage;
  block?: GalleryBlock;
  total: number;
  columns: string;
}) {
  const { profile, design } = site;
  switch (section.type) {
    case "hero": {
      const { heading, subheading } = heroText(site, page, section);
      return (
        <section className="pb-6 pt-8 md:pb-10 md:pt-12">
          <p className={`${EDGE} text-[var(--accent)]`}>Proof sheet · {total || site.photos.length} exposures</p>
          <h1 className="font-idx mt-3 break-words text-[clamp(2.5rem,9vw,7rem)] font-extrabold uppercase leading-[0.9] tracking-[-0.03em]">{heading}</h1>
          {subheading && <p className={`${EDGE} mt-3 text-[var(--muted)]`}>{subheading}</p>}
        </section>
      );
    }
    case "gallery":
      return (
        <section aria-label={section.title || "Photos"} className="py-4">
          {section.title && <h2 className={`${EDGE} mb-3 border-b border-[var(--rule)] pb-1`}>{section.title}</h2>}
          {block && block.photos.length > 0 ? (
            <ul className={`grid grid-cols-3 gap-x-2 gap-y-4 md:gap-x-3 md:gap-y-6 ${columns}`}>
              {block.photos.map((photo, i) => {
                const caption = captionText(photo, design);
                return (
                  <li key={`${photo.id}-${i}`}>
                    <button
                      type="button"
                      data-photo-index={block.offset + i}
                      aria-label={photo.alt ? `View photo: ${photo.alt}` : `View frame ${i + 1}`}
                      className="block w-full cursor-zoom-in bg-[var(--frame)] p-1 outline-offset-2 hover:outline hover:outline-2 hover:outline-[var(--accent)]"
                    >
                      <img
                        src={photo.src}
                        srcSet={photo.srcSet}
                        sizes="(min-width: 768px) 16vw, 30vw"
                        width={photo.width ?? 3}
                        height={photo.height ?? 2}
                        alt={photo.alt}
                        loading={block.offset + i < 12 ? "eager" : "lazy"}
                        className="aspect-[3/2] w-full object-cover"
                      />
                    </button>
                    <p className={`${EDGE} mt-1 flex justify-between text-[var(--muted)]`}>
                      <span>{pad(i + 1)}</span>
                      <span>{pad(i + 1)}A</span>
                    </p>
                    {caption && <p className="mt-0.5 text-xs leading-snug text-[var(--muted)]">{caption}</p>}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className={`${EDGE} py-12 text-[var(--muted)]`}>Photos coming soon.</p>
          )}
        </section>
      );
    case "albums": {
      const albums = visibleAlbums(design, site.albums);
      if (albums.length === 0) return null;
      return (
        <section aria-label={section.title || "Sheets"} className="py-8">
          <h2 className={`${EDGE} mb-3 border-b border-[var(--rule)] pb-1`}>{section.title || "Sheets"}</h2>
          <ul className="grid gap-x-8 sm:grid-cols-2">
            {albums.map((album, i) => (
              <li key={album.id} className="border-b border-[var(--rule)]/30">
                <Link href={siteHref(site, album.slug)} className="group flex items-baseline justify-between gap-4 py-3">
                  <span className="font-idx text-2xl font-bold tracking-tight group-hover:text-[var(--accent)]">{album.title}</span>
                  <span className={`${EDGE} text-[var(--muted)]`}>Sheet {pad(i + 2)} · {album.photoIds.length}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      );
    }
    case "about": {
      const bio = aboutText(site, section);
      if (!bio) return null;
      return <Note title={section.title || "About"}>{bio}</Note>;
    }
    case "text":
      if (!section.title && !section.body) return null;
      return <Note title={section.title}>{section.body}</Note>;
    case "contact":
      return (
        <section id="contact" className="py-8">
          <h2 className={`${EDGE} mb-3 border-b border-[var(--rule)] pb-1`}>{section.title || "Contact"}</h2>
          <ul className="mb-6 space-y-1 text-lg">
            {profile.contactEmail && <li><a href={`mailto:${profile.contactEmail}`} className="underline underline-offset-4">{profile.contactEmail}</a></li>}
            {profile.phone && <li><a href={`tel:${profile.phone.replace(/\s/g, "")}`}>{profile.phone}</a></li>}
            {profile.location && <li className="text-[var(--muted)]">{profile.location}</li>}
          </ul>
          {socialLinks(profile).length > 0 && (
            <ul className={`${EDGE} mb-6 flex flex-wrap gap-x-5 gap-y-1`}>
              {socialLinks(profile).map(([label, href]) => (
                <li key={label}><a href={href} target="_blank" rel="noopener noreferrer" className="border-b border-current">{label}</a></li>
              ))}
            </ul>
          )}
          <div className="max-w-xl">
            <ContactForm subdomain={site.subdomain} preview={site.preview} />
          </div>
        </section>
      );
  }
}

function Note({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="py-8">
      {title && <h2 className={`${EDGE} mb-3 border-b border-[var(--rule)] pb-1`}>{title}</h2>}
      <p className="font-film-edge max-w-2xl whitespace-pre-line text-sm leading-relaxed md:text-base">{children}</p>
    </section>
  );
}
