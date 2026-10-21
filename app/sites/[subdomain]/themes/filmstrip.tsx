/* eslint-disable @next/next/no-img-element -- user uploads are served by our own route */
// Film strip: the work laid out on a light table as real strips of film, with
// sprocket holes, edge printing, frame numbers and a paper note for text.
// The strip's film stock sets the base color and the color of the edge print.
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { visibleAlbums, type Section, type SitePage } from "@/lib/design";
import { copyrightLine, siteHref, type SiteData } from "@/lib/site-data";
import type { PhotoSource } from "@/lib/uploads";
import { ContactForm } from "../contact-form";
import { Lightbox } from "../lightbox";
import { bebas, shareTech, specialElite } from "./fonts";
import { aboutText, captionText, currentPage, heroText, navItems, pad, pageGalleries, socialLinks, type GalleryBlock, visibleSections, type ThemeProps } from "./shared";
import { ReportLink } from "./report-link";

const STOCKS = {
  gold: { name: "FOLIO GOLD 400", table: "#14100c", base: "#2b1c0e", edge: "#f0a63a", text: "#f2e6d4", muted: "#a08a6e" },
  mono: { name: "FOLIO PAN 100", table: "#111111", base: "#1d1d1d", edge: "#d9d9d9", text: "#ededed", muted: "#8a8a8a" },
  slide: { name: "FOLIO CHROME 64", table: "#08100c", base: "#0f1712", edge: "#7fe3a1", text: "#e3efe7", muted: "#7c9686" },
} as const;

const FRAMES_PER_STRIP = 4;
const EDGE = "font-film-edge text-[0.65rem] uppercase tracking-[0.25em] md:text-[0.7rem]";

// The paper note's own colors; the contact form inside reads these too.
const NOTE_VARS = { "--fg": "#26221b", "--bg": "#efe7d3", "--muted": "#6b6354", "--accent": "#b3362b" } as CSSProperties;

function chunk<T>(list: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

export function FilmstripTheme({ site }: ThemeProps) {
  const { design, profile } = site;
  const { stock: stockId, frameNumbers } = design.themeSettings.filmstrip;
  const stock = STOCKS[stockId];
  const { page, current } = currentPage(site);
  const galleries = pageGalleries(site, page);
  const nav = navItems(site);
  const sections = visibleSections(page);

  const vars = {
    "--bg": stock.table,
    "--base": stock.base,
    "--edge": stock.edge,
    "--hole": stock.table,
    "--fg": stock.text,
    "--muted": stock.muted,
    "--accent": stock.edge,
  } as CSSProperties;

  return (
    <div
      style={vars}
      className={`${bebas.variable} ${shareTech.variable} ${specialElite.variable} flex flex-1 flex-col bg-[var(--bg)] font-sans text-[var(--fg)]`}
    >
      {/* One shared sprocket hole, drawn by every strip. */}
      <svg width="0" height="0" className="absolute" aria-hidden="true" focusable="false">
        <defs>
          <pattern id="folio-sprocket" width="30" height="24" patternUnits="userSpaceOnUse">
            <rect x="8" y="6" width="14" height="12" rx="3" style={{ fill: "var(--hole)" }} />
          </pattern>
        </defs>
      </svg>

      <header className="flex flex-wrap items-center justify-between gap-x-8 gap-y-2 border-b border-white/10 px-6 py-4 md:px-10">
        <Link href={siteHref(site)} className="font-film-title text-3xl uppercase tracking-[0.08em]">{profile.name}</Link>
        {nav.length > 0 && (
          <nav aria-label="Site">
            <ul className={`${EDGE} flex flex-wrap gap-x-6 gap-y-1`}>
              {nav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={item.path === current ? "page" : undefined}
                    className={item.path === current ? "border-b border-[var(--edge)] pb-1 text-[var(--edge)]" : "text-[var(--muted)] hover:text-[var(--fg)]"}
                  >
                    {item.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </header>

      <Lightbox photos={galleries.all} captions={galleries.captions}>
        <main className="mx-auto w-full max-w-6xl px-4 pb-10 md:px-6">
          {sections.length === 0 && <p className={`${EDGE} py-20 text-center text-[var(--muted)]`}>This page is empty.</p>}
          {sections.map((section) => (
            <Block
              key={section.id}
              section={section}
              page={page}
              site={site}
              block={galleries.blocks.get(section.id)}
              total={galleries.all.length}
              stock={stock.name}
              frameNumbers={frameNumbers}
            />
          ))}
        </main>
      </Lightbox>

      <footer className={`${EDGE} mt-auto flex flex-wrap justify-between gap-2 border-t border-white/10 px-6 py-5 text-[var(--muted)] md:px-10`}>
        <span>
          {copyrightLine(site.profile)} · <ReportLink site={site} />
        </span>
        <span className="text-[var(--edge)]">{stock.name} ▶ end of roll</span>
      </footer>
    </div>
  );
}

function Block({ section, page, site, block, total, stock, frameNumbers }: ThemeProps & {
  section: Section;
  page: SitePage;
  block?: GalleryBlock;
  total: number;
  stock: string;
  frameNumbers: boolean;
}) {
  const { profile } = site;
  switch (section.type) {
    case "hero": {
      const { heading, subheading } = heroText(site, page, section);
      return (
        <section className="px-2 pb-6 pt-12 text-center md:pt-20">
          <p className={`${EDGE} text-[var(--edge)]`}>▶ Roll 01 · {total || site.photos.length} exposures</p>
          <h1 className="font-film-title mt-4 break-words text-[clamp(4rem,15vw,11rem)] uppercase leading-[0.9] tracking-[0.04em]">
            {heading}
          </h1>
          {subheading && <p className={`${EDGE} mt-4 text-[var(--muted)]`}>{subheading}</p>}
        </section>
      );
    }
    case "gallery":
      return (
        <section aria-label={section.title || "Photos"} className="py-4">
          {section.title && <h2 className="font-film-title mt-6 text-center text-4xl uppercase tracking-[0.1em]">{section.title}</h2>}
          {block && block.photos.length > 0 ? (
            chunk(block.photos, FRAMES_PER_STRIP).map((frames, strip) => (
              <Strip
                key={strip}
                frames={frames}
                firstNumber={strip * FRAMES_PER_STRIP}
                offset={block.offset + strip * FRAMES_PER_STRIP}
                roll={strip + 1}
                stock={stock}
                site={site}
                frameNumbers={frameNumbers}
              />
            ))
          ) : (
            <p className={`${EDGE} py-16 text-center text-[var(--muted)]`}>Photos coming soon.</p>
          )}
        </section>
      );
    case "albums": {
      const albums = visibleAlbums(site.design, site.albums);
      if (albums.length === 0) return null;
      const byId = new Map(site.photos.map((p) => [p.id, p]));
      return (
        <section aria-label={section.title || "Rolls"} className="py-10">
          <h2 className="font-film-title mb-6 text-center text-4xl uppercase tracking-[0.1em]">{section.title || "Rolls"}</h2>
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {albums.map((album, i) => {
              const shots = album.photoIds.slice(0, 3).flatMap((id) => byId.get(id) ?? []);
              return (
                <li key={album.id}>
                  <Link href={siteHref(site, album.slug)} className="group block bg-[var(--base)] p-3 shadow-[0_14px_30px_-18px_rgba(0,0,0,0.9)]">
                    <div className="flex gap-1.5 overflow-hidden bg-black p-1">
                      {shots.map((p) => (
                        <img key={p.id} src={p.src} srcSet={p.srcSet} sizes="120px" alt="" loading="lazy" className="h-24 w-0 flex-1 object-cover" />
                      ))}
                    </div>
                    <p className={`${EDGE} mt-3 flex justify-between text-[var(--edge)]`}>
                      <span>Roll {pad(i + 1)}</span>
                      <span>{album.photoIds.length} exp.</span>
                    </p>
                    <p className="font-film-title mt-1 text-3xl uppercase tracking-[0.06em] group-hover:text-[var(--edge)]">{album.title}</p>
                    {album.description && <p className="mt-1 text-sm text-[var(--muted)]">{album.description}</p>}
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
      return (
        <Note title={section.title || "About"}>
          <p className="whitespace-pre-line text-lg leading-relaxed">{bio}</p>
        </Note>
      );
    }
    case "text":
      if (!section.title && !section.body) return null;
      return (
        <Note title={section.title}>
          <p className="whitespace-pre-line text-lg leading-relaxed">{section.body}</p>
        </Note>
      );
    case "contact":
      return (
        <Note title={section.title || "Contact"} id="contact">
          <ul className="mb-6 space-y-1 text-lg">
            {profile.contactEmail && (
              <li><a href={`mailto:${profile.contactEmail}`} className="underline underline-offset-4">{profile.contactEmail}</a></li>
            )}
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
          <ContactForm subdomain={site.subdomain} preview={site.preview} />
        </Note>
      );
  }
}

// A taped paper note, for anything that is just words.
function Note({ title, children, id }: { title: string; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="mx-auto max-w-2xl px-2 py-12">
      <div
        style={NOTE_VARS}
        className="font-film-note relative rotate-[-0.6deg] bg-[#efe7d3] p-7 text-[#26221b] shadow-[0_18px_40px_-20px_rgba(0,0,0,0.9)] md:p-9"
      >
        <span aria-hidden="true" className="absolute -top-3 left-1/2 h-6 w-28 -translate-x-1/2 rotate-2 bg-[#d9cfa8]/80" />
        {title && <h2 className={`${EDGE} mb-5 text-[#6b6354]`}>{title}</h2>}
        {children}
      </div>
    </section>
  );
}

function Sprockets() {
  return (
    <svg aria-hidden="true" focusable="false" className="block h-6 w-full">
      <rect width="100%" height="100%" fill="url(#folio-sprocket)" />
    </svg>
  );
}

// One strip of film: sprocket holes, edge printing, then the frames.
function Strip({ frames, firstNumber, offset, roll, stock, site, frameNumbers }: {
  frames: PhotoSource[];
  firstNumber: number;
  offset: number;
  roll: number;
  stock: string;
  site: SiteData;
  frameNumbers: boolean;
}) {
  const { design } = site;
  return (
    <div className="relative my-9 bg-[var(--base)] shadow-[0_22px_44px_-22px_rgba(0,0,0,0.95)]">
      <Sprockets />
      <p className={`${EDGE} flex justify-between px-4 pb-1 pt-0.5 text-[var(--edge)]`}>
        <span>{stock} · roll {pad(roll)}</span>
        <span className="hidden sm:inline">Safety film ▶</span>
      </p>
      <div className="flex snap-x gap-3 overflow-x-auto px-4 pb-2 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {frames.map((photo, i) => {
          const n = firstNumber + i + 1;
          const caption = captionText(photo, design);
          return (
            <figure key={`${photo.id}-${i}`} className="flex-none snap-start">
              <button
                type="button"
                data-photo-index={offset + i}
                aria-label={photo.alt ? `View photo: ${photo.alt}` : `View frame ${n}`}
                className="block cursor-zoom-in bg-black p-1 outline-offset-2 transition hover:outline hover:outline-1 hover:outline-[var(--edge)]"
              >
                <img
                  src={photo.src}
                  srcSet={photo.srcSet}
                  sizes="(min-width: 768px) 380px, 70vw"
                  width={photo.width ?? 3}
                  height={photo.height ?? 2}
                  alt={photo.alt}
                  loading={offset + i < 4 ? "eager" : "lazy"}
                  className="h-44 w-auto max-w-[78vw] object-cover md:h-60 md:max-w-none"
                />
              </button>
              {frameNumbers && (
                <p className={`${EDGE} mt-1 flex justify-between text-[var(--edge)]`}>
                  <span>▶ {pad(n)}</span>
                  <span>{pad(n)}A</span>
                </p>
              )}
              {caption && <figcaption className="font-film-edge mt-1 max-w-0 min-w-full text-[0.7rem] leading-snug text-[var(--muted)]">{caption}</figcaption>}
            </figure>
          );
        })}
      </div>
      <Sprockets />
    </div>
  );
}
