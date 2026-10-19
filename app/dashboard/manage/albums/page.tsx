/* eslint-disable @next/next/no-img-element -- user uploads are served by our own route */
import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { photoSource } from "@/lib/uploads";
import { CreateAlbumForm } from "../../albums";
import { Card, Loading, PageHeader } from "../section";

export const metadata = { title: "Albums — Folio" };

export default function AlbumsPage() {
  return (
    <>
      <PageHeader title="Albums" subtitle="Group photos into collections like Weddings or Portraits. Each album gets its own page on your site." />
      <Card title="New album">
        <CreateAlbumForm />
      </Card>
      <Suspense fallback={<Loading />}>
        <AlbumList />
      </Suspense>
    </>
  );
}

async function AlbumList() {
  const user = await requireUser();
  const albums = user.albums ?? [];
  if (albums.length === 0) return <p className="text-sm text-ink-soft">No albums yet.</p>;
  const byId = new Map(user.photos.filter((p) => !p.removed).map((p) => [p.id, p]));
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {albums.map((album) => {
        const coverPhoto = byId.get(album.coverPhotoId ?? "") ?? byId.get(album.photoIds[0]);
        const cover = coverPhoto && photoSource(user.id, coverPhoto);
        return (
          <li key={album.id}>
            <Link
              href={`/dashboard/manage/albums/${album.id}`}
              className="block overflow-hidden bg-card border border-rule transition hover:border-ink"
            >
              {cover ? (
                <img src={cover.src} srcSet={cover.srcSet} sizes="400px" alt="" className="aspect-[4/3] w-full object-cover" />
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center bg-ink/5 text-sm text-ink-faint">No photos yet</div>
              )}
              <div className="p-4">
                <p className="font-medium">{album.title}</p>
                <p className="text-sm text-ink-soft">
                  {album.photoIds.length} photo{album.photoIds.length === 1 ? "" : "s"}
                </p>
                {album.description && <p className="mt-2 line-clamp-2 text-sm text-ink-soft">{album.description}</p>}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
