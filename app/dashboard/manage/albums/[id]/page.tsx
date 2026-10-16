import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { siteUrl } from "@/lib/site";
import { photoSource } from "@/lib/uploads";
import { AlbumDetailsForm, AlbumPhotos, DeleteAlbumButton } from "../../../albums";
import { Card, Loading } from "../../section";

export const metadata = { title: "Album — Folio" };

export default function AlbumPage({ params }: PageProps<"/dashboard/manage/albums/[id]">) {
  return (
    <>
      <Link href="/dashboard/manage/albums" className="text-sm text-ink-soft hover:text-ink">← All albums</Link>
      <Suspense fallback={<Loading />}>
        <Album params={params} />
      </Suspense>
    </>
  );
}

async function Album({ params }: { params: PageProps<"/dashboard/manage/albums/[id]">["params"] }) {
  const { id } = await params;
  const user = await requireUser();
  const album = user.albums?.find((a) => a.id === id);
  if (!album) notFound();
  const library = user.photos.map((p) => {
    const src = photoSource(user.id, p);
    return { id: p.id, src: src.src, srcSet: src.srcSet, description: p.description ?? "" };
  });

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{album.title}</h1>
          <p className="mt-1 text-sm text-ink-soft">
            On your site at{" "}
            <a href={`${siteUrl(user.subdomain)}/${album.slug}`} target="_blank" rel="noopener noreferrer" className="underline">
              /{album.slug}
            </a>
          </p>
        </div>
        <DeleteAlbumButton albumId={album.id} title={album.title} />
      </div>
      <Card title="Details">
        <AlbumDetailsForm album={{ id: album.id, title: album.title, description: album.description ?? "" }} />
      </Card>
      <Card title="Photos" subtitle="Hover a photo to reorder it, make it the album cover, or remove it.">
        <AlbumPhotos albumId={album.id} photoIds={album.photoIds} coverPhotoId={album.coverPhotoId} library={library} />
      </Card>
    </>
  );
}
