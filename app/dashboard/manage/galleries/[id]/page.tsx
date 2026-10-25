import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { findGallery, galleryExpired, galleryPhotos } from "@/lib/galleries";
import { siteUrl } from "@/lib/site";
import { photoSource } from "@/lib/uploads";
import { DeleteGalleryButton, EmailLinkForm, GalleryDetailsForm, GalleryPhotos } from "../../../galleries";
import { Card, Loading } from "../../section";

export const metadata = { title: "Client gallery — Folio" };

export default function GalleryPage({ params }: PageProps<"/dashboard/manage/galleries/[id]">) {
  return (
    <>
      <Link href="/dashboard/manage/galleries" className="text-sm text-ink-soft hover:text-ink">← All galleries</Link>
      <Suspense fallback={<Loading />}>
        <Gallery params={params} />
      </Suspense>
    </>
  );
}

async function Gallery({ params }: { params: PageProps<"/dashboard/manage/galleries/[id]">["params"] }) {
  const { id } = await params;
  const user = await requireUser();
  const gallery = findGallery(user, id);
  if (!gallery) notFound();
  const library = user.photos
    .filter((p) => !p.removed)
    .map((p) => {
      const src = photoSource(user.id, p);
      return { id: p.id, src: src.src, srcSet: src.srcSet, description: p.description ?? "", location: p.location ?? "" };
    });
  const chosen = new Set(gallery.favouriteIds ?? []);
  const favourites = galleryPhotos(user, gallery).filter((p) => chosen.has(p.id)).map((p) => photoSource(user.id, p));
  const link = `${siteUrl(user.subdomain)}/g/${gallery.slug}`;
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{gallery.title}</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Send your client this link and the password:{" "}
            <a href={link} target="_blank" rel="noopener noreferrer" className="underline">{link.replace(/^https?:\/\//, "")}</a>
          </p>
        </div>
        <DeleteGalleryButton galleryId={gallery.id} title={gallery.title} />
      </div>
      <Card title="Details">
        <GalleryDetailsForm gallery={{ id: gallery.id, title: gallery.title, expiresAt: gallery.expiresAt }} />
      </Card>
      {galleryExpired(gallery) && (
        <p className="border-l-2 border-accent bg-card px-4 py-3 text-sm text-ink-soft">
          This link expired on {gallery.expiresAt}. Change the date above to open it again.
        </p>
      )}
      <Card title="Email the link">
        <EmailLinkForm galleryId={gallery.id} />
      </Card>
      <Card title="Client favourites" subtitle={`${favourites.length} of ${gallery.photoIds.length} chosen`}>
        {favourites.length === 0 ? (
          <p className="text-sm text-ink-soft">When your client hearts photos in the gallery, they show up here.</p>
        ) : (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-8">
            {favourites.map((p) => (
              <li key={p.id}>
                {/* eslint-disable-next-line @next/next/no-img-element -- user uploads are served by our own route */}
                <img src={p.src} srcSet={p.srcSet} sizes="120px" alt={p.alt} className="aspect-square w-full object-cover" />
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="Photos">
        <GalleryPhotos galleryId={gallery.id} photos={library} selected={gallery.photoIds} />
      </Card>
    </>
  );
}
