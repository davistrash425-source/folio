"use client";

/* eslint-disable @next/next/no-img-element -- user uploads are served by our own route */
import { swap, IconButton } from "./ui";
import { type EditorPhoto, type EditorAlbum } from "./types";

export function PhotoPicker({ photos, selected, onChange, ordered, single, hint, dimEmpty }: {
  photos: EditorPhoto[];
  selected: string[];
  onChange: (ids: string[]) => void;
  ordered?: boolean;
  single?: boolean;
  hint?: string;
  dimEmpty?: boolean;
}) {
  if (photos.length === 0) return <p className="text-sm text-ink-soft">Upload photos first.</p>;
  return (
    <div>
      {hint && <p className="mb-2 text-xs text-ink-soft">{hint}</p>}
      {!single && (
        <div className="mb-2 flex gap-3 text-xs">
          <button type="button" className="underline" onClick={() => onChange(photos.map((p) => p.id))}>Select all</button>
          <button type="button" className="underline" onClick={() => onChange([])}>Clear</button>
          <span className="text-ink-soft">{selected.length} selected</span>
        </div>
      )}
      <ul className="grid max-h-64 grid-cols-5 gap-1.5 overflow-y-auto pr-1">
        {photos.map((p) => {
          const index = selected.indexOf(p.id);
          const on = index !== -1;
          const empty = dimEmpty && !p.description && !p.location;
          return (
            <li key={p.id}>
              <button
                type="button"
                aria-pressed={on}
                aria-label={p.description || "Photo"}
                title={p.description || undefined}
                onClick={() => onChange(single ? (on ? [] : [p.id]) : on ? selected.filter((id) => id !== p.id) : [...selected, p.id])}
                className={`relative block w-full overflow-hidden ring-offset-1 ring-offset-paper ${on ? "ring-2 ring-accent" : empty ? "opacity-40" : "opacity-70 hover:opacity-100"}`}
              >
                <img src={p.src} srcSet={p.srcSet} sizes="80px" alt="" className="aspect-square w-full object-cover" />
                {on && (
                  <span className="absolute right-0.5 top-0.5 min-w-4 bg-ink px-1 text-[10px] leading-4 text-paper">
                    {ordered ? index + 1 : "✓"}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function AlbumPicker({ albums, selected, onChange }: {
  albums: EditorAlbum[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  if (albums.length === 0) return <p className="text-sm text-ink-soft">You don’t have any albums yet.</p>;
  const chosen = selected.flatMap((id) => albums.find((a) => a.id === id) ?? []);
  const others = albums.filter((a) => !selected.includes(a.id));
  return (
    <ul className="space-y-1">
      {[...chosen, ...others].map((a) => {
        const i = selected.indexOf(a.id);
        return (
          <li key={a.id} className="flex items-center gap-2 bg-paper px-3 py-2 text-sm border border-rule">
            <label className="flex flex-1 items-center gap-2">
              <input
                type="checkbox"
                checked={i !== -1}
                onChange={(e) => onChange(e.target.checked ? [...selected, a.id] : selected.filter((id) => id !== a.id))}
              />
              {a.title}
              {a.photoCount === 0 && <span className="text-xs text-ink-faint">(empty — hidden on site)</span>}
            </label>
            {i !== -1 && (
              <>
                <IconButton label={`Move ${a.title} up`} disabled={i === 0} onClick={() => onChange(swap(selected, i, i - 1))}>↑</IconButton>
                <IconButton label={`Move ${a.title} down`} disabled={i === selected.length - 1} onClick={() => onChange(swap(selected, i, i + 1))}>↓</IconButton>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}

