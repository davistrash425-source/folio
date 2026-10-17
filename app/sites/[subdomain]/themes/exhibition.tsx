/* eslint-disable @next/next/no-img-element -- user uploads are served by our own route */
// Exhibition: the page is a gallery wall you walk along. Photos hang in one
// long row that scrolls sideways (up and down, one photo at a time, on
// phones), each as a matted print with a museum wall label. Text sections
// become wall text, albums become rooms.
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { showsCaption, visibleAlbums, type Section, type SitePage } from "@/lib/design";
import { siteHref, type SiteData } from "@/lib/site-data";
import type { PhotoSource } from "@/lib/uploads";
import { ContactForm } from "../contact-form";
import { Lightbox } from "../lightbox";
import { cormorant, jost } from "./fonts";
import { SidewaysScroller } from "./sideways-scroller";
import { currentPage, navItems, pad, pageGalleries, socialLinks, type GalleryBlock, visibleSections, type ThemeProps } from "./shared";

const WALLS = {
  charcoal: { bg: "#2a2926", fg: "#ece7dc", muted: "#a39d90", spot: "rgba(255,248,230,0.10)" },
  plaster: { bg: "#e8e3d7", fg: "#1d1b17", muted: "#6f695d", spot: "rgba(255,255,255,0.65)" },
  oxblood: { bg: "#3f1a1f", fg: "#f1e4da", muted: "#b99a92", spot: "rgba(255,225,205,0.10)" },
  forest: { bg: "#1d2c25", fg: "#e6ebdf", muted: "#98a894", spot: "rgba(235,255,225,0.09)" },
} as const;

// Every panel is the full height of the wall; on phones it is also full width.
const PANEL = "relative flex h-full w-full shrink-0 snap-center flex-col justify-center px-6 md:w-auto md:px-14";
const SMALL_CAPS = "font-exh-sans text-[0.68rem] uppercase tracking-[0.3em]";

export function ExhibitionTheme({ site }: ThemeProps) {
  const { design, profile } = site;
  const settings = design.themeSettings.exhibition;
  const wall = WALLS[settings.wall];
  const { page, current } = currentPage(site);
  const galleries = pageGalleries(site, page);
  const nav = navItems(site);
  const sections = visibleSections(page);

  const vars = {
    "--bg": wall.bg,
    "--fg": wall.fg,
    "--muted": wall.muted,
    "--accent": wall.fg,
    "--spot": wall.spot,
  } as CSSProperties;

  return (
    <div
      style={vars}
      className={`${cormorant.variable} ${jost.variable} font-exh-serif flex flex-1 flex-col bg-[var(--bg)] text-[var(--fg)]`}
    >
      <header className="flex min-h-[4.5rem] flex-wrap items-center justify-between gap-x-8 gap-y-2 px-6 py-3 md:px-10">
        <Link href={siteHref(site)} className={`${SMALL_CAPS} text-[var(--fg)]`}>{profile.name}</Link>
        {nav.length > 0 && (
          <nav aria-label="Site">
            <ul className={`${SMALL_CAPS} flex flex-wrap gap-x-6 gap-y-2`}>
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

      <Lightbox photos={galleries.all} captions={galleries.captions}>
        <SidewaysScroller label={page.title} footer={`© ${profile.name}`}>
          {sections.length === 0 && (
            <Panel>
              <p className="font-exh-serif text-2xl italic text-[var(--muted)]">This page is empty.</p>
            </Panel>
          )}
          {sections.map((section) => (
            <Section key={section.id} section={section} page={page} site={site} block={galleries.blocks.get(section.id)} />
          ))}
        </SidewaysScroller>
      </Lightbox>
    </div>
  );
}

function Panel({ children, className = "", spotlit = false }: { children: ReactNode; className?: string; spotlit?: boolean }) {
  return (
    <section
      className={`${PANEL} ${className}`}
      style={spotlit ? { backgroundImage: "radial-gradient(ellipse 70% 85% at 50% 0%, var(--spot), transparent 72%)" } : undefined}
    >
      {children}
    </section>
  );
}

function Section({ section, page, site, block }: ThemeProps & { section: Section; page: SitePage; block?: GalleryBlock }) {
  const { profile } = site;
  switch (section.type) {
    case "hero": {
      const isHome = page.slug === "";
      return (
        <Panel className="items-start md:w-[min(46rem,70vw)]">
          <p className={`${SMALL_CAPS} mb-6 text-[var(--muted)]`}>{isHome ? "Photographs by" : "Exhibition room"}</p>
          <h1 className="font-exh-serif text-6xl italic leading-[0.95] md:text-8xl">{isHome ? profile.name : page.title}</h1>
          {isHome && profile.location && <p className={`${SMALL_CAPS} mt-6 text-[var(--muted)]`}>{profile.location}</p>}
          <p className={`${SMALL_CAPS} mt-16 text-[var(--muted)]`}>
            Walk the wall <span className="hidden md:inline">→</span>
            <span className="md:hidden">↓</span>
          </p>
        </Panel>
      );
    }
    case "gallery":
      if (!block || block.photos.length === 0) {
        return (
          <Panel>
            <p className="font-exh-serif text-2xl italic text-[var(--muted)]">Photos coming soon.</p>
          </Panel>
        );
      }
      return (
        <>
          {section.title && (
            <Panel className="md:w-[22rem]">
              <h2 className="font-exh-serif text-4xl italic">{section.title}</h2>
            </Panel>
          )}
          {block.photos.map((photo, i) => (
            <Hanging key={`${photo.id}-${i}`} photo={photo} index={block.offset + i} number={i + 1} site={site} />
          ))}
        </>
      );
    case "albums": {
      const albums = visibleAlbums(site.design, site.albums);
      if (albums.length === 0) return null;
      return (
        <Panel className="md:w-[min(40rem,80vw)]">
          <h2 className={`${SMALL_CAPS} mb-8 text-[var(--muted)]`}>{section.title || "Rooms"}</h2>
          <ul className="space-y-5">
            {albums.map((album, i) => (
              <li key={album.id}>
                <Link href={siteHref(site, album.slug)} className="group block">
                  <span className={`${SMALL_CAPS} text-[var(--muted)]`}>Room {pad(i + 1)} · {album.photoIds.length} works</span>
                  <span className="mt-1 block font-exh-serif text-4xl italic underline-offset-8 group-hover:underline md:text-5xl">{album.title}</span>
                  {album.description && <span className="mt-1 block max-w-md text-[var(--muted)]">{album.description}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      );
    }
    case "about":
      if (!profile.bio) return null;
      return (
        <WallText title={section.title || "About"}>
          <p className="whitespace-pre-line font-exh-serif text-2xl leading-snug md:text-3xl">{profile.bio}</p>
        </WallText>
      );
    case "text":
      if (!section.title && !section.body) return null;
      return (
        <WallText title={section.title}>
          <p className="whitespace-pre-line font-exh-serif text-xl leading-relaxed md:text-2xl">{section.body}</p>
        </WallText>
      );
    case "contact":
      return (
        <Panel className="overflow-y-auto py-10 md:w-[min(36rem,85vw)]">
          <h2 className={`${SMALL_CAPS} mb-8 text-[var(--muted)]`}>{section.title || "Visitor information"}</h2>
          <ul className="mb-8 space-y-1 font-exh-serif text-2xl">
            {profile.contactEmail && (
              <li><a href={`mailto:${profile.contactEmail}`} className="underline underline-offset-4">{profile.contactEmail}</a></li>
            )}
            {profile.phone && <li><a href={`tel:${profile.phone.replace(/\s/g, "")}`}>{profile.phone}</a></li>}
            {profile.location && <li className="text-[var(--muted)]">{profile.location}</li>}
          </ul>
          {socialLinks(profile).length > 0 && (
            <ul className={`${SMALL_CAPS} mb-8 flex flex-wrap gap-5`}>
              {socialLinks(profile).map(([label, href]) => (
                <li key={label}><a href={href} target="_blank" rel="noopener noreferrer" className="border-b border-[var(--fg)]/40 pb-0.5">{label}</a></li>
              ))}
            </ul>
          )}
          <ContactForm subdomain={site.subdomain} preview={site.preview} />
        </Panel>
      );
  }
}

function WallText({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Panel className="overflow-y-auto py-10 md:w-[min(38rem,85vw)]">
      {title && <h2 className={`${SMALL_CAPS} mb-8 text-[var(--muted)]`}>{title}</h2>}
      {children}
    </Panel>
  );
}

// One photo hanging on the wall: a matted print under a spotlight, with its
// wall label below or beside it.
function Hanging({ photo, index, number, site }: { photo: PhotoSource; index: number; number: number; site: SiteData }) {
  const { design } = site;
  const beside = design.themeSettings.exhibition.labels === "beside";
  const caption = showsCaption(design, photo.id);
  const title = caption ? photo.description : "";
  const where = caption && design.captions.includeLocation ? photo.location : "";

  return (
    <section className={`${PANEL} items-center md:items-center`} style={{ backgroundImage: "radial-gradient(ellipse 70% 85% at 50% 0%, var(--spot), transparent 72%)" }}>
      <div className={`flex max-w-full flex-col gap-5 ${beside ? "md:flex-row md:items-end md:gap-8" : ""}`}>
        {/* Every print hangs from the same line, so the labels line up too. */}
        <div className="flex h-[min(56svh,36rem)] items-center justify-center md:h-[min(62svh,44rem)]">
        <button
          type="button"
          data-photo-index={index}
          aria-label={photo.alt ? `View photo: ${photo.alt}` : `View photo ${number}`}
          className="block max-w-full cursor-zoom-in bg-[#f6f2e8] p-3 shadow-[0_28px_60px_-24px_rgba(0,0,0,0.65)] md:p-4"
        >
          <img
            src={photo.src}
            srcSet={photo.srcSet}
            sizes="(min-width: 768px) 60vh, 90vw"
            width={photo.width}
            height={photo.height}
            alt={photo.alt}
            loading={index < 2 ? "eager" : "lazy"}
            className="h-auto max-h-[calc(min(56svh,36rem)-1.5rem)] w-auto max-w-full object-contain md:max-h-[calc(min(62svh,44rem)-2rem)]"
          />
        </button>
        </div>
        <div className={`${beside ? "md:w-44 md:shrink-0" : ""} font-exh-sans text-xs`}>
          <p className="tracking-[0.3em] text-[var(--muted)]">{pad(number)}</p>
          {title && <p className="mt-2 font-exh-serif text-xl italic leading-snug">{title}</p>}
          {where && <p className="mt-1 uppercase tracking-[0.2em] text-[var(--muted)]">{where}</p>}
        </div>
      </div>
    </section>
  );
}
