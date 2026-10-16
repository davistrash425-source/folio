"use client";

/* eslint-disable @next/next/no-img-element -- user uploads are served by our own route */
import { useEffect, useState, useTransition, type ReactNode } from "react";
import { discardDraftDesign, publishDesign, saveDraftDesign, undoDesign, type DesignResult } from "@/app/actions/design";
import { Button } from "@/app/ui/form";
import { THEMES, applyTheme, sameDesign, type SectionType, type SiteDesign, type ThemeId } from "@/lib/design";
import { TEMPLATES } from "@/lib/templates";
import { DevicePreview, DeviceButtons, type Device } from "./device-preview";

export type EditorPhoto = { id: string; src: string; srcSet?: string; description: string; location: string };
export type EditorAlbum = { id: string; title: string; photoCount: number };

const SECTION_LABELS: Record<SectionType, string> = {
  hero: "Header",
  gallery: "Photo gallery",
  albums: "Album links",
  about: "About (your bio)",
  contact: "Contact",
};

export function DesignEditor(props: {
  draft: SiteDesign;
  published: SiteDesign;
  canUndo: boolean;
  photos: EditorPhoto[];
  albums: EditorAlbum[];
}) {
  const [design, setDesign] = useState(props.draft); // what's on screen
  const [saved, setSaved] = useState(props.draft); // the stored draft
  const [published, setPublished] = useState(props.published);
  const [canUndo, setCanUndo] = useState(props.canUndo);
  const [error, setError] = useState<string>();
  const [device, setDevice] = useState<Device>("desktop");
  const [pending, startTransition] = useTransition();

  const unsaved = !sameDesign(design, saved);
  const unpublished = !sameDesign(design, published);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!unsaved) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);

  function run(action: () => Promise<DesignResult>) {
    setError(undefined);
    startTransition(async () => {
      const result = await action();
      if (result.error) return setError(result.error);
      if (result.draft) {
        setSaved(result.draft);
        setDesign(result.draft);
      }
      if (result.published) setPublished(result.published);
      setCanUndo(Boolean(result.canUndo));
    });
  }

  const update = (patch: Partial<SiteDesign>) => setDesign((d) => ({ ...d, ...patch }));

  const status = unsaved ? "Unsaved changes" : unpublished ? "Draft saved — not live yet" : "Live on your site";

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-30 -mx-6 flex flex-wrap items-center gap-3 border-b border-zinc-200 bg-zinc-50/95 px-6 py-3 backdrop-blur md:mx-0 md:rounded-2xl md:border md:bg-white/95">
        <span className={`flex items-center gap-2 text-sm ${unsaved || unpublished ? "text-amber-700" : "text-green-700"}`} aria-live="polite">
          <span className={`h-2 w-2 rounded-full ${unsaved || unpublished ? "bg-amber-500" : "bg-green-600"}`} aria-hidden="true" />
          {status}
        </span>
        {error && <span role="alert" className="text-sm text-red-600">{error}</span>}
        <div className="ml-auto flex flex-wrap gap-2">
          <ToolbarButton
            disabled={pending || (!unsaved && !canUndo)}
            onClick={() => (unsaved ? setDesign(saved) : run(undoDesign))}
            title={unsaved ? "Undo changes since your last save" : "Go back to your previous saved draft"}
          >
            Undo
          </ToolbarButton>
          <ToolbarButton
            disabled={pending || !unpublished}
            onClick={() => {
              if (confirm("Discard all changes that aren’t live yet?")) run(discardDraftDesign);
            }}
          >
            Discard
          </ToolbarButton>
          <ToolbarButton disabled={pending || !unsaved} onClick={() => run(() => saveDraftDesign(design))}>
            Save draft
          </ToolbarButton>
          <Button disabled={pending || !unpublished} onClick={() => run(() => publishDesign(design))} className="h-9">
            {pending ? "Saving…" : "Publish changes"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[24rem_1fr]">
        <div className="space-y-4">
          <AiPlaceholder />

          <Group title="Theme">
            <div className="grid grid-cols-3 gap-2">
              {THEMES.map((id) => (
                <ThemeCard key={id} id={id} active={design.theme === id} onClick={() => setDesign((d) => applyTheme(d, id))} />
              ))}
            </div>
            <p className="text-xs text-zinc-500">Switching theme changes colors, fonts and gallery style. Your content choices stay.</p>
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  ["background", "Background"],
                  ["text", "Text"],
                  ["muted", "Secondary text"],
                  ["accent", "Links & buttons"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <input
                    type="color"
                    value={design.colors[key]}
                    onChange={(e) => update({ colors: { ...design.colors, [key]: e.target.value } })}
                    className="h-8 w-10 cursor-pointer rounded border border-zinc-300"
                  />
                  {label}
                </label>
              ))}
            </div>
            <Choice
              label="Fonts"
              value={design.fonts}
              options={[
                ["sans", "Sans-serif"],
                ["serif", "Serif"],
                ["mixed", "Serif headings"],
              ]}
              onChange={(fonts) => update({ fonts })}
            />
          </Group>

          <Group title="Content">
            <Choice
              label="Home page photos"
              value={design.content.homepage}
              options={[
                ["all", "All photos"],
                ["selected", "Choose photos"],
              ]}
              onChange={(homepage) => update({ content: { ...design.content, homepage } })}
            />
            {design.content.homepage === "selected" && (
              <PhotoPicker
                photos={props.photos}
                selected={design.content.homepagePhotoIds}
                ordered
                onChange={(homepagePhotoIds) => update({ content: { ...design.content, homepagePhotoIds } })}
                hint="Click photos in the order they should appear."
              />
            )}
            <Choice
              label="Albums on your site"
              value={design.content.albums}
              options={[
                ["all", "All albums"],
                ["selected", "Choose albums"],
              ]}
              onChange={(albums) =>
                update({
                  content: {
                    ...design.content,
                    albums,
                    albumIds: design.content.albumIds.length ? design.content.albumIds : props.albums.map((a) => a.id),
                  },
                })
              }
            />
            {design.content.albums === "selected" && (
              <AlbumPicker
                albums={props.albums}
                selected={design.content.albumIds}
                onChange={(albumIds) => update({ content: { ...design.content, albumIds } })}
              />
            )}
          </Group>

          <Group title="Layout">
            <div>
              <p className="mb-2 text-sm font-medium">Sections (top to bottom)</p>
              <ul className="space-y-1">
                {design.sections.map((s, i) => (
                  <li key={s.type} className="flex items-center gap-2 rounded-lg bg-zinc-50 px-3 py-2 text-sm ring-1 ring-zinc-200">
                    <label className="flex flex-1 items-center gap-2">
                      <input
                        type="checkbox"
                        checked={s.visible}
                        onChange={(e) =>
                          update({ sections: design.sections.map((x) => (x.type === s.type ? { ...x, visible: e.target.checked } : x)) })
                        }
                      />
                      <span className={s.visible ? "" : "text-zinc-400"}>{SECTION_LABELS[s.type]}</span>
                    </label>
                    <IconButton label={`Move ${SECTION_LABELS[s.type]} up`} disabled={i === 0} onClick={() => update({ sections: swap(design.sections, i, i - 1) })}>↑</IconButton>
                    <IconButton label={`Move ${SECTION_LABELS[s.type]} down`} disabled={i === design.sections.length - 1} onClick={() => update({ sections: swap(design.sections, i, i + 1) })}>↓</IconButton>
                  </li>
                ))}
              </ul>
            </div>
            <Choice
              label="Header style"
              value={design.hero.style}
              options={[
                ["title", "Your name, large"],
                ["cover", "Full-screen cover photo"],
              ]}
              onChange={(style) => update({ hero: { ...design.hero, style } })}
            />
            {design.hero.style === "cover" && (
              <div>
                <p className="mb-2 text-sm font-medium">Cover photo</p>
                <button
                  type="button"
                  aria-pressed={design.hero.coverPhotoId === null}
                  onClick={() => update({ hero: { ...design.hero, coverPhotoId: null } })}
                  className={`mb-2 rounded-full px-3 py-1 text-xs ring-1 ${design.hero.coverPhotoId === null ? "bg-black text-white ring-black" : "ring-zinc-300"}`}
                >
                  Automatic (first photo)
                </button>
                <PhotoPicker
                  photos={props.photos}
                  selected={design.hero.coverPhotoId ? [design.hero.coverPhotoId] : []}
                  single
                  onChange={([id]) => update({ hero: { ...design.hero, coverPhotoId: id ?? null } })}
                />
              </div>
            )}
            <Choice
              label="Gallery style"
              value={design.gallery.layout}
              options={[
                ["grid", "Grid"],
                ["masonry", "Masonry"],
                ["column", "Single column"],
                ["editorial", "Editorial"],
              ]}
              onChange={(layout) => update({ gallery: { ...design.gallery, layout } })}
            />
            {(design.gallery.layout === "grid" || design.gallery.layout === "masonry") && (
              <Choice
                label="Columns on large screens"
                value={String(design.gallery.columns)}
                options={[
                  ["2", "2"],
                  ["3", "3"],
                  ["4", "4"],
                ]}
                onChange={(c) => update({ gallery: { ...design.gallery, columns: Number(c) as 2 | 3 | 4 } })}
              />
            )}
            <Choice
              label="Spacing between photos"
              value={design.gallery.spacing}
              options={[
                ["none", "None"],
                ["tight", "Tight"],
                ["airy", "Airy"],
              ]}
              onChange={(spacing) => update({ gallery: { ...design.gallery, spacing } })}
            />
            {design.gallery.layout === "grid" && (
              <Choice
                label="Photo shape"
                value={design.gallery.cropping}
                options={[
                  ["original", "Original"],
                  ["square", "Square"],
                  ["portrait", "Portrait 4:5"],
                ]}
                onChange={(cropping) => update({ gallery: { ...design.gallery, cropping } })}
              />
            )}
          </Group>

          <Group title="Captions">
            <Choice
              label="Show descriptions under photos"
              value={design.captions.show}
              options={[
                ["none", "None"],
                ["chosen", "Chosen photos"],
                ["all", "All photos"],
              ]}
              onChange={(show) => update({ captions: { ...design.captions, show } })}
            />
            {design.captions.show === "chosen" && (
              <PhotoPicker
                photos={props.photos}
                selected={design.captions.photoIds}
                onChange={(photoIds) => update({ captions: { ...design.captions, photoIds } })}
                hint="Photos without a description or location are dimmed — add them in All photos."
                dimEmpty
              />
            )}
            {design.captions.show !== "none" && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={design.captions.includeLocation}
                  onChange={(e) => update({ captions: { ...design.captions, includeLocation: e.target.checked } })}
                />
                Include the photo’s location
              </label>
            )}
          </Group>
        </div>

        <div className="space-y-3 xl:sticky xl:top-20 xl:self-start">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-zinc-500">Live preview{unsaved ? " (unsaved)" : ""}</p>
            <DeviceButtons device={device} onChange={setDevice} />
          </div>
          <DevicePreview src="/site-preview" device={device} design={design} className="h-[70vh] min-h-[28rem]" />
        </div>
      </div>
    </div>
  );
}

function swap<T>(list: T[], a: number, b: number) {
  const next = [...list];
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details open className="group rounded-2xl bg-white ring-1 ring-zinc-200">
      <summary className="cursor-pointer list-none px-5 py-4 font-semibold">
        <span className="mr-2 inline-block transition group-open:rotate-90" aria-hidden="true">›</span>
        {title}
      </summary>
      <div className="space-y-5 px-5 pb-5">{children}</div>
    </details>
  );
}

function Choice<T extends string>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: [T, string][];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-1">
        {options.map(([v, text]) => (
          <button
            key={v}
            type="button"
            aria-pressed={value === v}
            onClick={() => onChange(v)}
            className={`rounded-full px-3 py-1.5 text-sm ring-1 ${value === v ? "bg-black text-white ring-black" : "ring-zinc-300 hover:bg-zinc-100"}`}
          >
            {text}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function ThemeCard({ id, active, onClick }: { id: ThemeId; active: boolean; onClick: () => void }) {
  const t = TEMPLATES.find((x) => x.id === id)!;
  const swatch = { minimal: "bg-white", dark: "bg-zinc-900", editorial: "bg-stone-100" }[id];
  const bar = { minimal: "bg-zinc-200", dark: "bg-zinc-600", editorial: "bg-stone-300" }[id];
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      title={t.description}
      className={`rounded-xl p-2 text-left text-xs ring-1 ${active ? "ring-2 ring-black" : "ring-zinc-200 hover:ring-zinc-400"}`}
    >
      <span className={`mb-2 grid h-12 grid-cols-3 gap-0.5 rounded-md p-1 ring-1 ring-zinc-200 ${swatch}`}>
        <span className={`rounded-sm ${bar}`} />
        <span className={`rounded-sm ${bar}`} />
        <span className={`rounded-sm ${bar}`} />
      </span>
      <span className="font-medium">{t.name}</span>
    </button>
  );
}

function PhotoPicker({ photos, selected, onChange, ordered, single, hint, dimEmpty }: {
  photos: EditorPhoto[];
  selected: string[];
  onChange: (ids: string[]) => void;
  ordered?: boolean;
  single?: boolean;
  hint?: string;
  dimEmpty?: boolean;
}) {
  if (photos.length === 0) return <p className="text-sm text-zinc-500">Upload photos first.</p>;
  return (
    <div>
      {hint && <p className="mb-2 text-xs text-zinc-500">{hint}</p>}
      {!single && (
        <div className="mb-2 flex gap-3 text-xs">
          <button type="button" className="underline" onClick={() => onChange(photos.map((p) => p.id))}>Select all</button>
          <button type="button" className="underline" onClick={() => onChange([])}>Clear</button>
          <span className="text-zinc-500">{selected.length} selected</span>
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
                className={`relative block w-full overflow-hidden rounded-md ring-offset-1 ${on ? "ring-2 ring-black" : empty ? "opacity-40" : "opacity-70 hover:opacity-100"}`}
              >
                <img src={p.src} srcSet={p.srcSet} sizes="80px" alt="" className="aspect-square w-full object-cover" />
                {on && (
                  <span className="absolute right-0.5 top-0.5 min-w-4 rounded-full bg-black px-1 text-[10px] leading-4 text-white">
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

function AlbumPicker({ albums, selected, onChange }: {
  albums: EditorAlbum[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  if (albums.length === 0) return <p className="text-sm text-zinc-500">You don’t have any albums yet.</p>;
  const chosen = selected.flatMap((id) => albums.find((a) => a.id === id) ?? []);
  const others = albums.filter((a) => !selected.includes(a.id));
  return (
    <ul className="space-y-1">
      {[...chosen, ...others].map((a) => {
        const i = selected.indexOf(a.id);
        return (
          <li key={a.id} className="flex items-center gap-2 rounded-lg bg-zinc-50 px-3 py-2 text-sm ring-1 ring-zinc-200">
            <label className="flex flex-1 items-center gap-2">
              <input
                type="checkbox"
                checked={i !== -1}
                onChange={(e) => onChange(e.target.checked ? [...selected, a.id] : selected.filter((id) => id !== a.id))}
              />
              {a.title}
              {a.photoCount === 0 && <span className="text-xs text-zinc-400">(empty — hidden on site)</span>}
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

function IconButton({ label, children, ...props }: React.ComponentProps<"button"> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...props}
      className="rounded px-1.5 text-zinc-600 hover:bg-zinc-200 disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function ToolbarButton({ children, ...props }: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      {...props}
      className="h-9 rounded-full px-4 text-sm font-medium ring-1 ring-zinc-300 hover:bg-zinc-100 disabled:opacity-40"
    >
      {children}
    </button>
  );
}

// Where the AI assistant will go: describe a change, review it in the
// preview, then save or publish like any other edit.
function AiPlaceholder() {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-4">
      <label htmlFor="ai-request" className="text-sm font-medium">Describe a change</label>
      <textarea
        id="ai-request"
        disabled
        rows={2}
        placeholder="e.g. “Make it darker and show my wedding album first” — coming soon"
        className="mt-2 w-full resize-none rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-400"
      />
    </div>
  );
}
