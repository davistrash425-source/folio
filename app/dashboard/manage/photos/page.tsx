import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { photoSource } from "@/lib/uploads";
import { PhotoLibrary } from "../../editor";
import { Loading, PageHeader } from "../section";

export const metadata = { title: "All photos — Folio" };

export default function PhotosPage({ searchParams }: PageProps<"/dashboard/manage/photos">) {
  return (
    <>
      <PageHeader
        title="All photos"
        subtitle="Every photo you’ve uploaded. Add a description and location to each one."
        actions={
          <Link href="/dashboard/manage/upload" className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800">
            Upload photos
          </Link>
        }
      />
      <Suspense fallback={<Loading />}>
        <Library searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Library({ searchParams }: { searchParams: PageProps<"/dashboard/manage/photos">["searchParams"] }) {
  const user = await requireUser();
  const { filter } = await searchParams;
  const albums = user.albums ?? [];
  const photos = user.photos.map((p) => {
    const src = photoSource(user.id, p);
    return {
      id: p.id,
      src: src.src,
      srcSet: src.srcSet,
      description: p.description ?? "",
      location: p.location ?? "",
      alt: p.alt ?? "",
      albumIds: albums.filter((a) => a.photoIds.includes(p.id)).map((a) => a.id),
    };
  });
  return (
    <PhotoLibrary
      photos={photos}
      albums={albums.map((a) => ({ id: a.id, title: a.title }))}
      initialFilter={filter === "no-album" || filter === "no-description" ? filter : "all"}
    />
  );
}
