/* eslint-disable @next/next/no-img-element -- user uploads are served by our own route */
import Link from "next/link";
import type { User } from "@/lib/db";
import { siteHref, type SiteData } from "@/lib/public-site";
import type { PhotoSource } from "@/lib/uploads";
import { ContactForm } from "./contact-form";
import { Lightbox } from "./lightbox";

export type { SiteData };

type Props = { site: SiteData };

function socialLinks(profile: User["profile"]) {
  const s = profile.social;
  return [
    ["Instagram", s.instagram],
    ["X", s.twitter],
    ["Facebook", s.facebook],
    ["Website", s.website],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));
}

function Contact({ profile, className }: { profile: User["profile"]; className?: string }) {
  const links = socialLinks(profile);
  return (
    <div className={className}>
      <ul className="space-y-1">
        {profile.contactEmail && (
          <li><a href={`mailto:${profile.contactEmail}`} className="underline underline-offset-4">{profile.contactEmail}</a></li>
        )}
        {profile.phone && (
          <li><a href={`tel:${profile.phone.replace(/\s/g, "")}`}>{profile.phone}</a></li>
        )}
        {profile.location && <li>{profile.location}</li>}
      </ul>
      {links.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-4">
          {links.map(([label, href]) => (
            <li key={label}>
              <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">{label}</a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Links between "All work" and each album. Hidden when there are no albums.
function AlbumNav({ site, className, activeClass }: Props & { className?: string; activeClass: string }) {
  if (site.albums.length === 0) return null;
  const items = [{ slug: undefined, title: "All work" }, ...site.albums];
  return (
    <nav aria-label="Albums" className={className}>
      <ul className="flex flex-wrap gap-x-5 gap-y-2">
        {items.map((a) => {
          const active = a.slug === site.album?.slug;
          return (
            <li key={a.slug ?? ""}>
              <Link href={siteHref(site, a.slug)} aria-current={active ? "page" : undefined} className={active ? activeClass : "opacity-70 hover:opacity-100"}>
                {a.title}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// A photo that opens in the lightbox. `index` is its position in site.photos.
function Photo({ photo, index, sizes, className, eager }: {
  photo: PhotoSource;
  index: number;
  sizes: string;
  className?: string;
  eager?: boolean;
}) {
  return (
    <button
      type="button"
      data-photo-index={index}
      aria-label={photo.alt ? `View photo: ${photo.alt}` : `View photo ${index + 1}`}
      className={`block w-full cursor-zoom-in ${className ?? ""}`}
    >
      <img
        src={photo.src}
        srcSet={photo.srcSet}
        sizes={sizes}
        width={photo.width}
        height={photo.height}
        alt={photo.alt}
        loading={eager ? "eager" : "lazy"}
        className="h-full w-full object-cover"
      />
    </button>
  );
}

function Empty({ className }: { className?: string }) {
  return <p className={`py-20 text-center ${className ?? ""}`}>Photos coming soon.</p>;
}

export function MinimalTemplate({ site }: Props) {
  const { profile, photos } = site;
  return (
    <div className="flex-1 bg-white text-zinc-900">
      <header className="mx-auto max-w-6xl px-6 pb-10 pt-16">
        <h1 className="text-3xl font-semibold tracking-tight">
          <Link href={siteHref(site)}>{profile.name}</Link>
        </h1>
        {profile.location && <p className="mt-1 text-zinc-500">{profile.location}</p>}
        <AlbumNav site={site} className="mt-6 text-sm" activeClass="font-medium underline underline-offset-4" />
      </header>
      <main className="mx-auto max-w-6xl px-6">
        {site.album && <h2 className="mb-6 text-xl font-medium">{site.album.title}</h2>}
        {photos.length === 0 ? <Empty className="text-zinc-400" /> : (
          <Lightbox photos={photos}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {photos.map((photo, i) => (
                <Photo
                  key={photo.id}
                  photo={photo}
                  index={i}
                  eager={i < 3}
                  sizes="(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw"
                  className="aspect-[4/5]"
                />
              ))}
            </div>
          </Lightbox>
        )}
      </main>
      <footer id="about" className="mx-auto grid max-w-6xl gap-10 px-6 py-20 sm:grid-cols-2">
        {profile.bio && (
          <div>
            <h2 className="mb-3 text-sm uppercase tracking-widest text-zinc-400">About</h2>
            <p className="whitespace-pre-line leading-relaxed">{profile.bio}</p>
          </div>
        )}
        <div>
          <h2 className="mb-3 text-sm uppercase tracking-widest text-zinc-400">Contact</h2>
          <Contact profile={profile} className="text-zinc-700" />
        </div>
        <div className="sm:col-span-2">
          <h2 className="mb-4 text-sm uppercase tracking-widest text-zinc-400">Send a message</h2>
          <ContactForm subdomain={site.subdomain} tone="light" preview={site.preview} />
        </div>
      </footer>
    </div>
  );
}

export function DarkTemplate({ site }: Props) {
  const { profile, photos } = site;
  return (
    <div className="flex-1 bg-black text-zinc-100">
      <header className="flex flex-wrap items-end justify-between gap-4 px-6 pb-8 pt-12 sm:px-10">
        <div>
          <h1 className="text-4xl font-light tracking-wide">
            <Link href={siteHref(site)}>{profile.name}</Link>
          </h1>
          {profile.location && <p className="mt-1 text-sm uppercase tracking-[0.3em] text-zinc-500">{profile.location}</p>}
        </div>
        <a href="#about" className="text-sm uppercase tracking-widest text-zinc-400 hover:text-white">About & contact</a>
        <AlbumNav site={site} className="w-full text-sm uppercase tracking-widest" activeClass="text-white" />
      </header>
      <main className="px-2 sm:px-6">
        {site.album && <h2 className="mb-6 px-4 text-2xl font-light sm:px-4">{site.album.title}</h2>}
        {photos.length === 0 ? <Empty className="text-zinc-600" /> : (
          <Lightbox photos={photos}>
            <div className="columns-1 gap-2 sm:columns-2 lg:columns-3 [&>button]:mb-2">
              {photos.map((photo, i) => (
                <Photo
                  key={photo.id}
                  photo={photo}
                  index={i}
                  eager={i < 3}
                  sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  className="break-inside-avoid"
                />
              ))}
            </div>
          </Lightbox>
        )}
      </main>
      <footer id="about" className="mx-auto max-w-3xl px-6 py-24 text-center">
        {profile.bio && <p className="whitespace-pre-line text-lg leading-relaxed text-zinc-300">{profile.bio}</p>}
        <Contact profile={profile} className="mt-10 flex flex-col items-center text-zinc-400 [&_ul]:justify-center" />
        <div className="mt-14 flex justify-center">
          <ContactForm subdomain={site.subdomain} tone="dark" preview={site.preview} />
        </div>
      </footer>
    </div>
  );
}

export function EditorialTemplate({ site }: Props) {
  const { profile, photos } = site;
  const [cover, ...rest] = photos;
  return (
    <div className="flex-1 bg-stone-50 font-serif text-stone-900">
      <Lightbox photos={photos}>
        {cover ? (
          <section className="relative h-[85vh] min-h-96 w-full">
            <img
              src={cover.src}
              srcSet={cover.srcSet}
              sizes="100vw"
              alt={cover.alt}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent" />
            <div className="absolute bottom-0 left-0 p-8 text-white sm:p-14">
              <h1 className="text-5xl italic sm:text-7xl">
                <Link href={siteHref(site)}>{profile.name}</Link>
              </h1>
              {site.album && <p className="mt-2 text-2xl italic">{site.album.title}</p>}
              {profile.location && <p className="mt-3 font-sans text-sm uppercase tracking-[0.3em]">{profile.location}</p>}
            </div>
          </section>
        ) : (
          <header className="px-8 pb-10 pt-20 sm:px-14">
            <h1 className="text-5xl italic sm:text-7xl">{profile.name}</h1>
          </header>
        )}

        <AlbumNav
          site={site}
          className="flex justify-center border-b border-stone-200 px-6 py-5 font-sans text-sm uppercase tracking-widest"
          activeClass="text-stone-900 underline underline-offset-8"
        />

        {profile.bio && !site.album && (
          <section className="mx-auto max-w-2xl px-6 py-20 text-center">
            <p className="whitespace-pre-line text-xl leading-relaxed sm:text-2xl">{profile.bio}</p>
          </section>
        )}

        <main className="mx-auto max-w-5xl space-y-6 px-6 pb-10 pt-6">
          {photos.length === 0 && <Empty className="text-stone-400" />}
          {rest.map((photo, i) => (
            <Photo
              key={photo.id}
              photo={photo}
              index={i + 1}
              sizes="(min-width: 1024px) 976px, 100vw"
              className={`${i % 3 === 0 ? "" : "sm:w-[70%]"} ${i % 3 === 2 ? "sm:ml-auto" : ""}`}
            />
          ))}
        </main>
      </Lightbox>

      <footer id="about" className="border-t border-stone-200 px-6 py-16 text-center">
        <h2 className="mb-6 text-3xl italic">Get in touch</h2>
        <Contact profile={profile} className="flex flex-col items-center font-sans text-stone-700 [&_ul]:justify-center" />
        <div className="mt-12 flex justify-center">
          <ContactForm subdomain={site.subdomain} tone="serif" preview={site.preview} />
        </div>
      </footer>
    </div>
  );
}

export function SiteTemplate({ site }: Props) {
  switch (site.template) {
    case "dark":
      return <DarkTemplate site={site} />;
    case "editorial":
      return <EditorialTemplate site={site} />;
    default:
      return <MinimalTemplate site={site} />;
  }
}
