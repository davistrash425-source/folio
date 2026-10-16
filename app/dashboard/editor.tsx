"use client";

/* eslint-disable @next/next/no-img-element -- user uploads are served by our own route */
import { useActionState, useRef, useState, useTransition } from "react";
import {
  chooseTemplate,
  deletePhoto,
  reorderPhotos,
  saveProfile,
  setPhotoAlt,
  uploadPhotos,
} from "@/app/actions/site";
import { Button, Field, Input, Message, inputClass } from "@/app/ui/form";
import type { User } from "@/lib/db";

// Keep in sync with MAX_PHOTO_BYTES in lib/uploads.ts.
const MAX_PHOTO_MB = 20;

type UploadItem = { name: string; status: "waiting" | "uploading" | "done" | "failed"; reason?: string };

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/avif";

export function PhotoUploader() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const busy = items.some((i) => i.status === "waiting" || i.status === "uploading");

  // Photos are sent one request at a time so a big batch never exceeds the
  // request body limit and one bad file doesn't stop the rest.
  async function upload(files: File[]) {
    if (files.length === 0 || busy) return;
    setItems(files.map((f) => ({ name: f.name, status: "waiting" })));
    const update = (i: number, item: Partial<UploadItem>) =>
      setItems((cur) => cur.map((x, j) => (j === i ? { ...x, ...item } : x)));

    for (const [i, file] of files.entries()) {
      if (!ACCEPT.split(",").includes(file.type)) {
        update(i, { status: "failed", reason: "not a JPG, PNG, WebP, GIF or AVIF" });
        continue;
      }
      if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
        update(i, { status: "failed", reason: `over ${MAX_PHOTO_MB} MB` });
        continue;
      }
      update(i, { status: "uploading" });
      const fd = new FormData();
      fd.append("photos", file);
      try {
        const result = await uploadPhotos({}, fd);
        update(i, result.error ? { status: "failed", reason: "couldn't be read as an image" } : { status: "done" });
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
        className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-6 py-8 text-center transition ${
          dragging ? "border-black bg-zinc-50" : "border-zinc-300 hover:border-zinc-400"
        } ${busy ? "pointer-events-none opacity-60" : ""}`}
      >
        <span className="font-medium">{busy ? "Uploading…" : "Drop photos here or click to choose"}</span>
        <span className="text-sm text-zinc-500">JPG, PNG, WebP, GIF or AVIF, up to {MAX_PHOTO_MB} MB each</span>
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
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
              <div
                className="h-full bg-black transition-all"
                style={{ width: `${((done + failed.length) / items.length) * 100}%` }}
              />
            </div>
            <span className="text-zinc-600">
              {done + failed.length} of {items.length}
            </span>
          </div>
          {!busy && done > 0 && <Message ok={`Uploaded ${done} photo${done === 1 ? "" : "s"}.`} />}
          {failed.length > 0 && (
            <ul className="text-red-600" role="alert">
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

type GridPhoto = { id: string; src: string; srcSet?: string; alt: string };

export function PhotoGrid({ photos }: { photos: GridPhoto[] }) {
  // Start over from the server's list whenever it changes.
  return <PhotoGridInner key={photos.map((p) => `${p.id}:${p.alt}`).join()} photos={photos} />;
}

function PhotoGridInner({ photos }: { photos: GridPhoto[] }) {
  const [order, setOrder] = useState(photos);
  const [dragId, setDragId] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (photos.length === 0) {
    return <p className="text-sm text-zinc-500">No photos yet — upload a few to fill your site.</p>;
  }

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
    <div className="space-y-2">
      <p className="text-sm text-zinc-500">Drag photos to reorder them, or use the arrow buttons.</p>
      <ul className={`grid grid-cols-2 gap-3 sm:grid-cols-4 ${pending ? "opacity-80" : ""}`}>
        {order.map((photo, i) => (
          <li
            key={photo.id}
            draggable={editing === null}
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
            className={`group relative cursor-grab overflow-hidden rounded-lg bg-zinc-100 ${dragId === photo.id ? "opacity-40" : ""}`}
          >
            <img src={photo.src} srcSet={photo.srcSet} sizes="240px" alt={photo.alt} draggable={false} className="aspect-square w-full object-cover" />
            {i === 0 && (
              <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-xs text-white">Cover</span>
            )}
            {!photo.alt && (
              <span
                className="absolute right-2 top-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900"
                title="Add a description for screen readers and search engines"
              >
                No description
              </span>
            )}
            <div className="absolute inset-x-0 bottom-0 flex flex-wrap justify-end gap-1 bg-gradient-to-t from-black/60 p-2 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
              <SmallButton label="Move earlier" disabled={i === 0} onClick={() => moveAndSave(photo.id, i - 1)}>←</SmallButton>
              <SmallButton label="Move later" disabled={i === order.length - 1} onClick={() => moveAndSave(photo.id, i + 1)}>→</SmallButton>
              {i !== 0 && <SmallButton label="Make cover" onClick={() => moveAndSave(photo.id, 0)}>Cover</SmallButton>}
              <SmallButton label="Describe photo" onClick={() => setEditing(photo.id)}>Alt</SmallButton>
              <SmallButton
                label="Delete photo"
                danger
                onClick={() => {
                  if (confirm("Delete this photo?")) startTransition(() => deletePhoto(photo.id));
                }}
              >
                Delete
              </SmallButton>
            </div>
            {editing === photo.id && (
              <form
                className="absolute inset-0 flex flex-col gap-2 bg-white/95 p-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const alt = String(new FormData(e.currentTarget).get("alt") ?? "");
                  setOrder((cur) => cur.map((p) => (p.id === photo.id ? { ...p, alt } : p)));
                  setEditing(null);
                  startTransition(() => setPhotoAlt(photo.id, alt));
                }}
              >
                <label className="text-xs font-medium" htmlFor={`alt-${photo.id}`}>Describe this photo</label>
                <textarea
                  id={`alt-${photo.id}`}
                  name="alt"
                  autoFocus
                  defaultValue={photo.alt}
                  maxLength={300}
                  placeholder="Couple on the beach at sunset"
                  className={`${inputClass} flex-1 resize-none text-xs`}
                />
                <div className="flex justify-end gap-1">
                  <button type="button" onClick={() => setEditing(null)} className="rounded-full px-2 py-1 text-xs">Cancel</button>
                  <button type="submit" className="rounded-full bg-black px-3 py-1 text-xs text-white">Save</button>
                </div>
              </form>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SmallButton({
  label,
  danger,
  children,
  ...props
}: React.ComponentProps<"button"> & { label: string; danger?: boolean }) {
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

export function TemplatePicker({
  templates,
  current,
}: {
  templates: { id: string; name: string; description: string }[];
  current: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className={`grid gap-3 sm:grid-cols-3 ${pending ? "opacity-60" : ""}`}>
      {templates.map((t) => {
        const active = t.id === current;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => startTransition(() => chooseTemplate(t.id))}
            aria-pressed={active}
            className={`rounded-xl p-4 text-left ring-1 transition ${
              active ? "ring-2 ring-black" : "ring-zinc-200 hover:ring-zinc-400"
            }`}
          >
            <TemplateThumb id={t.id} />
            <span className="mt-3 block font-medium">
              {t.name} {active && <span className="text-xs text-zinc-500">· Selected</span>}
            </span>
            <span className="text-sm text-zinc-500">{t.description}</span>
          </button>
        );
      })}
    </div>
  );
}

function TemplateThumb({ id }: { id: string }) {
  if (id === "dark") {
    return (
      <div className="flex h-24 gap-1 rounded-lg bg-zinc-900 p-2">
        <div className="flex flex-1 flex-col gap-1"><div className="h-10 rounded bg-zinc-600" /><div className="flex-1 rounded bg-zinc-700" /></div>
        <div className="flex flex-1 flex-col gap-1"><div className="flex-1 rounded bg-zinc-700" /><div className="h-8 rounded bg-zinc-600" /></div>
        <div className="flex flex-1 flex-col gap-1"><div className="h-6 rounded bg-zinc-600" /><div className="flex-1 rounded bg-zinc-700" /></div>
      </div>
    );
  }
  if (id === "editorial") {
    return (
      <div className="flex h-24 flex-col gap-1 rounded-lg bg-stone-100 p-2">
        <div className="flex-1 rounded bg-stone-300" />
        <div className="h-2 w-1/2 rounded bg-stone-400" />
        <div className="flex h-6 gap-1"><div className="flex-1 rounded bg-stone-300" /><div className="flex-1 rounded bg-stone-300" /></div>
      </div>
    );
  }
  return (
    <div className="flex h-24 flex-col gap-1 rounded-lg bg-white p-2 ring-1 ring-zinc-200">
      <div className="h-2 w-1/3 rounded bg-zinc-300" />
      <div className="grid flex-1 grid-cols-3 gap-1">
        {Array.from({ length: 6 }, (_, i) => <div key={i} className="rounded bg-zinc-200" />)}
      </div>
    </div>
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
