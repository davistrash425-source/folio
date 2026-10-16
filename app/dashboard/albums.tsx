"use client";

/* eslint-disable @next/next/no-img-element -- user uploads are served by our own route */
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";
import { createAlbum, deleteAlbum, setAlbumCover, setAlbumPhotos, updateAlbum } from "@/app/actions/site";
import { Button, Field, Input, Message, inputClass } from "@/app/ui/form";

export function CreateAlbumForm() {
  const [state, action, pending] = useActionState(createAlbum, {});
  const router = useRouter();
  // Go straight to the new album so its photos can be picked.
  useEffect(() => {
    if (state.id) router.push(`/dashboard/manage/albums/${state.id}`);
  }, [state.id, router]);

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
      <Field label="Album name">
        <Input name="title" required maxLength={60} placeholder="Weddings" />
      </Field>
      <Field label="Short description" hint="Optional. Shown on the album page.">
        <Input name="description" maxLength={500} placeholder="Celebrations along the coast, 2024–2026" />
      </Field>
      <Button type="submit" disabled={pending} className="sm:mb-5">{pending ? "Creating…" : "Create album"}</Button>
      <div className="sm:col-span-3"><Message error={state.error} /></div>
    </form>
  );
}

export function AlbumDetailsForm({ album }: { album: { id: string; title: string; description: string } }) {
  const [state, action, pending] = useActionState(updateAlbum.bind(null, album.id), {});
  return (
    <form action={action} className="space-y-4">
      <Field label="Album name">
        <Input name="title" required maxLength={60} defaultValue={album.title} />
      </Field>
      <Field label="Short description">
        <textarea name="description" rows={3} maxLength={500} defaultValue={album.description} className={inputClass} />
      </Field>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
        <Message error={state.error} ok={state.ok} />
      </div>
    </form>
  );
}

type Thumb = { id: string; src: string; srcSet?: string; description: string };

// The album's photos in order, plus a picker to add more.
export function AlbumPhotos({
  albumId,
  photoIds,
  coverPhotoId,
  library,
}: {
  albumId: string;
  photoIds: string[];
  coverPhotoId?: string;
  library: Thumb[];
}) {
  const [order, setOrder] = useState(photoIds);
  const [serverIds, setServerIds] = useState(photoIds);
  if (photoIds !== serverIds) {
    setServerIds(photoIds);
    setOrder(photoIds);
  }
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();
  const byId = new Map(library.map((p) => [p.id, p]));
  const inAlbum = order.flatMap((id) => byId.get(id) ?? []);
  const notInAlbum = library.filter((p) => !order.includes(p.id));
  const cover = coverPhotoId && order.includes(coverPhotoId) ? coverPhotoId : order[0];

  function save(next: string[]) {
    setOrder(next);
    startTransition(() => setAlbumPhotos(albumId, next));
  }
  function move(from: number, to: number) {
    if (to < 0 || to >= order.length) return;
    const next = [...order];
    const [id] = next.splice(from, 1);
    next.splice(to, 0, id);
    save(next);
  }

  return (
    <div className={`space-y-5 ${pending ? "opacity-80" : ""}`}>
      {inAlbum.length === 0 ? (
        <p className="text-sm text-zinc-500">This album is empty. Add photos below — albums appear on your site once they have photos.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {inAlbum.map((photo, i) => (
            <li key={photo.id} className="group relative overflow-hidden rounded-lg bg-zinc-100">
              <img src={photo.src} srcSet={photo.srcSet} sizes="240px" alt="" className="aspect-square w-full object-cover" />
              {photo.id === cover && (
                <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-xs text-white">Cover</span>
              )}
              <div className="absolute inset-x-0 bottom-0 flex flex-wrap justify-end gap-1 bg-gradient-to-t from-black/60 p-2 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                <Small label="Move earlier" disabled={i === 0} onClick={() => move(i, i - 1)}>←</Small>
                <Small label="Move later" disabled={i === inAlbum.length - 1} onClick={() => move(i, i + 1)}>→</Small>
                {photo.id !== cover && (
                  <Small label="Use as album cover" onClick={() => startTransition(() => setAlbumCover(albumId, photo.id))}>Cover</Small>
                )}
                <Small label="Remove from album" danger onClick={() => save(order.filter((id) => id !== photo.id))}>Remove</Small>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div>
        <button
          type="button"
          onClick={() => setAdding(!adding)}
          aria-expanded={adding}
          className="rounded-full px-4 py-2 text-sm font-medium ring-1 ring-zinc-300 hover:bg-zinc-100"
        >
          {adding ? "Done adding" : `Add photos${notInAlbum.length ? ` (${notInAlbum.length} available)` : ""}`}
        </button>
        {adding && (
          notInAlbum.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">Every photo is already in this album.</p>
          ) : (
            <>
              <p className="mt-3 text-sm text-zinc-500">Click photos to add them to the end of the album.</p>
              <ul className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
                {notInAlbum.map((photo) => (
                  <li key={photo.id}>
                    <button
                      type="button"
                      onClick={() => save([...order, photo.id])}
                      aria-label={`Add ${photo.description || "photo"} to album`}
                      className="block w-full overflow-hidden rounded-md opacity-80 ring-offset-2 hover:opacity-100 hover:ring-2 hover:ring-black"
                    >
                      <img src={photo.src} srcSet={photo.srcSet} sizes="120px" alt="" className="aspect-square w-full object-cover" />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )
        )}
      </div>
    </div>
  );
}

export function DeleteAlbumButton({ albumId, title }: { albumId: string; title: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm(`Delete the album “${title}”? The photos stay in your library.`)) return;
        startTransition(async () => {
          await deleteAlbum(albumId);
          router.push("/dashboard/manage/albums");
        });
      }}
      className="rounded-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
    >
      {pending ? "Deleting…" : "Delete album"}
    </button>
  );
}

function Small({ label, danger, children, ...props }: React.ComponentProps<"button"> & { label: string; danger?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...props}
      className={`rounded-full bg-white/90 px-2 py-1 text-xs font-medium disabled:opacity-40 ${danger ? "text-red-600" : ""}`}
    >
      {children}
    </button>
  );
}
