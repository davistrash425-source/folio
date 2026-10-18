"use client";

/* eslint-disable @next/next/no-img-element -- user uploads are served by our own route */
import Link from "next/link";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  deletePhoto,
  finishPhotoUpload,
  reorderPhotos,
  saveProfile,
  startPhotoUpload,
  updatePhoto,
  uploadPhotos,
} from "@/app/actions/site";
import { Button, Field, Input, Message, inputClass, chipClass } from "@/app/ui/form";
import { CompressError, MAX_UPLOAD_BYTES, compressPhoto, formatMB } from "@/lib/compress-image";
import type { User } from "@/lib/db";

type UploadItem = {
  name: string;
  status: "waiting" | "compressing" | "uploading" | "done" | "failed";
  reason?: string;
  note?: string; // e.g. "Compressed 34 MB → 11 MB"
};

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/avif";

// Sends one photo. Where storage takes direct uploads (R2 in production), the
// photo goes straight there and the server only finishes it, since hosting
// caps how much one request to the app can carry. Otherwise it goes through
// the app (local development).
async function sendPhoto(file: File): Promise<Partial<UploadItem>> {
  const start = await startPhotoUpload(file.type, file.size);
  if (start.error) return { status: "failed", reason: start.error };
  if (start.direct) {
    const res = await fetch(start.direct.url, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
    if (!res.ok) return { status: "failed", reason: "upload failed" };
    const result = await finishPhotoUpload(start.direct.file);
    return result.error ? { status: "failed", reason: result.error } : { status: "done" };
  }
  const fd = new FormData();
  fd.append("photos", file);
  const result = await uploadPhotos({}, fd);
  return result.error ? { status: "failed", reason: "couldn't be read as an image" } : { status: "done" };
}

export function PhotoUploader() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const busy = items.some((i) => i.status === "waiting" || i.status === "compressing" || i.status === "uploading");

  // Photos are sent one request at a time so a big batch never exceeds the
  // request body limit and one bad file doesn't stop the rest.
  async function upload(files: File[]) {
    if (files.length === 0 || busy) return;
    setItems(files.map((f) => ({ name: f.name, status: "waiting" })));
    const update = (i: number, item: Partial<UploadItem>) =>
      setItems((cur) => cur.map((x, j) => (j === i ? { ...x, ...item } : x)));

    for (const [i, file] of files.entries()) {
      if (/hei[cf]$/i.test(file.name) || /hei[cf]/.test(file.type)) {
        update(i, { status: "failed", reason: "HEIC isn’t supported — export it as a JPG from Photos and try again" });
        continue;
      }
      if (!ACCEPT.split(",").includes(file.type)) {
        update(i, { status: "failed", reason: "not a JPG, PNG, WebP, GIF or AVIF" });
        continue;
      }

      // Photos over the upload limit are shrunk here instead of rejected.
      let toSend = file;
      if (file.size > MAX_UPLOAD_BYTES) {
        update(i, { status: "compressing" });
        try {
          const compressed = await compressPhoto(file);
          toSend = compressed.file;
          if (compressed.from) update(i, { note: `Compressed ${formatMB(compressed.from)} → ${formatMB(compressed.to)}` });
        } catch (err) {
          update(i, { status: "failed", reason: err instanceof CompressError ? err.message : "couldn’t be compressed" });
          continue;
        }
      }

      update(i, { status: "uploading" });
      try {
        update(i, await sendPhoto(toSend));
      } catch {
        update(i, { status: "failed", reason: "upload failed" });
      }
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  const done = items.filter((i) => i.status === "done").length;
  const failed = items.filter((i) => i.status === "failed");

  return (
    <div className="space-y-3">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          upload(Array.from(e.dataTransfer.files));
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-1 border-2 border-dashed px-6 py-8 text-center transition ${
          dragging ? "border-black bg-paper" : "border-rule hover:border-ink-faint"
        } ${busy ? "pointer-events-none opacity-60" : ""}`}
      >
        <span className="font-medium">
          {items.some((i) => i.status === "compressing") ? "Compressing…" : busy ? "Uploading…" : "Drop photos here or click to choose"}
        </span>
        <span className="text-sm text-ink-soft">JPG, PNG, WebP, GIF or AVIF. Photos over 20 MB are compressed for you.</span>
        <input
          ref={inputRef}
          type="file"
          name="photos"
          accept={ACCEPT}
          multiple
          disabled={busy}
          onChange={(e) => upload(Array.from(e.target.files ?? []))}
          className="sr-only"
        />
      </label>

      {items.length > 0 && (
        <div className="space-y-2 text-sm" aria-live="polite">
          <div className="flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden bg-ink/5">
              <div
                className="h-full bg-ink transition-all"
                style={{ width: `${((done + failed.length) / items.length) * 100}%` }}
              />
            </div>
            <span className="text-ink-soft">
              {done + failed.length} of {items.length}
            </span>
          </div>
          {!busy && done > 0 && <Message ok={`Uploaded ${done} photo${done === 1 ? "" : "s"}.`} />}
          {items.filter((i) => i.note).map((i, n) => (
            <p key={n} className="text-ink-soft">{i.name}: {i.note}</p>
          ))}
          {failed.length > 0 && (
            <ul className="text-accent" role="alert">
              {failed.map((f, i) => (
                <li key={i}>Couldn’t upload {f.name}: {f.reason}.</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export type LibraryPhoto = {
  id: string;
  src: string;
  srcSet?: string;
  description: string;
  location: string;
  alt: string; // as entered; empty means "use the description"
  albumIds: string[];
};

type Filter = "all" | "no-album" | "no-description";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "no-album", label: "Not in an album" },
  { id: "no-description", label: "No description" },
];

export function PhotoLibrary({
  photos,
  albums,
  initialFilter = "all",
}: {
  photos: LibraryPhoto[];
  albums: { id: string; title: string }[];
  initialFilter?: Filter;
}) {
  const [order, setOrder] = useState(photos);
  // Take the server's list whenever it changes (after any save).
  const [serverPhotos, setServerPhotos] = useState(photos);
  if (photos !== serverPhotos) {
    setServerPhotos(photos);
    setOrder(photos);
  }
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [openId, setOpenId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (photos.length === 0) {
    return (
      <p className="bg-card p-6 text-sm text-ink-soft border border-rule">
        No photos yet. <Link href="/dashboard/manage/upload" className="underline">Upload some</Link> to fill your site.
      </p>
    );
  }

  const visible = order.filter((p) =>
    filter === "no-album" ? p.albumIds.length === 0 : filter === "no-description" ? !p.description : true,
  );
  const canReorder = filter === "all";
  const openIndex = visible.findIndex((p) => p.id === openId);

  function moved(id: string, to: number) {
    const from = order.findIndex((p) => p.id === id);
    if (from === -1 || to < 0 || to >= order.length || from === to) return null;
    const next = [...order];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
  }

  function moveAndSave(id: string, to: number) {
    const next = moved(id, to);
    if (!next) return;
    setOrder(next);
    startTransition(() => reorderPhotos(next.map((p) => p.id)));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => {
          const count = f.id === "all" ? order.length : order.filter((p) => (f.id === "no-album" ? p.albumIds.length === 0 : !p.description)).length;
          return (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={chipClass(filter === f.id)}
            >
              {f.label} <span className="opacity-60">{count}</span>
            </button>
          );
        })}
        <span className="ml-auto text-sm text-ink-soft">
          {canReorder ? "Click a photo to edit it. Drag to reorder." : "Click a photo to edit it."}
        </span>
      </div>

      {visible.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink-soft">Nothing here — nice work.</p>
      ) : (
        <ul className={`grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 ${pending ? "opacity-80" : ""}`}>
          {visible.map((photo, i) => (
            <li
              key={photo.id}
              draggable={canReorder}
              onDragStart={(e) => {
                setDragId(photo.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => {
                if (!dragId) return;
                e.preventDefault();
                const next = moved(dragId, i);
                if (next) setOrder(next);
              }}
              onDrop={(e) => e.preventDefault()}
              onDragEnd={() => {
                if (dragId && order.some((p, j) => p.id !== photos[j].id)) {
                  startTransition(() => reorderPhotos(order.map((p) => p.id)));
                }
                setDragId(null);
              }}
              className={`group relative ${dragId === photo.id ? "opacity-40" : ""}`}
            >
              <button
                type="button"
                onClick={() => setOpenId(photo.id)}
                aria-label={`Edit photo${photo.description ? `: ${photo.description}` : ` ${i + 1}`}`}
                className="block w-full bg-ink/5 outline-offset-2 hover:outline hover:outline-1 hover:outline-ink"
              >
                <img src={photo.src} srcSet={photo.srcSet} sizes="240px" alt="" draggable={false} className="aspect-square w-full object-cover" />
              </button>
              {/* Caption under the frame, like a contact sheet. */}
              <div className="pointer-events-none mt-2 text-xs">
                <p className="flex gap-2">
                  <span className="label text-ink-faint">{String(order.indexOf(photo) + 1).padStart(2, "0")}</span>
                  <span className="truncate">{photo.description || <span className="text-accent">No description</span>}</span>
                </p>
                {photo.location && <p className="truncate pl-7 text-ink-soft">{photo.location}</p>}
              </div>
              {canReorder && (
                <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                  <SmallButton label="Move earlier" disabled={i === 0} onClick={() => moveAndSave(photo.id, i - 1)}>←</SmallButton>
                  <SmallButton label="Move later" disabled={i === visible.length - 1} onClick={() => moveAndSave(photo.id, i + 1)}>→</SmallButton>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {openIndex !== -1 && (
        <PhotoDrawer
          key={visible[openIndex].id}
          photo={visible[openIndex]}
          albums={albums}
          onClose={() => setOpenId(null)}
          onPrev={openIndex > 0 ? () => setOpenId(visible[openIndex - 1].id) : undefined}
          onNext={openIndex < visible.length - 1 ? () => setOpenId(visible[openIndex + 1].id) : undefined}
        />
      )}
    </div>
  );
}

// Side panel for one photo's details.
function PhotoDrawer({ photo, albums, onClose, onPrev, onNext }: {
  photo: LibraryPhoto;
  albums: { id: string; title: string }[];
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const [description, setDescription] = useState(photo.description);
  const [location, setLocation] = useState(photo.location);
  const [alt, setAlt] = useState(photo.alt);
  const [albumIds, setAlbumIds] = useState(photo.albumIds);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const dirty =
    description !== photo.description || location !== photo.location || alt !== photo.alt || albumIds.join() !== photo.albumIds.join();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function save(after?: () => void) {
    startTransition(async () => {
      await updatePhoto(photo.id, { description, location, alt, albumIds });
      setSaved(true);
      after?.();
    });
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-ink/30" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Photo details" className="flex h-full w-full max-w-md flex-col overflow-y-auto bg-card border-l border-ink">
        <div className="flex items-center justify-between border-b border-rule px-5 py-3">
          <div className="flex gap-1">
            <SmallButton label="Previous photo" disabled={!onPrev} onClick={() => (dirty ? save(onPrev) : onPrev?.())}>←</SmallButton>
            <SmallButton label="Next photo" disabled={!onNext} onClick={() => (dirty ? save(onNext) : onNext?.())}>→</SmallButton>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="px-3 py-1 text-xl hover:bg-ink/5">×</button>
        </div>
        <img src={photo.src} srcSet={photo.srcSet} sizes="448px" alt="" className="max-h-80 w-full bg-ink/5 object-contain" />
        <form
          className="flex flex-1 flex-col gap-4 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <Field label="Description" hint="Shown as a caption if your design turns captions on.">
            <textarea
              value={description}
              onChange={(e) => { setDescription(e.target.value); setSaved(false); }}
              rows={3}
              maxLength={500}
              placeholder="Couple on the beach at sunset"
              className={inputClass}
            />
          </Field>
          <Field label="Location">
            <Input
              value={location}
              onChange={(e) => { setLocation(e.target.value); setSaved(false); }}
              maxLength={120}
              placeholder="Cascais, Portugal"
            />
          </Field>
          <Field label="Alt text (for screen readers)" hint="Leave empty to use the description.">
            <Input value={alt} onChange={(e) => { setAlt(e.target.value); setSaved(false); }} maxLength={300} placeholder={description} />
          </Field>
          <fieldset>
            <legend className="label text-ink-soft">Albums</legend>
            {albums.length === 0 ? (
              <p className="mt-1 text-sm text-ink-soft">
                No albums yet. <Link href="/dashboard/manage/albums" className="underline">Create one</Link>.
              </p>
            ) : (
              <ul className="mt-2 space-y-1">
                {albums.map((a) => (
                  <li key={a.id}>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={albumIds.includes(a.id)}
                        onChange={(e) => {
                          setAlbumIds(e.target.checked ? [...albumIds, a.id] : albumIds.filter((id) => id !== a.id));
                          setSaved(false);
                        }}
                      />
                      {a.title}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </fieldset>
          <div className="mt-auto flex flex-wrap items-center gap-3 border-t border-rule pt-4">
            <Button type="submit" disabled={pending || !dirty}>{pending ? "Saving…" : "Save"}</Button>
            {saved && !dirty && <Message ok="Saved." />}
            <button
              type="button"
              onClick={() => {
                if (!confirm("Delete this photo? It will be removed from your site and albums.")) return;
                startTransition(async () => {
                  await deletePhoto(photo.id);
                  onClose();
                });
              }}
              className="ml-auto px-3 py-2 text-sm text-accent hover:bg-accent-soft"
            >
              Delete photo
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SmallButton({
  label,
  children,
  ...props
}: React.ComponentProps<"button"> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...props}
      className="bg-paper/90 px-2 py-1 text-xs font-medium border border-rule disabled:opacity-40"
    >
      {children}
    </button>
  );
}

export function ProfileForm({ profile }: { profile: User["profile"] }) {
  const [state, action, pending] = useActionState(saveProfile, {});

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <Field label="Name">
        <Input name="name" required defaultValue={profile.name} />
      </Field>
      <Field label="Location">
        <Input name="location" defaultValue={profile.location} placeholder="Lisbon, Portugal" />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Bio">
          <textarea
            name="bio"
            rows={4}
            defaultValue={profile.bio}
            placeholder="A few lines about you and your work."
            className={inputClass}
          />
        </Field>
      </div>
      <Field label="Contact email">
        <Input name="contactEmail" type="email" defaultValue={profile.contactEmail} />
      </Field>
      <Field label="Phone">
        <Input name="phone" type="tel" defaultValue={profile.phone} />
      </Field>
      <Field label="Instagram">
        <Input name="instagram" defaultValue={profile.social.instagram} placeholder="instagram.com/yourname" />
      </Field>
      <Field label="X / Twitter">
        <Input name="twitter" defaultValue={profile.social.twitter} placeholder="x.com/yourname" />
      </Field>
      <Field label="Facebook">
        <Input name="facebook" defaultValue={profile.social.facebook} placeholder="facebook.com/yourname" />
      </Field>
      <Field label="Website">
        <Input name="website" defaultValue={profile.social.website} placeholder="yourname.com" />
      </Field>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
        <Message error={state.error} ok={state.ok} />
      </div>
    </form>
  );
}
