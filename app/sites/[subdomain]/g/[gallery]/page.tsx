import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { findUserBySubdomain } from "@/lib/db";
import { findGallery, galleryExpired, galleryPhotos } from "@/lib/galleries";
import { galleriesOpen } from "@/lib/plans";
import { hasGalleryAccess } from "@/lib/session";
import { isLive } from "@/lib/site";
import { photoSource } from "@/lib/uploads";
import { ReportLink } from "../../themes/report-link";
import { FolioBadge } from "./folio-badge";
import { PhotoGrid } from "./photo-grid";
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
  const gallery = owner && isLive(owner) && galleriesOpen(owner) ? findGallery(owner, slug) : undefined;
  if (!owner || !gallery) notFound();

  if (galleryExpired(gallery)) {
    return (
      <main className="mx-auto w-full max-w-sm flex-1 px-6 py-24">
        <p className="label text-ink-faint">{owner.profile.name}</p>
        <h1 className="mt-2 font-display text-3xl">This gallery has expired</h1>
        <p className="mt-2 text-sm text-ink-soft">Ask {owner.profile.name} to send you a new link.</p>
      </main>
    );
  }

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
  const favourites = (gallery.favouriteIds ?? []).filter((id) => photos.some((p) => p.id === id));
  return (
    <>
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <p className="label text-ink-faint">{owner.profile.name}</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-4xl">{gallery.title}</h1>
        {photos.length > 0 && (
          <a href={`/g/${gallery.slug}/download`} download className="inline-flex h-10 items-center border border-ink px-4 text-sm hover:bg-ink hover:text-paper">
            Download all ({photos.length})
          </a>
        )}
      </div>
      {gallery.expiresAt && <p className="mt-2 text-sm text-ink-soft">Available until {gallery.expiresAt}.</p>}
      {photos.length === 0 ? (
        <p className="mt-8 text-ink-soft">No photos have been added yet. Check back soon.</p>
      ) : (
        <PhotoGrid subdomain={subdomain} slug={gallery.slug} photos={photos} favourites={favourites} />
      )}
      <p className="mt-8 text-center text-xs text-ink-faint">
        <ReportLink site={{ subdomain, preview: false }} />
      </p>
    </main>
    <FolioBadge owner={owner} />
    </>
  );
}
