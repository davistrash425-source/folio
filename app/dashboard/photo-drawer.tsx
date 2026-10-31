"use client";

/* eslint-disable @next/next/no-img-element -- user uploads are served by our own route */
import type { LibraryPhoto } from "./editor";
import Link from "next/link";
import { useEffect, useEffectEvent, useRef, useState, useTransition } from "react";
import { deletePhoto, updatePhoto } from "@/app/actions/site";
import { Field, Input, Message, inputClass } from "@/app/ui/form";
import { ConfirmButton } from "@/app/ui/confirm";
import { useFocusTrap } from "@/app/ui/use-focus-trap";

// Side panel for one photo's details. The frame stays open while you move
// between photos; the form inside is replaced for each one.
export function PhotoDrawer({ photo, albums, onClose, onPrev, onNext, onSaveFailed }: {
  photo: LibraryPhoto;
  albums: { id: string; title: string }[];
  onClose: () => void;
  onSaveFailed?: () => void; // a save failed, perhaps after the drawer closed
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-ink/30" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="Photo details"
        tabIndex={-1}
        className="flex h-full w-full max-w-md flex-col overflow-y-auto bg-card border-l border-ink pb-[var(--keyboard,0px)]"
      >
        <div className="flex items-center justify-between border-b border-rule px-5 py-3">
          <div className="flex gap-1">
            <SmallButton label="Previous photo" disabled={!onPrev} onClick={onPrev}>←</SmallButton>
            <SmallButton label="Next photo" disabled={!onNext} onClick={onNext}>→</SmallButton>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="px-3 py-1 text-xl hover:bg-ink/5">×</button>
        </div>
        <PhotoDetails key={photo.id} photo={photo} albums={albums} onDeleted={onClose} onSaveFailed={onSaveFailed} />
      </div>
    </div>
  );
}

type PhotoFields = { description: string; location: string; alt: string; albumIds: string[] };

const sameFields = (a: PhotoFields, b: PhotoFields) =>
  a.description === b.description && a.location === b.location && a.alt === b.alt && a.albumIds.join() === b.albumIds.join();

// Changes save themselves a moment after you stop typing, and straight away
// when you move to another photo or close the drawer.
const AUTOSAVE_DELAY = 800;

function PhotoDetails({ photo, albums, onDeleted, onSaveFailed }: {
  photo: LibraryPhoto;
  albums: { id: string; title: string }[];
  onDeleted: () => void;
  onSaveFailed?: () => void;
}) {
  const [fields, setFields] = useState<PhotoFields>({
    description: photo.description,
    location: photo.location,
    alt: photo.alt,
    albumIds: photo.albumIds,
  });
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [deleteError, setDeleteError] = useState<string>();
  const [deleting, startDelete] = useTransition();
  const saved = useRef(fields); // what the server has
  const latest = useRef(fields); // what's on screen, for the save on leaving

  function change(patch: Partial<PhotoFields>) {
    const next = { ...fields, ...patch };
    latest.current = next;
    setFields(next);
  }

  const persist = useEffectEvent((values: PhotoFields) => {
    if (sameFields(values, saved.current)) return;
    const before = saved.current;
    saved.current = values;
    setStatus("saving");
    updatePhoto(photo.id, values).then(
      (result) => {
        if (result.error) {
          saved.current = before;
          setStatus("error");
          onSaveFailed?.();
          return;
        }
        setStatus(sameFields(latest.current, values) ? "saved" : "saving");
      },
      () => {
        saved.current = before;
        setStatus("error");
        onSaveFailed?.();
      },
    );
  });

  // Warn before leaving the page with details that haven't saved yet.
  useEffect(() => {
    if (status !== "saving" && status !== "error") return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [status]);

  useEffect(() => {
    const timer = setTimeout(() => persist(fields), AUTOSAVE_DELAY);
    return () => clearTimeout(timer);
  }, [fields]);

  // Leaving this photo (next, previous or close) saves what's left.
  useEffect(() => () => persist(latest.current), []);

  return (
    <>
        {photo.removed ? (
          <p className="border-b border-rule bg-card px-5 py-4 text-sm">
            <span className="font-medium text-accent">Taken down by Folio.</span> This photo isn’t on your site. We emailed
            you why and what you can do; you can also delete it.
          </p>
        ) : (
          <img src={photo.src} srcSet={photo.srcSet} sizes="448px" alt="" className="max-h-80 w-full bg-ink/5 object-contain" />
        )}
        <form className="flex flex-1 flex-col gap-4 p-5" onSubmit={(e) => e.preventDefault()}>
          <Field label="Description" hint="Shown as a caption if your design turns captions on.">
            <textarea
              value={fields.description}
              onChange={(e) => change({ description: e.target.value })}
              rows={3}
              maxLength={500}
              placeholder="Add a caption…"
              className={inputClass}
            />
          </Field>
          <Field label="Location">
            <Input value={fields.location} onChange={(e) => change({ location: e.target.value })} maxLength={120} placeholder="Add a place…" />
          </Field>
          <Field label="Alt text (for screen readers)" hint="Leave empty to use the description.">
            <Input
              value={fields.alt}
              onChange={(e) => change({ alt: e.target.value })}
              maxLength={300}
              placeholder={fields.description || "Describe what’s in the photo…"}
            />
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
                        checked={fields.albumIds.includes(a.id)}
                        onChange={(e) =>
                          change({
                            albumIds: e.target.checked ? [...fields.albumIds, a.id] : fields.albumIds.filter((id) => id !== a.id),
                          })
                        }
                      />
                      {a.title}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </fieldset>
          <div className="mt-auto flex flex-wrap items-center gap-3 border-t border-rule pt-4">
            <p className="text-sm text-ink-soft" aria-live="polite">
              {status === "saving" ? (
                "Saving…"
              ) : status === "saved" ? (
                "Saved"
              ) : status === "error" ? (
                <span className="text-accent">Couldn’t save. Check your connection, then edit again to retry.</span>
              ) : (
                "Changes save automatically."
              )}
            </p>
            <ConfirmButton
              label={deleting ? "Deleting…" : "Delete photo"}
              disabled={deleting}
              message="Delete this photo? It will be removed from your site and albums."
              onConfirm={() =>
                startDelete(async () => {
                  // Nothing left to save once it's gone.
                  saved.current = latest.current;
                  const result = await deletePhoto(photo.id);
                  if (result.error) setDeleteError(result.error);
                  else onDeleted();
                })
              }
              className="ml-auto px-3 py-2 text-sm text-accent hover:bg-accent-soft"
              confirmClassName="bg-accent px-3 py-2 text-sm text-paper hover:bg-ink"
            />
            {deleteError && <div className="w-full"><Message error={deleteError} /></div>}
          </div>
        </form>
    </>
  );
}

export function SmallButton({
  label,
  children,
  disabled,
  onClick,
  ...props
}: React.ComponentProps<"button"> & { label: string }) {
  // Stays focusable when disabled (aria-disabled), like IconButton.
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...props}
      aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : onClick}
      className="bg-paper/90 px-2 py-1 text-xs font-medium border border-rule aria-disabled:opacity-40"
    >
      {children}
    </button>
  );
}

