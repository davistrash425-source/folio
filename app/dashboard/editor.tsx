"use client";

/* eslint-disable @next/next/no-img-element -- user uploads are served by our own route */
import Link from "next/link";
import { useState, useTransition } from "react";
import { addPhotosToAlbum, deletePhotos, reorderPhotos, updatePhotos } from "@/app/actions/site";
import { Button, Message, inputClass, chipClass } from "@/app/ui/form";
import { ConfirmButton } from "@/app/ui/confirm";
import { Dialog } from "@/app/ui/dialog";
import { CreateAlbumForm } from "./albums";
import { PhotoDrawer, SmallButton } from "./photo-drawer";

export { PhotoUploader } from "./photo-uploader";

export type LibraryPhoto = {
  id: string;
  src: string;
  srcSet?: string;
  description: string;
  location: string;
  alt: string; // as entered; empty means "use the description"
  albumIds: string[];
  removed?: boolean; // taken down by Folio: off the site, and its web copies are gone
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
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [size, setSize] = useState(1); // 0 small … 2 large
  const [bulkOpen, setBulkOpen] = useState(false);
  const [newAlbumOpen, setNewAlbumOpen] = useState(false);
  const [bulk,setBulk] = useState({ description: "", location: "" });
  const [notice, setNotice] = useState<{ error?: string; ok?: string }>({});

  if (photos.length === 0) {
    return (
      <p className="bg-card p-6 text-sm text-ink-soft border border-rule">
        No photos yet. <Link href="/dashboard/manage/upload" className="underline">Upload some</Link> to fill your site.
      </p>
    );
  }

  // The open photo stays listed even once it no longer matches the filter
  // (its caption autosaved), so the drawer doesn't close while you type.
  const visible = order.filter((p) =>
    p.id === openId || (filter === "no-album" ? p.albumIds.length === 0 : filter === "no-description" ? !p.description : true),
  );
  const canReorder = filter === "all" && !selecting;
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

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function run(action: () => Promise<{ error?: string; ok?: string }>) {
    startTransition(async () => {
      const result = await action();
      setNotice(result);
      if (result.ok) {
        setSelected(new Set());
        setSelecting(false);
        setBulkOpen(false);
      }
    });
  }

  const cols = {
    0: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6",
    1: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
    2: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4",
  }[size];

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
        <button
          type="button"
          aria-pressed={selecting}
          onClick={() => {
            setSelecting((s) => !s);
            setSelected(new Set());
          }}
          className={chipClass(selecting)}
        >
          Select
        </button>
        <label className="ml-auto flex items-center gap-2 text-sm text-ink-soft">
          <input
            type="range"
            min={0}
            max={2}
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            aria-label="Photo size"
            className="w-24"
          />
        </label>
        <span className="text-sm text-ink-soft">
          {selecting
            ? "Click photos to choose them."
            : canReorder
              ? "Click a photo to edit it. Drag to reorder."
              : "Click a photo to edit it."}
        </span>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 border border-accent bg-accent-soft/40 px-3 py-2">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) run(() => addPhotosToAlbum([...selected], e.target.value));
            }}
            aria-label="Add selected photos to an album"
            className="border border-rule bg-card px-2 py-1.5 text-sm"
          >
            <option value="">Add to album…</option>
            {albums.map((a) => (
              <option key={a.id} value={a.id}>{a.title}</option>
            ))}
          </select>
          <button type="button" onClick={() => setNewAlbumOpen(true)} className="border border-rule bg-card px-3 py-1.5 text-sm hover:border-ink">
            New album from these
          </button>
          <button type="button" onClick={() => setBulkOpen((o) => !o)} className="border border-rule bg-card px-3 py-1.5 text-sm hover:border-ink">
            Edit details
          </button>
          <ConfirmButton
            label="Delete"
            message={`Delete ${selected.size} photo${selected.size === 1 ? "" : "s"}?`}
            onConfirm={() => run(() => deletePhotos([...selected]))}
            className="px-3 py-1.5 text-sm text-accent hover:bg-accent-soft"
            confirmClassName="bg-accent px-3 py-1.5 text-sm text-paper hover:bg-ink"
          />
          <Message error={notice.error} ok={notice.ok} />
          <button
            type="button"
            onClick={() => {
              setSelecting(false);
              setSelected(new Set());
            }}
            className="ml-auto px-3 py-1.5 text-sm text-ink-soft hover:text-ink"
          >
            Done
          </button>
        </div>
      )}

      {newAlbumOpen && (
        <Dialog title={`New album with ${selected.size} photo${selected.size === 1 ? "" : "s"}`} onClose={() => setNewAlbumOpen(false)}>
          <CreateAlbumForm photoIds={[...selected]} />
        </Dialog>
      )}

      {bulkOpen && (
        <div className="flex flex-wrap items-end gap-3 border border-rule bg-card px-3 py-3">
          <label className="min-w-48 flex-1 text-sm">
            <span className="label text-ink-soft">Caption</span>
            <input
              value={bulk.description}
              onChange={(e) => setBulk((b) => ({ ...b, description: e.target.value }))}
              maxLength={500}
              placeholder="Set a caption"
              className={`mt-1 ${inputClass}`}
            />
          </label>
          <label className="min-w-40 flex-1 text-sm">
            <span className="label text-ink-soft">Location</span>
            <input
              value={bulk.location}
              onChange={(e) => setBulk((b) => ({ ...b, location: e.target.value }))}
              maxLength={120}
              placeholder="Set a location"
              className={`mt-1 ${inputClass}`}
            />
          </label>
          <Button
            type="button"
            disabled={!bulk.description.trim() && !bulk.location.trim()}
            onClick={() => {
              const details: { description?: string; location?: string } = {};
              if (bulk.description.trim()) details.description = bulk.description.trim();
              if (bulk.location.trim()) details.location = bulk.location.trim();
              run(() => updatePhotos([...selected], details));
            }}
          >
            Apply
          </Button>
          <button type="button" onClick={() => setBulkOpen(false)} className="h-10 px-3 text-sm hover:bg-ink/5">
            Cancel
          </button>
        </div>
      )}

      {visible.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink-soft">Nothing here — nice work.</p>
      ) : (
        <ul className={`grid ${cols} gap-x-4 gap-y-6 ${pending ? "opacity-80" : ""}`}>
          {visible.map((photo, i) => {
            const isSelected = selected.has(photo.id);
            return (
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
                  data-photo={photo.id}
                  onClick={() => (selecting ? toggleSelected(photo.id) : setOpenId(photo.id))}
                  aria-pressed={selecting ? isSelected : undefined}
                  aria-label={selecting ? `${isSelected ? "Unselect" : "Select"} photo ${i + 1}` : `Edit photo${photo.description ? `: ${photo.description}` : ` ${i + 1}`}`}
                  className="relative block w-full bg-ink/5 outline-offset-2 hover:outline hover:outline-1 hover:outline-ink"
                >
                  {photo.removed ? (
                    <span className="label flex aspect-square w-full items-center justify-center text-accent">Taken down</span>
                  ) : (
                    <img src={photo.src} srcSet={photo.srcSet} sizes="240px" alt="" draggable={false} className="aspect-square w-full object-cover" />
                  )}
                  {selecting && (
                    <span
                      aria-hidden="true"
                      className={`absolute left-1.5 top-1.5 flex h-5 w-5 items-center justify-center border text-xs ${
                        isSelected ? "border-accent bg-accent text-paper" : "border-ink bg-paper/90"
                      }`}
                    >
                      {isSelected ? "✓" : ""}
                    </span>
                  )}
                </button>
                {/* Caption under the frame, like a contact sheet. */}
                <div className="pointer-events-none mt-2 text-xs">
                  <p className="flex gap-2">
                    <span className="label text-ink-faint">{String(order.indexOf(photo) + 1).padStart(2, "0")}</span>
                    <span className="truncate">{photo.description || <span className="text-ink-faint">No description</span>}</span>
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
            );
          })}
        </ul>
      )}

      {openIndex !== -1 && (
        <PhotoDrawer
          key={visible[openIndex].id}
          photo={visible[openIndex]}
          albums={albums}
          onClose={() => {
            // Back to the photo you were last on, not the one you opened.
            const id = openId;
            setOpenId(null);
            requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-photo="${id}"]`)?.focus());
          }}
          onPrev={openIndex > 0 ? () => setOpenId(visible[openIndex - 1].id) : undefined}
          onNext={openIndex < visible.length - 1 ? () => setOpenId(visible[openIndex + 1].id) : undefined}
        />
      )}
    </div>
  );
}

