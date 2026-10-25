/* eslint-disable @next/next/no-img-element -- user uploads are served by our own route */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { findUserBySubdomain } from "@/lib/db";
import { findGallery, galleryPhotos } from "@/lib/galleries";
import { hasGalleryAccess } from "@/lib/session";
import { photoSource } from "@/lib/uploads";
import { UnlockForm } from "./unlock-form";

// name.yourapp.com/g/<link> → /sites/name/g/<link>. A client's private
// gallery: nothing about it is shown, or indexed, before the password.
export const metadata: Metadata = {
  title: "Private gallery",
  robots: { index: false, follow: false },
};

export default function GalleryPage({ params }: PageProps<"/sites/[subdomain]/g/[gallery]">) {
  return (
    <Suspense fallback={<div className="flex-1" />}>
      <Gallery params={params} />
    </Suspense>
  );
}

async function Gallery({ params }: { params: PageProps<"/sites/[subdomain]/g/[gallery]">["params"] }) {
  const { subdomain, gallery: slug } = await params;
  const owner = await findUserBySubdomain(subdomain);
  // Same page for a wrong link and for a site that is closed or unconfirmed.
  const gallery = owner && !owner.suspended && owner.emailVerified ? findGallery(owner, slug) : undefined;
  if (!owner || !gallery) notFound();

  if (!(await hasGalleryAccess(gallery.id, gallery.passwordHash))) {
    return (
      <main className="mx-auto w-full max-w-sm flex-1 px-6 py-24">
        <p className="label text-ink-faint">{owner.profile.name}</p>
        <h1 className="mt-2 font-display text-3xl">This gallery is private</h1>
        <p className="mb-6 mt-2 text-sm text-ink-soft">Enter the password you were given to see the photos.</p>
        <UnlockForm subdomain={subdomain} slug={gallery.slug} />
      </main>
    );
  }

  const photos = galleryPhotos(owner, gallery).map((p) => photoSource(owner.id, p));
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <p className="label text-ink-faint">{owner.profile.name}</p>
      <h1 className="mt-2 font-display text-4xl">{gallery.title}</h1>
      {photos.length === 0 ? (
        <p className="mt-8 text-ink-soft">No photos have been added yet. Check back soon.</p>
      ) : (
        <ul className="mt-8 columns-1 gap-4 sm:columns-2 lg:columns-3">
          {photos.map((photo) => (
            <li key={photo.id} className="mb-4 break-inside-avoid">
              <a href={photo.src} target="_blank" rel="noopener noreferrer" className="block">
                <img
                  src={photo.src}
                  srcSet={photo.srcSet}
                  sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  alt={photo.alt}
                  width={photo.width}
                  height={photo.height}
                  loading="lazy"
                  className="w-full"
                />
              </a>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
