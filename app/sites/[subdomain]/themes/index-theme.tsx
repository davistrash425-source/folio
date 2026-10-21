/* eslint-disable @next/next/no-img-element -- user uploads are served by our own route */
// Index: a typeset list of the work, the way a book's index or a contact
// listing reads. Huge type, ruled lines, mono details. Hover a line to see
// the photo (tap on a phone, where each row carries a thumbnail), and click
// it to open it full screen.
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { visibleAlbums, type Section, type SitePage } from "@/lib/design";
import { copyrightLine, siteHref } from "@/lib/site-data";
import { readableOn, sortPhotos } from "@/lib/theme-utils";
import type { PhotoSource } from "@/lib/uploads";
import { ContactForm } from "../contact-form";
import { Lightbox } from "../lightbox";
import { archivo } from "./fonts";
import { HoverPreview } from "./hover-preview";
import {
  aboutText,
  currentPage,
  heroText,
  navItems,
  pad,
  pageGalleries,
  photoTitle,
  socialLinks,
  type GalleryBlock,
  visibleSections,
  type ThemeProps,
} from "./shared";
import { ReportLink } from "./report-link";

const MONO = "font-[family-name:var(--font-plex-mono)] text-xs uppercase tracking-[0.12em]";
const GUTTER = "px-6 md:px-10";
const ROW_GRID = "grid grid-cols-[2.25rem_1fr_3.5rem] items-baseline gap-x-4 md:grid-cols-[4rem_1fr_15rem_5rem]";

export function IndexTheme({ site }: ThemeProps) {
  const { design, profile } = site;
  const { accent, sort } = design.themeSettings.index;
  const { page, current } = currentPage(site);
  const galleries = pageGalleries(site, page, (photos) => sortPhotos(photos, sort));
  const nav = navItems(site);
  const sections = visibleSections(page);
  const total = page.slug === "" ? site.photos.length : galleries.all.length;

  const vars = {
    "--bg": "#ffffff",
    "--fg": "#0a0a0a",
    "--muted": "#6b6b6b",
    "--accent": accent,
    "--on-accent": readableOn(accent),
  } as CSSProperties;

  return (
    <div style={vars} className={`${archivo.variable} font-idx flex flex-1 flex-col bg-[var(--bg)] text-[var(--fg)]`}>
      <header className={`${GUTTER} ${MONO} flex flex-wrap items-center justify-between gap-x-8 gap-y-2 border-b border-[var(--fg)] py-3`}>
        <Link href={siteHref(site)} className="font-bold">{profile.name}</Link>
        {nav.length > 0 && (
          <nav aria-label="Site">
            <ul className="flex flex-wrap gap-x-6 gap-y-1">
              {nav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={item.path === current ? "page" : undefined}
                    className={
                      item.path === current
                        ? "bg-[var(--accent)] px-1.5 py-0.5 text-[var(--on-accent)]"
                        : "px-1.5 py-0.5 text-[var(--muted)] hover:text-[var(--fg)]"
                    }
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
        <HoverPreview>
          <main>
            {sections.length === 0 && <p className={`${GUTTER} ${MONO} py-20 text-[var(--muted)]`}>This page is empty.</p>}
            {sections.map((section) => (
              <Block key={section.id} section={section} page={page} site={site} block={galleries.blocks.get(section.id)} total={total} />
            ))}
          </main>
        </HoverPreview>
      </Lightbox>

      <footer className={`${GUTTER} ${MONO} mt-auto flex flex-wrap justify-between gap-2 border-t border-[var(--fg)] py-5 text-[var(--muted)]`}>
        <span>
          {copyrightLine(site.profile)} · <ReportLink site={site} />
        </span>
        <span>Index of {total} photographs</span>
      </footer>
    </div>
  );
}

function Block({ section, page, site, block, total }: ThemeProps & { section: Section; page: SitePage; block?: GalleryBlock; total: number }) {
  const { profile } = site;
  switch (section.type) {
    case "hero": {
      const { heading, subheading } = heroText(site, page, section);
      return (
        <section className={`${GUTTER} pb-10 pt-10 md:pb-14 md:pt-16`}>
          <h1 className="font-idx break-words text-[clamp(3.25rem,15vw,13rem)] font-extrabold uppercase leading-[0.84] tracking-[-0.045em]">
            {heading}
          </h1>
          <p className={`${MONO} mt-8 flex flex-wrap gap-x-10 gap-y-1 text-[var(--muted)]`}>
            <span>Index of {total} photographs</span>
            {subheading && <span>{subheading}</span>}
          </p>
        </section>
      );
    }
    case "gallery":
      return (
        <section aria-label={section.title || "Photos"}>
          {section.title && <h2 className={`${GUTTER} ${MONO} pb-3 pt-8`}>{section.title}</h2>}
          <ListHead columns={["№", "Title", "Location", "Added"]} />
          {block && block.photos.length > 0 ? (
            <ul>
              {block.photos.map((photo, i) => (
                <PhotoRow key={`${photo.id}-${i}`} photo={photo} index={block.offset + i} number={i + 1} />
              ))}
            </ul>
          ) : (
            <p className={`${GUTTER} ${MONO} border-t border-[var(--fg)] py-8 text-[var(--muted)]`}>Photos coming soon.</p>
          )}
          <div className="border-t border-[var(--fg)]" />
        </section>
      );
    case "albums": {
      const albums = visibleAlbums(site.design, site.albums);
      if (albums.length === 0) return null;
      const byId = new Map(site.photos.map((p) => [p.id, p]));
      return (
        <section aria-label={section.title || "Albums"} className="pt-10">
          <h2 className={`${GUTTER} ${MONO} pb-3`}>{section.title || "Albums"}</h2>
          <ListHead columns={["№", "Album", "Photographs", ""]} />
          <ul>
            {albums.map((album, i) => {
              const cover = byId.get(album.coverPhotoId ?? "") ?? byId.get(album.photoIds[0]);
              return (
                <li key={album.id} className="border-t border-[var(--fg)]">
                  <Link
                    href={siteHref(site, album.slug)}
                    data-preview-src={cover?.src}
                    data-preview-ratio={cover?.width && cover?.height ? cover.width / cover.height : undefined}
                    className={`${GUTTER} ${ROW_GRID} group py-3 hover:bg-[var(--accent)] hover:text-[var(--on-accent)] md:py-4`}
                  >
                    <span className={MONO}>{pad(i + 1)}</span>
                    <span className="min-w-0">
                      <span className="block text-2xl font-semibold leading-tight tracking-tight md:text-5xl">{album.title}</span>
                      {album.description && <span className="mt-1 block text-sm text-[var(--muted)] group-hover:text-inherit">{album.description}</span>}
                    </span>
                    <span className={`${MONO} text-right md:text-left`}>{album.photoIds.length}</span>
                    <span className={`${MONO} hidden text-right md:block`}>→</span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-[var(--fg)]" />
        </section>
      );
    }
    case "about": {
      const bio = aboutText(site, section);
      if (!bio) return null;
      return (
        <TextBlock title={section.title || "About"} big>
          {bio}
        </TextBlock>
      );
    }
    case "text":
      if (!section.title && !section.body) return null;
      return <TextBlock title={section.title}>{section.body}</TextBlock>;
    case "contact":
      return (
        <section id="contact" className={`${GUTTER} pb-16 pt-12`}>
          <h2 className={`${MONO} mb-6`}>{section.title || "Contact"}</h2>
          {profile.contactEmail && (
            <a
              href={`mailto:${profile.contactEmail}`}
              className="font-idx block break-all text-4xl font-extrabold leading-none tracking-[-0.03em] hover:text-[var(--accent)] md:text-8xl"
            >
              {profile.contactEmail}
            </a>
          )}
          <div className={`${MONO} mt-8 flex flex-wrap gap-x-10 gap-y-2`}>
            {profile.phone && <a href={`tel:${profile.phone.replace(/\s/g, "")}`}>{profile.phone}</a>}
            {profile.location && <span className="text-[var(--muted)]">{profile.location}</span>}
            {socialLinks(profile).map(([label, href]) => (
              <a key={label} href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-[var(--accent)]">
                {label} ↗
              </a>
            ))}
          </div>
          <div className="mt-12 max-w-xl">
            <ContactForm subdomain={site.subdomain} preview={site.preview} />
          </div>
        </section>
      );
  }
}

function TextBlock({ title, big, children }: { title: string; big?: boolean; children: ReactNode }) {
  return (
    <section className={`${GUTTER} grid gap-4 border-t border-[var(--fg)] py-12 md:grid-cols-[4rem_1fr] md:gap-x-4 md:py-20`}>
      <h2 className={MONO}>{title || "—"}</h2>
      <p
        className={`font-idx max-w-5xl whitespace-pre-line font-semibold tracking-tight ${
          big ? "text-3xl leading-[1.08] md:text-6xl" : "text-xl leading-snug md:text-3xl"
        }`}
      >
        {children}
      </p>
    </section>
  );
}

function ListHead({ columns }: { columns: string[] }) {
  return (
    <div className={`${GUTTER} ${ROW_GRID} ${MONO} hidden pb-2 text-[var(--muted)] md:grid`} aria-hidden="true">
      <span>{columns[0]}</span>
      <span>{columns[1]}</span>
      <span>{columns[2]}</span>
      <span className="text-right">{columns[3]}</span>
    </div>
  );
}

function PhotoRow({ photo, index, number }: { photo: PhotoSource; index: number; number: number }) {
  const year = new Date(photo.createdAt).getFullYear();
  const untitled = !photo.description;
  return (
    <li className="border-t border-[var(--fg)]">
      <button
        type="button"
        data-photo-index={index}
        data-preview-src={photo.src}
        data-preview-ratio={photo.width && photo.height ? photo.width / photo.height : undefined}
        aria-label={`Open photo ${number}: ${photoTitle(photo, index)}`}
        className={`${GUTTER} ${ROW_GRID} w-full cursor-zoom-in py-3 text-left hover:bg-[var(--accent)] hover:text-[var(--on-accent)] md:py-4`}
      >
        <span className={MONO}>{pad(number)}</span>
        <span className="min-w-0">
          <span className={`block text-2xl font-semibold leading-tight tracking-tight md:text-5xl ${untitled ? "opacity-40" : ""}`}>
            {photoTitle(photo, number - 1)}
          </span>
          <span className={`${MONO} mt-1 block text-[var(--muted)] md:hidden`}>{[photo.location, year].filter(Boolean).join(" · ")}</span>
        </span>
        <span className={`${MONO} hidden md:block`}>{photo.location}</span>
        <span className={`${MONO} hidden text-right md:block`}>{year}</span>
        {/* Phones can't hover, so each row carries a thumbnail. */}
        <img
          src={photo.src}
          srcSet={photo.srcSet}
          sizes="56px"
          alt=""
          loading="lazy"
          className="col-start-3 row-start-1 h-14 w-14 self-center justify-self-end object-cover md:hidden"
        />
      </button>
    </li>
  );
}
