"use client";

/* eslint-disable @next/next/no-img-element -- user uploads are served by our own route */
import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import { createAlbum, deleteAlbum, setAlbumCover, setAlbumPhotos, updateAlbum } from "@/app/actions/site";
import { Button, Field, Input, Message, buttonClass, inputClass, secondaryButtonClass } from "@/app/ui/form";
import { ConfirmButton } from "@/app/ui/confirm";
import { Dialog } from "@/app/ui/dialog";
import { keepFields } from "@/app/ui/keep-fields";

// photoIds: start the album with these (from a selection in the photo grid).
export function CreateAlbumForm({ photoIds = [] }: { photoIds?: string[] }) {
  const [state, action, pending] = useActionState(keepFields(createAlbum), {});

  return (
    <form action={action} className="space-y-4">
      {photoIds.map((id) => (
        <input key={id} type="hidden" name="photoIds" value={id} />
      ))}
      <Field label="Album name">
        <Input name="title" required maxLength={60} defaultValue={state.fields?.title} placeholder="e.g. Weddings" data-autofocus />
      </Field>
      <Field label="Short description" hint="Optional. Shown on the album page.">
        <Input name="description" maxLength={500} defaultValue={state.fields?.description} placeholder="Add a line about these photos…" />
      </Field>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Creating…" : "Create album"}</Button>
        <Message error={state.error} />
      </div>
    </form>
  );
}

export function NewAlbumButton({ label = "New album", primary = false }: { label?: string; primary?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={primary ? buttonClass : secondaryButtonClass}
      >
        {label}
      </button>
      {open && (
        <Dialog title="New album" onClose={() => setOpen(false)}>
          <CreateAlbumForm />
        </Dialog>
      )}
    </>
  );
}

export function AlbumDetailsForm({ album }: { album: { id: string; title: string; description: string } }) {
  const [state, action, pending] = useActionState(keepFields(updateAlbum.bind(null, album.id)), {});
  return (
    <form action={action} className="space-y-4">
      <Field label="Album name">
        <Input name="title" required maxLength={60} defaultValue={state.fields?.title ?? album.title} />
      </Field>
      <Field label="Short description">
        <textarea name="description" rows={3} maxLength={500} defaultValue={state.fields?.description ?? album.description} className={inputClass} />
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
  // Swaps two photos as shown. `order` can also hold photos that aren't shown
  // (taken down by Folio), so positions are looked up by id.
  function move(from: number, to: number) {
    if (to < 0 || to >= inAlbum.length) return;
    const a = order.indexOf(inAlbum[from].id);
    const b = order.indexOf(inAlbum[to].id);
    const next = [...order];
    [next[a], next[b]] = [next[b], next[a]];
    save(next);
  }

  return (
    <div className={`space-y-5 ${pending ? "opacity-80" : ""}`}>
      {inAlbum.length === 0 ? (
        <p className="text-sm text-ink-soft">This album is empty. Add photos below — albums appear on your site once they have photos.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {inAlbum.map((photo, i) => (
            <li key={photo.id} className="group relative overflow-hidden bg-ink/5">
              <img src={photo.src} srcSet={photo.srcSet} sizes="240px" alt="" className="aspect-square w-full object-cover" />
              {photo.id === cover && (
                <span className="absolute left-2 top-2 bg-ink/80 px-2 py-0.5 text-xs text-paper">Cover</span>
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
          className="px-4 py-2 text-sm font-medium border border-rule hover:bg-ink/5"
        >
          {adding ? "Done adding" : `Add photos${notInAlbum.length ? ` (${notInAlbum.length} available)` : ""}`}
        </button>
        {adding && (
          notInAlbum.length === 0 ? (
            <p className="mt-3 text-sm text-ink-soft">Every photo is already in this album.</p>
          ) : (
            <>
              <p className="mt-3 text-sm text-ink-soft">Click photos to add them to the end of the album.</p>
              <ul className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
                {notInAlbum.map((photo) => (
                  <li key={photo.id}>
                    <button
                      type="button"
                      onClick={() => save([...order, photo.id])}
                      aria-label={`Add ${photo.description || "photo"} to album`}
                      className="block w-full overflow-hidden opacity-80 ring-offset-2 ring-offset-paper hover:opacity-100 hover:ring-2 hover:ring-accent"
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
    <ConfirmButton
      label={pending ? "Deleting…" : "Delete album"}
      message={`Delete the album “${title}”? The photos stay in your library.`}
      onConfirm={() =>
        startTransition(async () => {
          await deleteAlbum(albumId);
          router.push("/dashboard/manage/albums");
        })
      }
      className="px-4 py-2 text-sm text-accent hover:bg-accent-soft disabled:opacity-50"
      confirmClassName="bg-accent px-4 py-2 text-sm text-paper hover:bg-ink"
    />
  );
}

// Stays focusable when disabled (aria-disabled), like IconButton.
function Small({ label, danger, children, disabled, onClick, ...props }: React.ComponentProps<"button"> & { label: string; danger?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...props}
      aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : onClick}
      className={`bg-paper/90 px-2 py-1 text-xs font-medium aria-disabled:opacity-40 ${danger ? "text-accent" : ""}`}
    >
      {children}
    </button>
  );
}
