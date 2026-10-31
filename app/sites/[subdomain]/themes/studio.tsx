/* eslint-disable @next/next/no-img-element -- user uploads are served by our own route */
// Studio: for commercial work. A warm off-white page with a bold headline
// beside a large lead photo, a "Book a shoot" button in the top bar, albums
// as project cards, text sections laid out as numbered service columns, and
// a dark contact panel. One accent color for buttons and small marks.
import Link from "next/link";
import type { CSSProperties } from "react";
import { galleryPhotos, visibleAlbums, type GallerySection, type HeroSection, type Section, type SitePage } from "@/lib/design";
import { contactHref, copyrightLine, siteHref } from "@/lib/site-data";
import { ContactForm } from "../contact-form";
import { Lightbox } from "../lightbox";
import { instrumentSans, instrumentSerif } from "./fonts";
import { aboutText, captionText, currentPage, heroText, navItems, pad, pageGalleries, socialLinks, type GalleryBlock, visibleSections, type ThemeProps } from "./shared";
import { ReportLink } from "./report-link";

const LABEL = "text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]";
const PILL = "inline-block rounded-full px-6 py-3.5 text-sm font-semibold";

export function StudioTheme({ site }: ThemeProps) {
  const { profile } = site;
  const { accent } = site.design.themeSettings.studio;
  const { page, current } = currentPage(site);
  const galleries = pageGalleries(site, page);
  const nav = navItems(site);
  const sections = visibleSections(page);
  const inquire = contactHref(site);
  // "See the work" jumps to the first gallery or album list.
  const workId = sections.find((s) => s.type === "gallery" || s.type === "albums")?.id;

  const vars = {
    "--bg": "#f6f5f2",
    "--fg": "#141414",
    "--muted": "#5f5b55",
    "--rule": "#dad7d0",
    "--accent": accent,
  } as CSSProperties;

  return (
    <div style={vars} className={`${instrumentSans.variable} ${instrumentSerif.variable} font-studio-sans flex flex-1 flex-col bg-[var(--bg)] text-[var(--fg)]`}>
      <header className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3 border-b border-[var(--rule)] px-4 py-4 md:px-14 md:py-6">
        <Link href={siteHref(site)} className="flex items-center gap-2.5 text-lg font-bold tracking-tight md:text-xl">
          <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-full bg-[var(--accent)]" />
          {profile.name}
        </Link>
        {nav.length > 0 && (
          <nav aria-label="Site" className="order-last w-full md:order-none md:w-auto">
            <ul className="flex flex-wrap gap-x-8 gap-y-2 text-[0.95rem] font-medium">
              {nav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={item.path === current ? "page" : undefined}
                    className={item.path === current ? "border-b-2 border-[var(--fg)] pb-0.5" : "text-[var(--muted)] hover:text-[var(--fg)]"}
                  >
                    {item.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
        {inquire && (
          <Link href={inquire} className={`${PILL} bg-[var(--fg)] text-[var(--bg)] hover:opacity-90`}>
            Book a shoot
          </Link>
        )}
      </header>

      <Lightbox photos={galleries.all} captions={galleries.captions} inquireHref={inquire}>
        <main className="flex-1">
          {sections.length === 0 && <p className="px-4 py-24 text-center text-[var(--muted)] md:px-14">This page is empty.</p>}
          {sections.map((section) => (
            <Block key={section.id} section={section} page={page} site={site} block={galleries.blocks.get(section.id)} inquire={inquire} isWork={section.id === workId} />
          ))}
        </main>
      </Lightbox>

      <footer className="flex flex-wrap justify-between gap-2 px-4 pb-9 pt-7 text-sm text-[var(--muted)] md:px-14">
        <span>{copyrightLine(site.profile)}</span>
        <ReportLink site={site} />
      </footer>
    </div>
  );
}

function Block({ section, page, site, block, inquire, isWork }: ThemeProps & {
  section: Section;
  page: SitePage;
  block?: GalleryBlock;
  inquire: string | null;
  isWork: boolean;
}) {
  const { profile, design } = site;
  switch (section.type) {
    case "hero":
      return <Hero site={site} page={page} section={section} inquire={inquire} />;
    case "gallery":
      return (
        <section id={isWork ? "work" : undefined} aria-label={section.title || "Photos"} className="px-4 pb-16 pt-4 md:px-14 md:pb-28">
          {section.title && <Heading>{section.title}</Heading>}
          {block && block.photos.length > 0 ? (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {block.photos.map((photo, i) => {
                const caption = captionText(photo, design);
                return (
                  <li key={`${photo.id}-${i}`}>
                    <button
                      type="button"
                      data-photo-index={block.offset + i}
                      aria-label={photo.alt ? `View photo: ${photo.alt}` : `View photo ${i + 1}`}
                      className="group block w-full cursor-zoom-in overflow-hidden rounded-md bg-[#e8e6e1]"
                    >
                      <img
                        src={photo.src}
                        srcSet={photo.srcSet}
                        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                        width={photo.width}
                        height={photo.height}
                        alt={photo.alt}
                        loading={block.offset + i < 6 ? "eager" : "lazy"}
                        className="aspect-[3/2] w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                      />
                    </button>
                    {caption && <p className="mt-2.5 text-sm text-[var(--muted)]">{caption}</p>}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="py-16 text-[var(--muted)]">Photos coming soon.</p>
          )}
        </section>
      );
    case "albums": {
      const albums = visibleAlbums(design, site.albums);
      if (albums.length === 0) return null;
      const byId = new Map(site.photos.map((p) => [p.id, p]));
      return (
        <section id={isWork ? "work" : undefined} aria-label={section.title || "Selected work"} className="px-4 pb-20 md:px-14 md:pb-32">
          <Heading>{section.title || "Selected work"}</Heading>
          <ul className="grid gap-x-8 gap-y-12 md:grid-cols-2 md:gap-y-14">
            {albums.map((album) => {
              const cover = byId.get(album.coverPhotoId ?? "") ?? byId.get(album.photoIds[0]);
              return (
                <li key={album.id}>
                  <Link href={siteHref(site, album.slug)} className="group flex flex-col gap-4">
                    <span className="block aspect-[4/3] overflow-hidden rounded-md bg-[#e8e6e1]">
                      {cover && (
                        <img
                          src={cover.src}
                          srcSet={cover.srcSet}
                          sizes="(min-width: 768px) 50vw, 100vw"
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                        />
                      )}
                    </span>
                    <span className="flex items-baseline justify-between gap-4">
                      <span className="min-w-0">
                        <span className="block text-xl font-semibold tracking-tight md:text-2xl">{album.title}</span>
                        <span className="mt-1 block text-[0.95rem] text-[var(--muted)]">
                          {album.description || `${album.photoIds.length} photos`}
                        </span>
                      </span>
                      <span aria-hidden="true" className="text-2xl transition-transform group-hover:translate-x-1.5">→</span>
                    </span>
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
        <section className="px-4 py-16 md:px-14 md:py-28">
          <p className={`${LABEL} mb-5`}>{section.title || "About"}</p>
          <p className="max-w-3xl whitespace-pre-line text-xl leading-relaxed md:text-2xl">{bio}</p>
          {profile.location && (
            <div className="mt-8">
              <p className={`${LABEL} mb-1.5`}>Based in</p>
              <p className="font-semibold">{profile.location}</p>
            </div>
          )}
        </section>
      );
    }
    case "text":
      if (!section.title && !section.body) return null;
      return <Services title={section.title} body={section.body} />;
    case "contact":
      return (
        // The dark panel flips the page's colors, so the shared form reads
        // light on dark with an accent button.
        <section
          id="contact"
          style={{ "--bg": "#141414", "--fg": "#f6f5f2", "--muted": "#c9c6bf" } as CSSProperties}
          className="mx-3 mb-6 rounded-xl bg-[var(--bg)] px-5 py-14 text-[var(--fg)] md:mx-6 md:px-14 md:py-24"
        >
          <div className="flex flex-col gap-10 lg:flex-row lg:gap-16">
            <div className="min-w-0 flex-1">
              <h2 className="break-words text-4xl font-semibold leading-none tracking-[-0.035em] md:text-6xl">
                {section.title || (
                  <>
                    Have a project? <span className="font-studio-serif font-normal italic text-[var(--accent)]">Let&rsquo;s talk.</span>
                  </>
                )}
              </h2>
              <ul className="mt-6 space-y-1 text-lg text-[var(--muted)]">
                {profile.contactEmail && <li><a href={`mailto:${profile.contactEmail}`} className="text-[var(--fg)] underline underline-offset-4">{profile.contactEmail}</a></li>}
                {profile.phone && <li><a href={`tel:${profile.phone.replace(/\s/g, "")}`}>{profile.phone}</a></li>}
                {profile.location && <li>{profile.location}</li>}
              </ul>
              {socialLinks(profile).length > 0 && (
                <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-1 text-sm font-semibold">
                  {socialLinks(profile).map(([label, href]) => (
                    <li key={label}><a href={href} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--accent)]">{label}</a></li>
                  ))}
                </ul>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <ContactForm subdomain={site.subdomain} preview={site.preview} />
            </div>
          </div>
        </section>
      );
  }
}

function Hero({ site, page, section, inquire }: ThemeProps & { page: SitePage; section: HeroSection; inquire: string | null }) {
  const { heading, subheading } = heroText(site, page, section);
  const firstGallery = page.sections.find((s): s is GallerySection => s.type === "gallery" && s.visible);
  const cover =
    site.photos.find((p) => p.id === section.coverPhotoId) ??
    (firstGallery ? galleryPhotos(firstGallery, site.photos, site.albums)[0] : undefined) ??
    site.photos[0];
  const hasWork = page.sections.some((s) => (s.type === "gallery" || s.type === "albums") && s.visible);

  const text = (
    <div className="flex flex-col gap-7">
      {subheading && <p className={LABEL}>{subheading}</p>}
      <h1 className="break-words text-5xl font-semibold leading-[0.98] tracking-[-0.035em] md:text-7xl xl:text-8xl">{heading}</h1>
      {(hasWork || inquire) && (
        <div className="flex flex-wrap gap-3">
          {hasWork && <a href="#work" className={`${PILL} bg-[var(--accent)] text-[#141414] hover:opacity-90`}>See the work ↓</a>}
          {inquire && <Link href={inquire} className={`${PILL} border border-[var(--fg)] hover:bg-[var(--fg)] hover:text-[var(--bg)]`}>Get in touch</Link>}
        </div>
      )}
    </div>
  );

  if (section.style === "cover" && cover) {
    return (
      <section className="flex flex-col gap-10 px-4 pb-10 pt-10 md:px-14 md:pt-16 lg:flex-row lg:items-stretch lg:gap-14">
        <div className="flex min-w-0 flex-1 flex-col justify-center">{text}</div>
        <div className="min-w-0 overflow-hidden rounded-md lg:flex-[1.35]">
          <img src={cover.src} srcSet={cover.srcSet} sizes="(min-width: 1024px) 57vw, 100vw" alt={cover.alt} className="aspect-[4/5] h-full w-full object-cover sm:aspect-[3/2] lg:aspect-auto lg:max-h-[42rem] lg:min-h-[32rem]" />
        </div>
      </section>
    );
  }
  return <section className="px-4 pb-12 pt-12 md:px-14 md:pt-20">{text}</section>;
}

// A text section. Several paragraphs become numbered columns: each
// paragraph's first line is its heading, the rest its description.
function Services({ title, body }: { title: string; body: string }) {
  const parts = body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return (
    <section className="bg-[#ebe9e4] px-4 py-16 md:px-14 md:py-28">
      {title && <p className={`${LABEL} mb-6`}>{title}</p>}
      {parts.length > 1 ? (
        <ol className="grid gap-12 md:grid-cols-2 lg:grid-cols-3">
          {parts.map((part, i) => {
            const [head, ...rest] = part.split("\n");
            return (
              <li key={i} className="border-t-2 border-[var(--fg)] pt-6">
                <p aria-hidden="true" className="font-studio-serif mb-4 text-4xl leading-none">{pad(i + 1)}</p>
                <h3 className="mb-3 text-2xl font-semibold">{head}</h3>
                {rest.length > 0 && <p className="whitespace-pre-line leading-relaxed text-[#3a3833]">{rest.join("\n")}</p>}
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="max-w-3xl whitespace-pre-line text-xl leading-relaxed">{body}</p>
      )}
    </section>
  );
}

function Heading({ children }: { children: string }) {
  return (
    <h2 className="mb-10 border-b border-[var(--rule)] pb-6 text-4xl font-semibold leading-none tracking-[-0.03em] md:text-5xl">{children}</h2>
  );
}
